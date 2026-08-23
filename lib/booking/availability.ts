import { prisma } from "@/lib/db";
import {
  formatHHMM,
  intersectIntervals,
  nowZoned,
  parseHHMM,
  subtractIntervals,
  utcIntervalToWallMinutes,
  weekdayKey,
  zonedParts,
  zonedToUtc,
  type Interval,
} from "./time";

export const SLOT_STEP_MINUTES = 15;

type OpeningHours = Record<string, { open: string; close: string }[] | null>;

export type AvailableDay = {
  date: string; // YYYY-MM-DD (wall clock at the business)
  times: string[]; // "HH:MM"
};

export type AvailabilityResult = {
  days: AvailableDay[];
  totalDurationMin: number;
};

export type GetSlotsInput = {
  businessId: string;
  serviceIds: string[];
  staffId?: string;
  days?: number; // how many days ahead to scan (bounded by maxLeadDays)
};

const ACTIVE_STATUSES = ["PENDING", "CONFIRMED"] as const;

export async function getAvailableSlots(
  input: GetSlotsInput,
): Promise<AvailabilityResult> {
  const business = await prisma.business.findUniqueOrThrow({
    where: { id: input.businessId },
    include: { settings: true },
  });
  const settings = business.settings;
  if (!settings) throw new Error("Business settings missing");

  const services = await prisma.service.findMany({
    where: { id: { in: input.serviceIds }, businessId: business.id, archived: false },
  });
  if (services.length !== input.serviceIds.length) {
    throw new Error("Um ou mais serviços não existem");
  }
  const totalDurationMin = services.reduce((sum, s) => sum + s.durationMin, 0);

  // Candidate staff: specified, or everyone active performing ALL selected
  // services (staff must have a link for every requested service).
  const uniqueServiceIds = [...new Set(input.serviceIds)];
  const covering = await prisma.serviceStaff.groupBy({
    by: ["staffId"],
    where: {
      serviceId: { in: uniqueServiceIds },
      staff: { businessId: business.id, active: true },
    },
    _count: { staffId: true },
  });
  const candidateIdsPre = covering
    .filter((r) => r._count.staffId === uniqueServiceIds.length)
    .map((r) => r.staffId);

  const validCandidates = await prisma.staff.findMany({
    where: {
      id: { in: input.staffId ? [input.staffId] : candidateIdsPre },
      businessId: business.id,
      active: true,
    },
    include: { workSchedules: true },
  });
  if (validCandidates.length === 0 || uniqueServiceIds.length === 0) {
    return { days: [], totalDurationMin };
  }
  // Staff must also have a weekly schedule to ever be bookable.
  const schedulable = validCandidates.filter((c) => c.workSchedules.length > 0);
  if (schedulable.length === 0) return { days: [], totalDurationMin };

  const candidateIds = schedulable.map((c) => c.id);
  const tz = business.timezone;

  // Range bounds (respect maxLeadDays).
  const today = nowZoned(tz);
  const horizonDays = Math.min(input.days ?? 30, settings.maxLeadDays);
  const rangeStartUtc = zonedToUtc(today.year, today.month, today.day, 0, 0, tz);
  const rangeEndUtc = new Date(rangeStartUtc.getTime() + (horizonDays + 1) * 86_400_000);

  const [timeOff, exceptions, appointments] = await Promise.all([
    prisma.timeOff.findMany({
      where: {
        staffId: { in: candidateIds },
        endAt: { gt: rangeStartUtc },
        startAt: { lt: rangeEndUtc },
      },
    }),
    prisma.availabilityException.findMany({
      where: {
        businessId: business.id,
        OR: [
          { staffId: null },
          { staffId: { in: candidateIds } },
        ],
        endAt: { gt: rangeStartUtc },
        startAt: { lt: rangeEndUtc },
      },
    }),
    prisma.appointment.findMany({
      where: {
        businessId: business.id,
        staffId: { in: candidateIds },
        status: { in: [...ACTIVE_STATUSES] },
        startAt: { lt: rangeEndUtc },
        endAt: { gt: rangeStartUtc },
      },
      select: { staffId: true, startAt: true, endAt: true },
    }),
  ]);

  // Group busy intervals per staff.
  const buffer = settings.bufferMinutes;
  const busyByStaff = new Map<string, { startAt: Date; endAt: Date }[]>();
  for (const appt of appointments) {
    const list = busyByStaff.get(appt.staffId) ?? [];
    list.push({ startAt: appt.startAt, endAt: appt.endAt });
    busyByStaff.set(appt.staffId, list);
  }

  const openingHours = settings.openingHours as OpeningHours;

  // Minimum lead time: earliest bookable wall-clock moment.
  const minStartUtc = new Date(Date.now() + settings.minLeadHours * 3_600_000);

  const result: AvailableDay[] = [];

  for (let dayOffset = 0; dayOffset <= horizonDays; dayOffset++) {
    const dayInstant = new Date(rangeStartUtc.getTime() + dayOffset * 86_400_000);
    const p = zonedParts(dayInstant, tz); // wall-clock parts of this day (00:00)
    const dateStr = `${String(p.year).padStart(4, "0")}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
    const weekday = weekdayKey(new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay());

    // Business hours for this weekday.
    const businessWindows: Interval[] =
      (openingHours[weekday] ?? [])?.map((iv) => ({
        start: parseHHMM(iv.open),
        end: parseHHMM(iv.close),
      })) ?? [];
    if (businessWindows.length === 0) continue;

    // Salon-wide blocks apply to every candidate.
    const salonBlocks = exceptions
      .filter((e) => e.staffId === null)
      .flatMap((e) => utcIntervalToWallMinutes(e.startAt, e.endAt, tz, dayInstant));

    const timesSet = new Set<string>();

    for (const staff of schedulable) {
      // Personal schedule for this weekday (merge overlapping intervals).
      const personalWindows = mergeIntervals(
        staff.workSchedules
          .filter((ws) => weekdayKey(ws.weekday) === weekday)
          .map((ws) => ({ start: parseHHMM(ws.startTime), end: parseHHMM(ws.endTime) })),
      );
      if (personalWindows.length === 0) continue;

      let windows = intersectIntervals(businessWindows, personalWindows);

      // Subtract staff time-off, staff blocks and salon-wide blocks.
      const staffBlocks = timeOff
        .filter((t) => t.staffId === staff.id)
        .flatMap((t) => utcIntervalToWallMinutes(t.startAt, t.endAt, tz, dayInstant))
        .concat(
          exceptions
            .filter((e) => e.staffId === staff.id)
            .flatMap((e) =>
              utcIntervalToWallMinutes(e.startAt, e.endAt, tz, dayInstant),
            ),
        )
        .concat(salonBlocks);
      windows = subtractIntervals(windows, staffBlocks);

      // Subtract existing appointments expanded by buffer on both sides.
      const busy = subtractIntervals([{ start: 0, end: 1440 }],
        (busyByStaff.get(staff.id) ?? []).flatMap((b) =>
          utcIntervalToWallMinutes(
            new Date(b.startAt.getTime() - buffer * 60_000),
            new Date(b.endAt.getTime() + buffer * 60_000),
            tz,
            dayInstant,
          ),
        ),
      );
      windows = intersectIntervals(windows, busy);

      // Step through candidate start times.
      for (const window of windows) {
        for (
          let t = window.start;
          t + totalDurationMin <= window.end;
          t += SLOT_STEP_MINUTES
        ) {
          const slotStart = zonedToUtc(
            p.year,
            p.month,
            p.day,
            Math.floor(t / 60),
            t % 60,
            tz,
          );
          if (slotStart.getTime() < minStartUtc.getTime()) continue;
          timesSet.add(formatHHMM(t));
        }
      }
    }

    if (timesSet.size > 0) {
      result.push({ date: dateStr, times: [...timesSet].sort() });
    }
  }

  return { days: result, totalDurationMin };
}

function mergeIntervals(intervals: Interval[]): Interval[] {
  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  const out: Interval[] = [];
  for (const i of sorted) {
    const last = out[out.length - 1];
    if (last && i.start <= last.end) {
      last.end = Math.max(last.end, i.end);
    } else {
      out.push({ ...i });
    }
  }
  return out;
}


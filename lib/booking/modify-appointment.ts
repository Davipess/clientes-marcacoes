import { prisma } from "@/lib/db";
import { parseHHMM } from "./time";

export type CancelResult =
  | { ok: true }
  | { ok: false; code: "NOT_FOUND" | "POLICY" | "ALREADY_DONE"; message: string };

export type RescheduleResult =
  | { ok: true }
  | {
      ok: false;
      code: "NOT_FOUND" | "POLICY" | "SLOT_TAKEN" | "INVALID";
      message: string;
    };

const ACTIVE_STATUSES = ["PENDING", "CONFIRMED"] as const;

/**
 * Cancels an appointment. When `byClient` is true the cancellation policy
 * window is enforced; admins/staff can always cancel.
 */
export async function cancelAppointment(
  appointmentId: string,
  reason?: string,
  byClient = false,
): Promise<CancelResult> {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: { business: { include: { settings: true } } },
  });

  if (!appointment || !["PENDING", "CONFIRMED"].includes(appointment.status)) {
    return {
      ok: false,
      code: "ALREADY_DONE",
      message: "A marcação já foi concluída ou cancelada.",
    };
  }

  if (byClient) {
    const windowMs =
      (appointment.business.settings?.cancellationWindowHours ?? 24) * 3_600_000;
    if (appointment.startAt.getTime() - Date.now() < windowMs) {
      return {
        ok: false,
        code: "POLICY",
        message: `As marcações só podem ser canceladas até ${
          appointment.business.settings?.cancellationWindowHours ?? 24
        } horas antes. Contacte o salão, por favor.`,
      };
    }
  }

  await prisma.appointment.update({
    where: { id: appointmentId },
    data: {
      status: "CANCELLED",
      cancelledAt: new Date(),
      cancellationReason: reason ?? (byClient ? "Cancelada pelo cliente" : null),
    },
  });

  return { ok: true };
}

/**
 * Reschedules to a new start time. The same availability rules apply,
 * excluding this appointment from the conflict set. Client-initiated
 * reschedules respect the policy window.
 */
export async function rescheduleAppointment(
  appointmentId: string,
  newStartAt: Date,
  byClient = false,
): Promise<RescheduleResult> {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    select: {
      id: true,
      businessId: true,
      staffId: true,
      startAt: true,
      status: true,
      items: { select: { durationMin: true } },
      business: { include: { settings: true } },
    },
  });

  if (!appointment || appointment.status !== "CONFIRMED") {
    return {
      ok: false,
      code: "NOT_FOUND",
      message: "Marcação não encontrada ou não reagendável.",
    };
  }

  if (byClient) {
    const windowMs =
      (appointment.business.settings?.cancellationWindowHours ?? 24) * 3_600_000;
    if (appointment.startAt.getTime() - Date.now() < windowMs) {
      return {
        ok: false,
        code: "POLICY",
        message:
          "As marcações só podem ser reagendadas até ao limite definido na política. Contacte o salão, por favor.",
      };
    }
  }

  if (newStartAt.getTime() === appointment.startAt.getTime()) {
    return { ok: false, code: "INVALID", message: "Escolha um horário diferente." };
  }

  const totalDurationMin = appointment.items.reduce(
    (sum, item) => sum + item.durationMin,
    0,
  );
  const newEndAt = new Date(newStartAt.getTime() + totalDurationMin * 60_000);
  const settings = appointment.business.settings;

  if (!settings) {
    return { ok: false, code: "INVALID", message: "Configuração em falta." };
  }

  // Validate against availability, excluding this appointment itself.
  const available = await validateSlotExcludingSelf(
    appointment.businessId,
    appointment.staffId,
    newStartAt,
    totalDurationMin,
    appointment.id,
    settings.bufferMinutes,
    settings.minLeadHours,
    settings.maxLeadDays,
  );

  if (!available.ok) {
    return {
      ok: false,
      code: "SLOT_TAKEN",
      message: "O novo horário não está disponível.",
    };
  }

  await prisma.appointment.update({
    where: { id: appointmentId },
    data: { startAt: newStartAt, endAt: newEndAt },
  });

  return { ok: true };
}

// Reuses the same validation core as creation but scoped to one staff member
// and excluding the appointment being moved.
async function validateSlotExcludingSelf(
  businessId: string,
  staffId: string,
  startAt: Date,
  durationMin: number,
  excludeAppointmentId: string,
  bufferMinutes: number,
  minLeadHours: number,
  _maxLeadDays: number,
): Promise<{ ok: boolean }> {
  const endAt = new Date(startAt.getTime() + durationMin * 60_000);

  const [staff, conflicts] = await Promise.all([
    prisma.staff.findFirst({
      where: { id: staffId, active: true },
      include: { workSchedules: true },
    }),
    prisma.appointment.findMany({
      where: {
        businessId,
        staffId,
        id: { not: excludeAppointmentId },
        status: { in: [...ACTIVE_STATUSES] },
        startAt: { lt: new Date(endAt.getTime() + bufferMinutes * 60_000) },
        endAt: { gt: new Date(startAt.getTime() - bufferMinutes * 60_000) },
      },
      select: { startAt: true, endAt: true },
    }),
  ]);

  if (!staff || staff.workSchedules.length === 0) return { ok: false };
  if (startAt.getTime() < Date.now() + minLeadHours * 3_600_000) {
    return { ok: false };
  }

  const bufferMs = bufferMinutes * 60_000;
  const overlapsConflicts = conflicts.some(
    (a) =>
      a.startAt.getTime() - bufferMs < endAt.getTime() &&
      startAt.getTime() < a.endAt.getTime() + bufferMs,
  );
  if (overlapsConflicts) return { ok: false };

  // Schedule fit (wall clock) + business opening hours.
  const business = await prisma.business.findUniqueOrThrow({
    where: { id: businessId },
    include: { settings: true },
  });
  const tz = business.timezone;
  const weekday = weekdayOf(startAt, tz);
  const schedules = staff.workSchedules.filter((ws) => ws.weekday === weekday);
  const { hour, minute } = wallParts(startAt, tz);
  const startWall = hour * 60 + minute;
  const endWall = startWall + durationMin;

  if (
    !schedules.some(
      (ws) =>
        parseHHMM(ws.startTime) <= startWall && endWall <= parseHHMM(ws.endTime),
    )
  ) {
    return { ok: false };
  }

  const openingHours = business.settings?.openingHours as
    | Record<string, { open: string; close: string }[] | null>
    | undefined;
  const businessWindows =
    openingHours?.[["sun", "mon", "tue", "wed", "thu", "fri", "sat"][weekday] ?? "sun"] ?? [];
  const fitsBusinessHours = businessWindows.some(
    (iv) => parseHHMM(iv.open) <= startWall && endWall <= parseHHMM(iv.close),
  );
  if (!fitsBusinessHours) return { ok: false };

  // Time-off / exceptions overlap check.
  const blocks = await Promise.all([
    prisma.timeOff.findMany({
      where: { staffId, endAt: { gt: startAt }, startAt: { lt: endAt } },
    }),
    prisma.availabilityException.findMany({
      where: {
        businessId,
        OR: [{ staffId: null }, { staffId }],
        endAt: { gt: startAt },
        startAt: { lt: endAt },
      },
    }),
  ]);
  const blocked = [...blocks[0], ...blocks[1]].some(
    (b) => b.startAt < endAt && startAt < b.endAt,
  );
  if (blocked) return { ok: false };

  return { ok: true };
}

function weekdayOf(date: Date, timeZone: string): number {
  const p = wallParts(date, timeZone);
  return new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay();
}

function wallParts(date: Date, timeZone: string) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const parts: Record<string, string> = {};
  for (const p of dtf.formatToParts(date)) parts[p.type] = p.value;
  const hour = parts.hour === "24" ? 0 : Number(parts.hour);
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour,
    minute: Number(parts.minute),
  };
}

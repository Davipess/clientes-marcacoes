import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db";
import { encryptPii, normalizePhone, piiLookupHash } from "@/lib/crypto";
import { nowZoned, parseHHMM, utcIntervalToWallMinutes, weekdayKey } from "./time";
import { sendPushToBusiness } from "@/lib/push";

export type CreateBookingInput = {
  businessId: string;
  serviceIds: string[];
  staffId?: string;
  startAt: Date; // UTC instant chosen by the client from /api/disponibilidade
  source?: "ONLINE" | "ADMIN" | "STAFF";
  /** Admin manual bookings may bypass the minimum lead time. */
  bypassLeadTime?: boolean;
  client: {
    name: string;
    phone: string;
    notes?: string;
    marketingConsent?: boolean;
    gdprConsent: boolean;
  };
};

export type CreateBookingResult =
  | { ok: true; appointmentId: string }
  | {
      ok: false;
      code: "SLOT_TAKEN" | "INVALID" | "STAFF_UNAVAILABLE";
      message: string;
    };

type OpeningHours = Record<string, { open: string; close: string }[] | null>;
type Window = [number, number];

/**
 * Creates an appointment inside a serializable transaction that fully
 * re-validates the slot. Concurrent bookings for the same slot are serialized
 * by Postgres; exactly one succeeds.
 */
export async function createAppointment(
  input: CreateBookingInput,
): Promise<CreateBookingResult> {
  if (!input.client.gdprConsent) {
    return {
      ok: false,
      code: "INVALID",
      message: "É necessário aceitar a política de privacidade.",
    };
  }

  // One retry: after a serialization conflict the re-run sees the committed
  // appointment and resolves to a clean SLOT_TAKEN.
  const firstAttempt = await createAppointmentOnce(input);
  if (!firstAttempt.conflict) return firstAttempt.result;
  const secondAttempt = await createAppointmentOnce(input);
  return secondAttempt.result;
}

type OnceResult = { conflict: boolean; result: CreateBookingResult };

async function createAppointmentOnce(input: CreateBookingInput): Promise<OnceResult> {
  let outcome: TxOutcome;

  try {
    outcome = await prisma.$transaction(
      async (tx) => {
        const business = await tx.business.findUniqueOrThrow({
          where: { id: input.businessId },
          include: { settings: true },
        });
        const settings = business.settings;
        if (!settings) throw new Error("Business settings missing");

        const services = await tx.service.findMany({
          where: {
            id: { in: input.serviceIds },
            businessId: business.id,
            archived: false,
          },
        });
        if (services.length !== input.serviceIds.length || services.length === 0) {
          return invalid("Serviços inválidos.");
        }
        const totalDurationMin = services.reduce((s, x) => s + x.durationMin, 0);
        const endAt = new Date(input.startAt.getTime() + totalDurationMin * 60_000);

        // ── Candidate staff: must perform ALL selected services ─
        const uniqueServiceIds = [...new Set(input.serviceIds)];
        const covering = await tx.serviceStaff.groupBy({
          by: ["staffId"],
          where: {
            serviceId: { in: uniqueServiceIds },
            staff: { businessId: business.id, active: true },
          },
          _count: { staffId: true },
        });
        const coveringIds = covering
          .filter((r) => r._count.staffId === uniqueServiceIds.length)
          .map((r) => r.staffId);

        const candidatesWithSchedule = await tx.staff.findMany({
          where: {
            id: { in: input.staffId ? [input.staffId] : coveringIds },
            businessId: business.id,
            active: true,
          },
          include: { workSchedules: true },
        }).then((staff) => staff.filter((s) => s.workSchedules.length > 0));

        if (candidatesWithSchedule.length === 0) {
          return {
            ok: false as const,
            code: "STAFF_UNAVAILABLE" as const,
            message: "Não há profissionais disponíveis para estes serviços.",
          };
        }

        const tz = business.timezone;
        const bufferMs = settings.bufferMinutes * 60_000;
        const day = dayPartsInTz(input.startAt, tz);

        // ── Abuse prevention (Phase 14) — phone is the identifier ──
        const phoneHash = piiLookupHash(normalizePhone(input.client.phone));
        const existingClient = await tx.client.findUnique({
          where: { businessId_phoneHash: { businessId: business.id, phoneHash } },
          select: {
            id: true,
            blocked: true,
            noShowCount: true,
            _count: {
              select: {
                appointments: {
                  where: {
                    status: { in: ["PENDING", "CONFIRMED"] },
                    startAt: { gt: new Date() },
                  },
                },
              },
            },
          },
        });

        if (existingClient?.blocked) {
          // Deliberately vague: never disclose the blocking reason publicly.
          return invalid(
            "Não foi possível concluir a marcação online. Contacte o salão, por favor.",
          );
        }
        if (
          existingClient &&
          existingClient._count.appointments >= settings.maxActiveBookingsPerPhone
        ) {
          return invalid(
            `Já tem ${existingClient._count.appointments} marcações ativas. ` +
              "Só são permitidas " +
              `${settings.maxActiveBookingsPerPhone} marcações futuras em simultâneo. ` +
              "Contacte o salão se precisar de alterar alguma.",
          );
        }
        if (existingClient) {
          // "Created today" = since local midnight at the business, TODAY.
          const now = nowZoned(tz);
          const todayStartLocal = zonedMidnight(now.year, now.month, now.day, tz);
          const createdToday = await tx.appointment.count({
            where: {
              clientId: existingClient.id,
              createdAt: { gte: todayStartLocal },
            },
          });
          if (createdToday >= settings.maxBookingsPerPhonePerDay) {
            return invalid(
              "Já fez várias marcações hoje. Contacte o salão, por favor.",
            );
          }
        }

        const weekday = weekdayKey(day.weekday);
        const startWall = day.hour * 60 + day.minute;
        const blockEndWall = startWall + totalDurationMin;

        // Lead-time validation.
        const minStartUtc = input.bypassLeadTime
          ? new Date(0)
          : new Date(Date.now() + settings.minLeadHours * 3_600_000);
        const maxEndUtc = new Date(
          zonedMidnight(day.year, day.month, day.day, tz).getTime() +
            (settings.maxLeadDays + 1) * 86_400_000,
        );
        if (input.startAt < minStartUtc) {
          return invalid("A marcação é demasiado próxima. Escolha outro horário.");
        }
        if (endAt > maxEndUtc) {
          return invalid("A marcação ultrapassa o limite máximo de antecedência.");
        }

        // Business opening hours must cover the block.
        const openingHours = settings.openingHours as OpeningHours;
        const businessWindows: Window[] =
          (openingHours[weekday] ?? [])?.map((iv) => [
            parseHHMM(iv.open),
            parseHHMM(iv.close),
          ]) ?? [];

        // Blocked time and busy appointments for candidate staff.
        const staffIds = candidatesWithSchedule.map((c) => c.id);
        const wideStart = new Date(input.startAt.getTime() - 2 * 86_400_000);
        const wideEnd = new Date(endAt.getTime() + 2 * 86_400_000);

        const [exceptions, timeOff, appointments] = await Promise.all([
          tx.availabilityException.findMany({
            where: {
              businessId: business.id,
              OR: [{ staffId: null }, { staffId: { in: staffIds } }],
              endAt: { gt: wideStart },
              startAt: { lt: wideEnd },
            },
          }),
          tx.timeOff.findMany({
            where: { staffId: { in: staffIds }, endAt: { gt: wideStart }, startAt: { lt: wideEnd } },
          }),
          tx.appointment.findMany({
            where: {
              businessId: business.id,
              staffId: { in: staffIds },
              status: { in: ["PENDING", "CONFIRMED"] },
              startAt: { lt: new Date(endAt.getTime() + settings.bufferMinutes * 60_000) },
              endAt: { gt: new Date(input.startAt.getTime() - settings.bufferMinutes * 60_000) },
            },
            select: { staffId: true, startAt: true, endAt: true },
          }),
        ]);

        // Choose one candidate whose whole block fits.
        const chosenStaffId =
          candidatesWithSchedule.find((staff) =>
            blockFits(staff.id, staff.workSchedules),
          )?.id ?? null;

        function blockFits(
          staffId: string,
          workSchedules: { weekday: number; startTime: string; endTime: string }[],
        ): boolean {
          // 1) Personal schedule covers the block.
          const personal = mergeWindows(
            workSchedules
              .filter((ws) => weekdayKey(ws.weekday) === weekday)
              .map(
                (ws) => [parseHHMM(ws.startTime), parseHHMM(ws.endTime)] as Window,
              ),
          );
          if (!covers(personal, startWall, blockEndWall)) return false;

          // 2) Business hours cover the block.
          if (!covers(businessWindows, startWall, blockEndWall)) return false;

          // 3) No overlap with blocked intervals or busy appointments.
          const blocked: Window[] = [];
          const addBlock = (startAt: Date, endAt: Date) => {
            // Clip against the booking day and both neighbours (blocks can span midnight).
            for (const offset of [-1, 0, 1]) {
              const anchor = new Date(input.startAt.getTime() + offset * 86_400_000);
              for (const iv of utcIntervalToWallMinutes(startAt, endAt, tz, anchor)) {
                blocked.push([iv.start + offset * 1440, iv.end + offset * 1440]);
              }
            }
          };

          for (const e of exceptions) {
            if (e.staffId === null || e.staffId === staffId) addBlock(e.startAt, e.endAt);
          }
          for (const t of timeOff) {
            if (t.staffId === staffId) addBlock(t.startAt, t.endAt);
          }
          for (const a of appointments) {
            if (a.staffId !== staffId) continue;
            addBlock(
              new Date(a.startAt.getTime() - bufferMs),
              new Date(a.endAt.getTime() + bufferMs),
            );
          }

          return !overlapsAny(blocked, startWall, blockEndWall);
        }

        if (!chosenStaffId) {
          return {
            ok: false as const,
            code: "SLOT_TAKEN" as const,
            message: "O horário escolhido já não está disponível.",
          };
        }

        // ── Upsert client by phone hash (sole identifier) ──────
        const client = await tx.client.upsert({
          where: {
            businessId_phoneHash: { businessId: business.id, phoneHash },
          },
          update: {
            name: input.client.name,
            ...(input.client.gdprConsent ? { gdprConsentAt: new Date() } : {}),
            ...(input.client.marketingConsent === true
              ? { marketingConsent: true }
              : {}),
          },
          create: {
            businessId: business.id,
            name: input.client.name,
            phoneEnc: encryptPii(input.client.phone),
            phoneHash,
            marketingConsent: input.client.marketingConsent ?? false,
            gdprConsentAt: input.client.gdprConsent ? new Date() : null,
          },
        });

        // ── Insert appointment with snapshots ──────────────────
        const created = await tx.appointment.create({
          data: {
            businessId: business.id,
            clientId: client.id,
            staffId: chosenStaffId,
            startAt: input.startAt,
            endAt,
            status: "CONFIRMED",
            source: input.source ?? "ONLINE",
            notes: input.client.notes ?? null,
            items: {
              create: services.map((service, index) => ({
                serviceId: service.id,
                serviceName: service.name,
                unitPrice: service.price,
                durationMin: service.durationMin,
                sortOrder: index,
              })),
            },
          },
          select: { id: true },
        });

        return { ok: true as const, id: created.id };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (error) {
    if (isSerializationConflict(error)) {
      return { conflict: true, result: {
        ok: false,
        code: "SLOT_TAKEN",
        message: "O horário escolhido já não está disponível.",
      } };
    }
    throw error;
  }

  const result: OnceResult = {
    conflict: false,
    result: outcome.ok
      ? { ok: true, appointmentId: outcome.id }
      : { ok: false, code: outcome.code, message: outcome.message },
  };

  // Push notification to business owner (fire-and-forget)
  if (outcome.ok) {
    prisma.appointment
      .findUnique({
        where: { id: outcome.id },
        select: {
          startAt: true,
          client: { select: { name: true } },
          items: { select: { serviceName: true } },
        },
      })
      .then((appt) => {
        if (!appt) return;
        return sendPushToBusiness(input.businessId, {
          title: "Nova marcação",
          body: `${appt.client.name} — ${appt.items.map((i) => i.serviceName).join(" + ")} — ${appt.startAt.toLocaleDateString("pt-PT", { weekday: "long", day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" })}`,
          url: "/admin/agenda",
          tag: "new-booking",
        });
      })
      .catch(() => {});
  }

  return result;
}

/**
 * Detects Postgres serialization failures (SQLSTATE 40001). With driver
 * adapters the error surfaces as DriverAdapterError wrapping the original
 * cause; with the classic client it is PrismaClientKnownRequestError P2034.
 */
function isSerializationConflict(error: unknown): boolean {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2034"
  ) {
    return true;
  }
  const message = String((error as { message?: string })?.message ?? "");
  const causeCode = (error as { cause?: { originalCode?: string } })?.cause
    ?.originalCode;
  return causeCode === "40001" || message.includes("could not serialize");
}

// ── helpers ─────────────────────────────────────────────────────────

type TxOutcome =
  | { ok: true; id: string }
  | { ok: false; code: "INVALID"; message: string }
  | { ok: false; code: "STAFF_UNAVAILABLE"; message: string }
  | { ok: false; code: "SLOT_TAKEN"; message: string };

function invalid(message: string): TxOutcome {
  return { ok: false, code: "INVALID", message };
}

function covers(windows: Window[], start: number, end: number): boolean {
  return windows.some(([wStart, wEnd]) => wStart <= start && end <= wEnd);
}

function overlapsAny(blocks: Window[], start: number, end: number): boolean {
  return blocks.some(([bStart, bEnd]) => bStart < end && start < bEnd);
}

function mergeWindows(windows: Window[]): Window[] {
  const sorted = [...windows].sort((a, b) => a[0] - b[0]);
  const out: Window[] = [];
  for (const w of sorted) {
    const last = out[out.length - 1];
    if (last && w[0] <= last[1]) {
      last[1] = Math.max(last[1], w[1]);
    } else {
      out.push([...w] as Window);
    }
  }
  return out;
}

function dayPartsInTz(date: Date, timeZone: string) {
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
    weekday: new Date(
      Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)),
    ).getUTCDay(),
  };
}

function zonedMidnight(
  year: number,
  month: number,
  day: number,
  timeZone: string,
): Date {
  // Offset medido ao meio-dia (evita ambiguidade DST); aplicado à meia-noite.
  const noon = Date.UTC(year, month - 1, day, 12);
  const offset = wallOffsetMs(new Date(noon), timeZone);
  return new Date(Date.UTC(year, month - 1, day, 0, 0) - offset);
}

function wallOffsetMs(date: Date, timeZone: string): number {
  const p = dayPartsInTz(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
  return asUtc - date.getTime();
}

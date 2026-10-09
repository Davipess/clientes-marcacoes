import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { decryptPiiSafe } from "@/lib/crypto";
import { AgendaView } from "@/components/admin/agenda-view";

export const metadata: Metadata = { title: "Agenda, Administração" };

export default async function AdminAgendaPage({
  searchParams,
}: PageProps<"/admin/agenda">) {
  const user = await getAuthUser();
  if (!user?.businessId) redirect("/entrar");

  const { data: dataParam } = await searchParams;
  const business = await prisma.business.findUniqueOrThrow({
    where: { id: user.businessId },
    select: { timezone: true },
  });
  const tz = business.timezone;

  const todayParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const dateStr = typeof dataParam === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dataParam)
    ? dataParam
    : todayParts;

  const [y, m, d] = dateStr.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d, 12);
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const parts: Record<string, string> = {};
  for (const p of fmt.formatToParts(new Date(guess))) parts[p.type] = p.value;
  const hour = parts.hour === "24" ? 0 : Number(parts.hour);
  const offset =
    Date.UTC(+parts.year, +parts.month - 1, +parts.day, hour, +parts.minute) - guess;
  const dayStart = new Date(guess - offset);
  const dayEnd = new Date(dayStart.getTime() + 86_400_000);

  const [appointments, services] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        businessId: user.businessId,
        startAt: { gte: dayStart, lt: dayEnd },
        status: { in: ["PENDING", "CONFIRMED"] },
      },
      include: {
        client: { select: { name: true, phoneEnc: true } },
        items: { select: { serviceName: true } },
      },
      orderBy: { startAt: "asc" },
    }),
    prisma.service.findMany({
      where: { businessId: user.businessId, archived: false },
      select: { id: true, name: true, durationMin: true },
      orderBy: { name: "asc" },
    }),
  ]);

  function shiftDate(days: number): string {
    const next = new Date(`${dateStr}T12:00:00Z`);
    next.setUTCDate(next.getUTCDate() + days);
    return next.toISOString().slice(0, 10);
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <AgendaView
        date={dateStr}
        prevDate={shiftDate(-1)}
        nextDate={shiftDate(1)}
        timezone={tz}
        services={services}
        appointments={appointments.map((a) => ({
          id: a.id,
          startAt: a.startAt.toISOString(),
          endAt: a.endAt.toISOString(),
          status: a.status,
          source: a.source,
          notes: a.notes ?? "",
          clientName: a.client.name,
          clientPhone: a.client.phoneEnc ? decryptPiiSafe(a.client.phoneEnc) : null,
          services: a.items.map((i) => i.serviceName),
        }))}
      />
    </div>
  );
}

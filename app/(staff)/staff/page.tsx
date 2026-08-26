import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { Role } from "@/lib/generated/prisma/client";
import { StaffAgenda } from "@/components/staff/staff-agenda";

export const metadata: Metadata = { title: "A minha agenda" };

export default async function StaffHomePage({
  searchParams,
}: PageProps<"/staff">) {
  const user = await getAuthUser();
  if (!user) redirect("/entrar");
  if (user.role === Role.ADMIN) redirect("/admin");
  if (user.role !== Role.STAFF) redirect("/");

  const staff = await prisma.staff.findFirst({
    where: { userId: user.id, active: true },
    include: { business: { select: { timezone: true, name: true } } },
  });
  if (!staff) redirect("/entrar");

  const { data: dataParam } = await searchParams;
  const tz = staff.business.timezone;
  const todayStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const dateStr =
    typeof dataParam === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dataParam)
      ? dataParam
      : todayStr;

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

  const appointments = await prisma.appointment.findMany({
    where: {
      staffId: staff.id,
      startAt: { gte: dayStart, lt: dayEnd },
      status: { in: ["PENDING", "CONFIRMED", "COMPLETED", "NO_SHOW"] },
      client: { phoneEnc: { not: null } },
    },
    include: {
      client: { select: { name: true } },
      items: { select: { serviceName: true } },
    },
    orderBy: { startAt: "asc" },
  });

  function shiftDate(days: number): string {
    const next = new Date(`${dateStr}T12:00:00Z`);
    next.setUTCDate(next.getUTCDate() + days);
    return next.toISOString().slice(0, 10);
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-semibold">
          Olá, {staff.displayName}
        </h1>
        <Link
          href="/staff/horario"
          className="rounded-full border border-border bg-card px-4 py-2 text-sm transition-colors hover:border-primary/40 hover:text-primary"
        >
          Bloquear horários
        </Link>
      </div>

      <StaffAgenda
        date={dateStr}
        prevDate={shiftDate(-1)}
        nextDate={shiftDate(1)}
        timezone={tz}
        appointments={appointments.map((a) => ({
          id: a.id,
          startAt: a.startAt.toISOString(),
          endAt: a.endAt.toISOString(),
          status: a.status,
          clientName: a.client.name,
          services: a.items.map((i) => i.serviceName),
        }))}
      />
    </div>
  );
}

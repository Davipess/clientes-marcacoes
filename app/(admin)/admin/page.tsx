import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { nowZoned, zonedToUtc } from "@/lib/booking/time";
import { formatEuros } from "@/lib/format";

export const metadata: Metadata = { title: "Início — Administração" };

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendente",
  CONFIRMED: "Confirmada",
  COMPLETED: "Concluída",
  CANCELLED: "Cancelada",
  NO_SHOW: "Não compareceu",
};

export default async function AdminHomePage() {
  const user = await getAuthUser();
  if (!user?.businessId) redirect("/entrar");

  const business = await prisma.business.findUniqueOrThrow({
    where: { id: user.businessId },
    include: { settings: true },
  });
  const tz = business.timezone;

  const today = nowZoned(tz);
  const todayStart = zonedToUtc(today.year, today.month, today.day, 0, 0, tz);
  const tomorrowStart = new Date(todayStart.getTime() + 86_400_000);
  const weekEnd = new Date(todayStart.getTime() + 7 * 86_400_000);
  const monthStart = zonedToUtc(today.year, today.month, 1, 0, 0, tz);
  const nextMonth =
    today.month === 12
      ? zonedToUtc(today.year + 1, 1, 1, 0, 0, tz)
      : zonedToUtc(today.year, today.month + 1, 1, 0, 0, tz);

  const [todayAppointments, upcoming, monthCompleted, clientCount] =
    await Promise.all([
      prisma.appointment.findMany({
        where: {
          businessId: business.id,
          startAt: { gte: todayStart, lt: tomorrowStart },
          status: { in: ["PENDING", "CONFIRMED", "COMPLETED", "NO_SHOW"] },
          client: { phoneEnc: { not: null } },
        },
        include: {
          client: { select: { name: true } },
          items: { select: { serviceName: true } },
        },
        orderBy: { startAt: "asc" },
      }),
      prisma.appointment.count({
        where: {
          businessId: business.id,
          startAt: { gte: tomorrowStart, lt: weekEnd },
          status: { in: ["PENDING", "CONFIRMED"] },
        },
      }),
      prisma.appointment.findMany({
        where: {
          businessId: business.id,
          status: "COMPLETED",
          startAt: { gte: monthStart, lt: nextMonth },
        },
        select: { items: { select: { unitPrice: true } } },
      }),
      prisma.client.count({ where: { businessId: business.id } }),
    ]);

  const monthRevenue = monthCompleted.reduce(
    (sum, appt) => sum + appt.items.reduce((s, item) => s + Number(item.unitPrice), 0),
    0,
  );

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="font-heading text-2xl font-semibold">
        Olá, {user.name.split(" ")[0]}
      </h1>

      {/* Stats */}
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Hoje", value: String(todayAppointments.length) },
          { label: "Próximos 7 dias", value: String(upcoming) },
          { label: "Receita do mês", value: formatEuros(monthRevenue) },
          { label: "Clientes", value: String(clientCount) },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-2xl border border-border/70 bg-card p-4"
          >
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {stat.label}
            </p>
            <p className="mt-1 text-xl font-semibold tabular-nums sm:text-2xl">
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* Today's appointments */}
      <section className="mt-8">
        <h2 className="font-heading text-lg font-semibold">Marcações de hoje</h2>
        {todayAppointments.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Sem marcações para hoje. Dia livre!
          </p>
        ) : (
          <ul className="stagger mt-3 space-y-2">
            {todayAppointments.map((appt) => {
              const start = appt.startAt.toLocaleTimeString("pt-PT", {
                hour: "2-digit",
                minute: "2-digit",
                timeZone: tz,
              });
              const end = appt.endAt.toLocaleTimeString("pt-PT", {
                hour: "2-digit",
                minute: "2-digit",
                timeZone: tz,
              });
              return (
                <li
                  key={appt.id}
                  className="flex items-center gap-4 rounded-2xl border border-border/70 bg-card p-4"
                >
                  <div className="w-24 shrink-0 text-sm font-semibold tabular-nums">
                    {start}–{end}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{appt.client.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {appt.items.map((i) => i.serviceName).join(" + ")}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${
                      appt.status === "COMPLETED"
                        ? "bg-green-100 text-green-800"
                        : appt.status === "CANCELLED" || appt.status === "NO_SHOW"
                          ? "bg-red-100 text-red-700"
                          : "bg-secondary text-secondary-foreground"
                    }`}
                  >
                    {STATUS_LABELS[appt.status]}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/admin/servicos"
          className="rounded-full border border-border bg-card px-5 py-2.5 text-sm font-medium transition-colors hover:border-primary/40 hover:text-primary"
        >
          Gerir serviços
        </Link>
        <Link
          href="/admin/clientes"
          className="rounded-full border border-border bg-card px-5 py-2.5 text-sm font-medium transition-colors hover:border-primary/40 hover:text-primary"
        >
          Ver clientes
        </Link>
      </div>
    </div>
  );
}

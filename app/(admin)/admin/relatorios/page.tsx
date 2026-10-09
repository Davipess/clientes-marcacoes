import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { nowZoned, zonedToUtc } from "@/lib/booking/time";
import { formatEuros } from "@/lib/format";

export const metadata: Metadata = { title: "Relatórios, Administração" };

export default async function RelatoriosPage({
  searchParams,
}: PageProps<"/admin/relatorios">) {
  const user = await getAuthUser();
  if (!user?.businessId) redirect("/entrar");

  const { periodo } = await searchParams;
  const preset = periodo === "semana" || periodo === "mes" ? periodo : "mes";

  const business = await prisma.business.findUniqueOrThrow({
    where: { id: user.businessId },
    select: { timezone: true },
  });
  const tz = business.timezone;

  const today = nowZoned(tz);
  const todayStart = zonedToUtc(today.year, today.month, today.day, 0, 0, tz);
  const periodStart =
    preset === "semana"
      ? new Date(todayStart.getTime() - 6 * 86_400_000)
      : preset === "mes"
        ? zonedToUtc(today.year, today.month, 1, 0, 0, tz)
        : todayStart;
  const prevPeriodStart =
    preset === "semana"
      ? new Date(periodStart.getTime() - 7 * 86_400_000)
      : preset === "mes"
        ? new Date(
            today.month === 1
              ? zonedToUtc(today.year - 1, 12, 1, 0, 0, tz).getTime()
              : zonedToUtc(today.year, today.month - 1, 1, 0, 0, tz).getTime(),
          )
        : todayStart;

    const [completed, periodAppointments, prevCompleted] =
    await Promise.all([
      prisma.appointment.findMany({
        where: {
          businessId: user.businessId,
          status: "COMPLETED",
          startAt: { gte: periodStart },
        },
        select: { items: { select: { unitPrice: true, serviceName: true } } },
      }),
      prisma.appointment.findMany({
        where: {
          businessId: user.businessId,
          startAt: { gte: periodStart },
        },
        select: { status: true },
      }),
      prisma.appointment.findMany({
        where: {
          businessId: user.businessId,
          status: "COMPLETED",
          startAt: { gte: prevPeriodStart, lt: periodStart },
        },
        select: { items: { select: { unitPrice: true } } },
      }),
      prisma.service.findMany({
        where: { businessId: user.businessId },
        select: { id: true, name: true },
      }),
    ]);

  const revenue = completed.reduce(
    (sum, a) => sum + a.items.reduce((s, i) => s + Number(i.unitPrice), 0),
    0,
  );
  const prevRevenue = prevCompleted.reduce(
    (sum, a) => sum + a.items.reduce((s, i) => s + Number(i.unitPrice), 0),
    0,
  );

  // Most-booked services in the period (from appointment items).
  const serviceCounts = new Map<string, number>();
  for (const appt of completed) {
    for (const item of appt.items) {
      serviceCounts.set(
        item.serviceName,
        (serviceCounts.get(item.serviceName) ?? 0) + 1,
      );
    }
  }
  const topServices = [...serviceCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const total = periodAppointments.length || 1;
  const cancelled = periodAppointments.filter((a) => a.status === "CANCELLED").length;
  const noShows = periodAppointments.filter((a) => a.status === "NO_SHOW").length;
  const completedCount = periodAppointments.filter((a) => a.status === "COMPLETED").length;

  const revenueDelta =
    prevRevenue > 0
      ? Math.round(((revenue - prevRevenue) / prevRevenue) * 100)
      : null;

  const periodLabel =
    preset === "semana" ? "últimos 7 dias" : preset === "mes" ? "este mês" : "hoje";

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-2xl font-semibold">Relatórios</h1>
        <div className="flex gap-2">
          {(
            [
              ["semana", "7 dias"],
              ["mes", "Este mês"],
            ] as const
          ).map(([key, label]) => (
            <a
              key={key}
              href={`/admin/relatorios?periodo=${key}`}
              className={`rounded-full px-4 py-2 text-sm transition-colors ${
                preset === key
                  ? "bg-primary text-primary-foreground"
                  : "border border-border bg-card hover:border-primary/40"
              }`}
            >
              {label}
            </a>
          ))}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          {
            label: `Receita (${periodLabel})`,
            value: formatEuros(revenue),
            extra:
              revenueDelta === null
                ? undefined
                : `${revenueDelta >= 0 ? "▲" : "▼"} ${Math.abs(revenueDelta)}% vs. período anterior`,
          },
          { label: "Marcações", value: String(periodAppointments.length) },
          {
            label: "Taxa de cancelamento",
            value: `${Math.round((cancelled / total) * 100)}%`,
          },
          {
            label: "Taxa de faltas",
            value: `${Math.round((noShows / total) * 100)}%`,
          },
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
            {stat.extra && (
              <p
                className={`mt-0.5 text-xs ${
                  stat.extra.startsWith("▲") ? "text-green-700" : "text-red-700"
                }`}
              >
                {stat.extra}
              </p>
            )}
          </div>
        ))}
      </div>

      <section className="mt-8">
        <h2 className="font-heading text-lg font-semibold">
          Serviços mais realizados ({periodLabel})
        </h2>
        {topServices.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Ainda sem serviços concluídos neste período.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {topServices.map(([name, count], i) => (
              <li
                key={name}
                className="flex items-center gap-4 rounded-2xl border border-border/70 bg-card p-4"
              >
                <span className="font-heading text-lg font-semibold text-primary">
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1 truncate font-medium">{name}</span>
                <span className="text-sm tabular-nums text-muted-foreground">
                  {count}× · {Math.round((count / (completedCount || 1)) * 100)}%
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <p className="mt-4 text-xs text-muted-foreground">
        Receita baseada em marcações concluídas (pagamento reconciliado no
        local). Período atual: {periodLabel}.
      </p>

      {/* Revenue by service */}
      <section className="mt-8">
        <h2 className="font-heading text-lg font-semibold">
          Receita por serviço ({periodLabel})
        </h2>
        {topServices.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Ainda sem dados de receita.
          </p>
        ) : (
          <div className="mt-3 space-y-3">
            {(() => {
              const serviceRevenue = new Map<string, number>();
              for (const appt of completed) {
                for (const item of appt.items) {
                  serviceRevenue.set(
                    item.serviceName,
                    (serviceRevenue.get(item.serviceName) ?? 0) + Number(item.unitPrice),
                  );
                }
              }
              const sorted = [...serviceRevenue.entries()].sort((a, b) => b[1] - a[1]);
              const maxRevenue = sorted[0]?.[1] ?? 1;
              return sorted.map(([name, rev]) => (
                <div key={name} className="flex items-center gap-3">
                  <div className="w-32 truncate text-sm font-medium">{name}</div>
                  <div className="flex-1">
                    <div className="h-6 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${Math.max((rev / maxRevenue) * 100, 4)}%` }}
                      />
                    </div>
                  </div>
                  <div className="w-20 text-right text-sm font-medium tabular-nums">
                    {formatEuros(rev)}
                  </div>
                </div>
              ));
            })()}
          </div>
        )}
      </section>

      {/* Monthly revenue last 6 months */}
      <section className="mt-8">
        <h2 className="font-heading text-lg font-semibold">Receita dos últimos 6 meses</h2>
        <MonthlyRevenueChart businessId={user.businessId} tz={tz} />
      </section>
    </div>
  );
}

async function MonthlyRevenueChart({ businessId, tz }: { businessId: string; tz: string }) {
  const months: { label: string; start: Date; end: Date }[] = [];
  const now = nowZoned(tz);
  for (let i = 5; i >= 0; i--) {
    const m = now.month - i;
    const y = now.year + Math.floor((m - 1) / 12);
    const adjM = ((m - 1) % 12) + 1;
    const start = zonedToUtc(y, adjM, 1, 0, 0, tz);
    const end = adjM === 12 ? zonedToUtc(y + 1, 1, 1, 0, 0, tz) : zonedToUtc(y, adjM + 1, 1, 0, 0, tz);
    const label = new Date(y, adjM - 1).toLocaleDateString("pt-PT", { month: "short" });
    months.push({ label, start, end });
  }

  const revenues = await Promise.all(
    months.map(async (m) => {
      const completed = await prisma.appointment.findMany({
        where: { businessId, status: "COMPLETED", startAt: { gte: m.start, lt: m.end } },
        select: { items: { select: { unitPrice: true } } },
      });
      return completed.reduce((sum, a) => sum + a.items.reduce((s, i) => s + Number(i.unitPrice), 0), 0);
    }),
  );

  const maxRev = Math.max(...revenues, 1);

  return (
    <div className="mt-3 flex items-end gap-2 rounded-2xl border border-border/70 bg-card p-4" style={{ height: 200 }}>
      {months.map((m, i) => (
        <div key={m.label} className="flex flex-1 flex-col items-center gap-1">
          <div className="text-[10px] tabular-nums text-muted-foreground">{formatEuros(revenues[i])}</div>
          <div
            className="w-full rounded-t-md bg-primary transition-all"
            style={{ height: `${Math.max((revenues[i] / maxRev) * 120, 2)}px` }}
          />
          <div className="text-[10px] text-muted-foreground">{m.label}</div>
        </div>
      ))}
    </div>
  );
}

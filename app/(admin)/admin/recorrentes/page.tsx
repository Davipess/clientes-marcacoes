import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { RecurringBookingForm } from "@/components/admin/recurring-booking-form";

export const metadata: Metadata = { title: "Marcações Recorrentes — Administração" };

const FREQUENCIES: Record<string, string> = {
  weekly: "Semanal",
  biweekly: "Quinzenal",
  monthly: "Mensal",
};

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export default async function RecorrentesPage() {
  const user = await getAuthUser();
  if (!user?.businessId) redirect("/entrar");

  const [rules, clients, staff, services] = await Promise.all([
    prisma.recurringRule.findMany({
      where: { businessId: user.businessId },
      include: {
        client: { select: { name: true, phoneEnc: true } },
        staff: { select: { displayName: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.client.findMany({
      where: { businessId: user.businessId, phoneEnc: { not: null } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.staff.findMany({
      where: { businessId: user.businessId, active: true },
      select: { id: true, displayName: true },
      orderBy: { displayName: "asc" },
    }),
    prisma.service.findMany({
      where: { businessId: user.businessId, archived: false },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  // Filter out minimized clients
  const activeRules = rules.filter((r) => r.client.phoneEnc);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="font-heading text-2xl font-semibold">Marcações Recorrentes</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Clientes com marcações automáticas regulares.
      </p>

      {/* Create form */}
      <div className="mt-6">
        <h2 className="font-heading text-lg font-semibold">Nova recorrência</h2>
        <div className="mt-3">
          <RecurringBookingForm
            clients={clients}
            staff={staff}
            services={services}
          />
        </div>
      </div>

      {/* Existing rules */}
      <section className="mt-8">
        <h2 className="font-heading text-lg font-semibold">Recorrências ativas</h2>
        {activeRules.length === 0 ? (
          <div className="mt-3 rounded-xl border border-dashed bg-card p-8 text-center">
            <p className="text-sm text-muted-foreground">Nenhuma marcação recorrente ativa.</p>
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            {activeRules.map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-xl border bg-card p-4">
                <div>
                  <div className="font-medium">{r.client.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {FREQUENCIES[r.frequency] ?? r.frequency} ·{" "}
                    {r.dayOfWeek !== null ? WEEKDAYS[r.dayOfWeek] : `Dia ${r.dayOfMonth}`} · {r.timeOfDay}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Técnica: {r.staff.displayName}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    r.active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"
                  }`}>
                    {r.active ? "Ativa" : "Inativa"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

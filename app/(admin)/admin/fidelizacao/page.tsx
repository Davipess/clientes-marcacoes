import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { RewardForm } from "@/components/admin/reward-form";

export const metadata: Metadata = { title: "Fidelização — Administração" };

export default async function FidelizacaoPage() {
  const user = await getAuthUser();
  if (!user?.businessId) redirect("/entrar");

  const [cardCount, totalPoints, rewards] = await Promise.all([
    prisma.loyaltyCard.count({ where: { businessId: user.businessId } }),
    prisma.loyaltyCard.aggregate({
      where: { businessId: user.businessId },
      _sum: { points: true },
    }),
    prisma.loyaltyReward.findMany({
      where: { businessId: user.businessId },
      orderBy: { pointsCost: "asc" },
    }),
  ]);

  const activeRewards = rewards.filter((r) => r.active);
  const totalPointsValue = totalPoints._sum.points ?? 0;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="font-heading text-2xl font-semibold">Programa de Fidelização</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Clientes acumulam pontos a cada marcação e trocam por recompensas.
      </p>

      {/* Stats */}
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border bg-card p-4">
          <div className="text-xs text-muted-foreground">Clientes inscritos</div>
          <div className="mt-1 text-2xl font-bold">{cardCount}</div>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="text-xs text-muted-foreground">Pontos em circulação</div>
          <div className="mt-1 text-2xl font-bold">{totalPointsValue}</div>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="text-xs text-muted-foreground">Recompensas ativas</div>
          <div className="mt-1 text-2xl font-bold">{activeRewards.length}</div>
        </div>
      </div>

      {/* Rewards management */}
      <section className="mt-8">
        <h2 className="font-heading text-lg font-semibold">Recompensas</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Crie recompensas que os clientes podem trocar com os seus pontos.
        </p>
        <div className="mt-4">
          <RewardForm />
        </div>
        {activeRewards.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Ainda não existem recompensas. Crie a primeira acima.
          </p>
        ) : (
          <div className="mt-4 space-y-2">
            {activeRewards.map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-xl border bg-card p-4">
                <div>
                  <div className="font-medium">{r.name}</div>
                  {r.description && (
                    <div className="text-xs text-muted-foreground">{r.description}</div>
                  )}
                </div>
                <div className="text-sm font-semibold text-primary">{r.pointsCost} pts</div>
              </div>
            ))}
          </div>
        )}
        {rewards.some((r) => !r.active) && (
          <details className="mt-4">
            <summary className="cursor-pointer text-sm text-muted-foreground">
              Recompensas inativas ({rewards.filter((r) => !r.active).length})
            </summary>
            <div className="mt-2 space-y-2">
              {rewards
                .filter((r) => !r.active)
                .map((r) => (
                  <div key={r.id} className="flex items-center justify-between rounded-xl border bg-card p-4 opacity-60">
                    <div className="font-medium line-through">{r.name}</div>
                    <div className="text-sm text-muted-foreground">{r.pointsCost} pts</div>
                  </div>
                ))}
            </div>
          </details>
        )}
      </section>
    </div>
  );
}

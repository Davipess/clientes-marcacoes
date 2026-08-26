import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Fidelização — Administração" };

export default async function FidelizacaoPage() {
  const user = await getAuthUser();
  if (!user?.businessId) redirect("/entrar");

  const cards = await prisma.loyaltyCard.findMany({
    where: { businessId: user.businessId },
    include: {
      client: { select: { id: true, name: true } },
    },
    orderBy: { points: "desc" },
  });

  const rewards = await prisma.loyaltyReward.findMany({
    where: { businessId: user.businessId },
    orderBy: { pointsCost: "asc" },
  });

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="font-heading text-2xl font-semibold">Programa de Fidelização</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Clientes ganham pontos a cada marcação e trocam por recompensas.
      </p>

      {/* Stats */}
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border bg-card p-4">
          <div className="text-xs text-muted-foreground">Clientes com cartão</div>
          <div className="mt-1 text-2xl font-bold">{cards.length}</div>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="text-xs text-muted-foreground">Total de pontos em circulação</div>
          <div className="mt-1 text-2xl font-bold">{cards.reduce((s, c) => s + c.points, 0)}</div>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="text-xs text-muted-foreground">Recompensas ativas</div>
          <div className="mt-1 text-2xl font-bold">{rewards.length}</div>
        </div>
      </div>

      {/* Cards */}
      <section className="mt-8">
        <h2 className="font-heading text-lg font-semibold">Cartões de Fidelização</h2>
        {cards.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Ainda nenhum cliente aderiu ao programa.
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {cards.map((card) => (
              <div key={card.id} className="flex items-center justify-between rounded-xl border bg-card p-4">
                <div>
                  <div className="font-medium">{card.client.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {card.totalEarned} ganhos · {card.points} disponíveis
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-primary">{card.points}</div>
                  <div className="text-[10px] text-muted-foreground">pontos</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Rewards */}
      <section className="mt-8">
        <h2 className="font-heading text-lg font-semibold">Recompensas</h2>
        {rewards.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Crie recompensas que os clientes podem trocar com os seus pontos.
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {rewards.map((r) => (
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
      </section>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";

interface Voucher {
  id: string;
  rewardName: string;
  pointsCost: number;
}

interface LoyaltyData {
  points: number;
  totalEarned: number;
  rewards: { id: string; name: string; pointsCost: number }[];
  vouchers: Voucher[];
}

export function ClientLoyaltyPrompt({
  businessId,
  phone,
}: {
  businessId: string;
  phone: string;
}) {
  const [data, setData] = useState<LoyaltyData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!businessId || !phone) return;
    let cancelled = false;
    fetch(`/api/loyalty?businessId=${encodeURIComponent(businessId)}&phone=${encodeURIComponent(phone)}`)
      .then((r) => r.json())
      .then((json) => { if (!cancelled) setData(json); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [businessId, phone]);

  if (loading) return null;
  if (!data) return null;

  const nextReward = data.rewards.find((r) => r.pointsCost > data.points);
  const progress = nextReward
    ? Math.min((data.points / nextReward.pointsCost) * 100, 100)
    : 100;

  return (
    <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-center">
      <p className="text-sm font-medium">Programa de Fidelização</p>
      <div className="mt-2">
        <span className="text-3xl font-bold text-primary">{data.points}</span>
        <span className="ml-1 text-sm text-muted-foreground">pontos</span>
      </div>
      {data.totalEarned > 0 && (
        <p className="mt-1 text-xs text-muted-foreground">
          {data.totalEarned} pontos ganhos no total
        </p>
      )}
      {nextReward && (
        <div className="mt-3">
          <div className="mx-auto h-2 w-32 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {data.points} / {nextReward.pointsCost} para{" "}
            <strong>{nextReward.name}</strong>
          </p>
        </div>
      )}
      {data.vouchers.length > 0 && (
        <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 p-2">
          <p className="text-xs font-medium text-amber-800">
            Tem {data.vouchers.length} vale(s) ativo(s)!
          </p>
          <p className="text-xs text-amber-700">
            Apresente-o à dona do salão e utilize na sua presença.
          </p>
        </div>
      )}
      {data.rewards.length > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          Troque os seus pontos por:{" "}
          {data.rewards.map((r) => r.name).join(", ")}
        </p>
      )}
    </div>
  );
}

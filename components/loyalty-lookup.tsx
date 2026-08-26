"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface LoyaltyData {
  points: number;
  totalEarned: number;
  rewards: { id: string; name: string; pointsCost: number }[];
}

export function LoyaltyLookup({ businessId }: { businessId: string }) {
  const [phone, setPhone] = useState("");
  const [data, setData] = useState<LoyaltyData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  async function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    if (!phone) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/loyalty?businessId=${encodeURIComponent(businessId)}&phone=${encodeURIComponent(phone)}`,
      );
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Erro ao consultar.");
        return;
      }
      setData(json);
      setSearched(true);
    } catch {
      setError("Erro de rede.");
    } finally {
      setLoading(false);
    }
  }

  // Find next reward
  const nextReward = data?.rewards.find((r) => r.pointsCost > (data?.points ?? 0));
  const progress =
    data && nextReward
      ? Math.min((data.points / nextReward.pointsCost) * 100, 100)
      : 100;

  return (
    <div className="rounded-2xl border bg-card p-6">
      <h3 className="font-heading text-lg font-semibold">Consultar Pontos</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Insira o seu número de telemóvel para ver os seus pontos de fidelidade.
      </p>

      <form onSubmit={(e) => void handleLookup(e)} className="mt-4 flex gap-2">
        <Input
          type="tel"
          inputMode="tel"
          placeholder="912 345 678"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          required
          className="flex-1"
        />
        <Button type="submit" disabled={loading || !phone} className="rounded-full">
          {loading ? "..." : "Consultar"}
        </Button>
      </form>

      <p className="mt-2 text-xs text-muted-foreground">
        Os pontos estão associados ao número de telemóvel. Se marcou com um
        número diferente, use esse número para consultar.
      </p>

      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

      {searched && data && (
        <div className="mt-4 rounded-xl bg-muted/50 p-4 text-center">
          <div className="text-3xl font-bold text-primary">{data.points}</div>
          <div className="text-sm text-muted-foreground">pontos disponíveis</div>
          {data.totalEarned > data.points && (
            <div className="mt-1 text-xs text-muted-foreground">
              {data.totalEarned} pontos ganhos no total
            </div>
          )}
          {nextReward && (
            <div className="mt-3">
              <div className="mx-auto h-2 w-32 overflow-hidden rounded-full bg-background">
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
          {data.rewards.length > 0 && (
            <div className="mt-3 text-xs text-muted-foreground">
              Troque por: {data.rewards.map((r) => r.name).join(", ")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

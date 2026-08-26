"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Voucher {
  id: string;
  rewardName: string;
  pointsCost: number;
  createdAt: string;
}

interface LoyaltyData {
  points: number;
  totalEarned: number;
  rewards: { id: string; name: string; description: string | null; pointsCost: number }[];
  vouchers: Voucher[];
}

export function LoyaltyLookup({ businessId }: { businessId: string }) {
  const [phone, setPhone] = useState("");
  const [data, setData] = useState<LoyaltyData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [redeeming, setRedeeming] = useState<string | null>(null);
  const [using, setUsing] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  async function fetchLoyalty() {
    const res = await fetch("/api/loyalty", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessId, phone }),
    });
    return res.json();
  }

  async function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    if (!phone) return;
    setLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const json = await fetchLoyalty();
      if (json.error) {
        setError(json.error);
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

  async function handleRedeem(rewardId: string) {
    setRedeeming(rewardId);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await fetch("/api/loyalty/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, phone, rewardId }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Erro ao resgatar.");
        return;
      }
      setSuccessMsg("Vale criado! Apresente-o à dona do salão quando chegar.");
      setData((prev) =>
        prev ? { ...prev, points: json.newBalance } : prev,
      );
      // Refresh to get new voucher
      const refresh = await fetchLoyalty();
      if (!refresh.error) setData(refresh);
    } catch {
      setError("Erro de rede.");
    } finally {
      setRedeeming(null);
    }
  }

  async function handleUseVoucher(voucherId: string) {
    setUsing(voucherId);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await fetch("/api/loyalty/voucher/use", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, phone, voucherId }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Erro ao utilizar vale.");
        return;
      }
      setSuccessMsg("Vale utilizado com sucesso!");
      const refresh = await fetchLoyalty();
      if (!refresh.error) setData(refresh);
    } catch {
      setError("Erro de rede.");
    } finally {
      setUsing(null);
    }
  }

  const nextReward = data?.rewards.find((r) => r.pointsCost > (data?.points ?? 0));
  const progress =
    data && nextReward
      ? Math.min((data.points / nextReward.pointsCost) * 100, 100)
      : 100;

  return (
    <div className="rounded-2xl border bg-card p-6">
      <h3 className="font-heading text-lg font-semibold">Consultar Pontos</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Insira o seu número de telemóvel para ver os seus pontos e vales.
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
      {successMsg && <p className="mt-3 text-sm text-green-600 font-medium">{successMsg}</p>}

      {searched && data && (
        <div className="mt-4 space-y-4">
          {/* Points balance */}
          <div className="rounded-xl bg-muted/50 p-4 text-center">
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
          </div>

          {/* Active vouchers */}
          {data.vouchers.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <h4 className="font-heading text-sm font-semibold text-amber-800">
                Vales Ativos
              </h4>
              <p className="mt-1 text-xs text-amber-700">
                Apresente o vale à dona do salão e pressione &quot;Utilizar&quot; na sua presença.
              </p>
              <div className="mt-3 space-y-2">
                {data.vouchers.map((v) => (
                  <div
                    key={v.id}
                    className="flex items-center justify-between rounded-lg bg-white p-3 shadow-sm"
                  >
                    <div>
                      <div className="font-medium text-sm">{v.rewardName}</div>
                      <div className="text-xs text-muted-foreground">
                        {v.pointsCost} pontos · {new Date(v.createdAt).toLocaleDateString("pt-PT")}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-full text-amber-700 border-amber-300 hover:bg-amber-100"
                      disabled={using === v.id}
                      onClick={() => void handleUseVoucher(v.id)}
                    >
                      {using === v.id ? "..." : "Utilizar"}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Redeemable rewards */}
          {data.rewards.length > 0 && (
            <div className="rounded-xl bg-muted/50 p-4">
              <h4 className="font-heading text-sm font-semibold">
                Recompensas Disponíveis
              </h4>
              <div className="mt-2 space-y-2">
                {data.rewards.map((r) => {
                  const canRedeem = data.points >= r.pointsCost;
                  return (
                    <div
                      key={r.id}
                      className="flex items-center justify-between rounded-lg bg-white p-3 shadow-sm"
                    >
                      <div>
                        <div className="font-medium text-sm">{r.name}</div>
                        {r.description && (
                          <div className="text-xs text-muted-foreground">{r.description}</div>
                        )}
                        <div className="text-xs text-muted-foreground">
                          {r.pointsCost} pontos
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant={canRedeem ? "default" : "outline"}
                        className="rounded-full"
                        disabled={!canRedeem || redeeming === r.id}
                        onClick={() => void handleRedeem(r.id)}
                      >
                        {redeeming === r.id ? "..." : canRedeem ? "Resgatar" : `${r.pointsCost} pts`}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

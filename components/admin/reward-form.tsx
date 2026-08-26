"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function RewardForm({ onCreated }: { onCreated?: () => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [pointsCost, setPointsCost] = useState(10);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/loyalty", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "createReward", name, description: description || undefined, pointsCost }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Erro ao criar recompensa.");
        return;
      }
      setSuccess(true);
      setName("");
      setDescription("");
      setPointsCost(10);
      onCreated?.();
    } catch {
      setError("Erro de rede.");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="rounded-2xl border border-green-200 bg-green-50 p-4 text-center">
        <p className="text-sm font-medium text-green-800">✅ Recompensa criada!</p>
        <button
          type="button"
          onClick={() => setSuccess(false)}
          className="mt-2 text-xs text-green-700 underline"
        >
          Criar outra
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3 rounded-2xl border bg-card p-4">
      <div>
        <Label htmlFor="reward-name">Nome da recompensa *</Label>
        <Input
          id="reward-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          minLength={1}
          maxLength={100}
          placeholder="Ex: Manicure gratuita"
          className="mt-1"
        />
      </div>
      <div>
        <Label htmlFor="reward-desc">Descrição (opcional)</Label>
        <Input
          id="reward-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={500}
          placeholder="Ex: Troque 50 pontos por uma manicure"
          className="mt-1"
        />
      </div>
      <div>
        <Label htmlFor="reward-cost">Custo em pontos *</Label>
        <Input
          id="reward-cost"
          type="number"
          min={1}
          max={10000}
          value={pointsCost}
          onChange={(e) => setPointsCost(Number(e.target.value))}
          required
          className="mt-1"
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={loading || !name} className="w-full rounded-full" size="sm">
        {loading ? "A criar..." : "Criar recompensa"}
      </Button>
    </form>
  );
}

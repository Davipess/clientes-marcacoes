"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Block = {
  id: string;
  startAt: string;
  endAt: string;
  reason: string;
};

export function BlockManager({ blocks }: { blocks: Block[] }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/staff/blocos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Erro ao criar o bloqueio.");
        return;
      }
      form.reset();
      router.refresh();
    } catch {
      setError("Erro de rede.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    setError(null);
    try {
      const res = await fetch("/api/staff/blocos", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) {
        const json = await res.json();
        setError(json.error ?? "Erro ao remover.");
        return;
      }
      router.refresh();
    } catch {
      setError("Erro de rede.");
    }
  }

  return (
    <>
      <form onSubmit={submit} className="mt-6 space-y-4 rounded-2xl border border-border/70 bg-card p-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label htmlFor="bl-data">Dia *</Label>
            <Input id="bl-data" name="data" type="date" required className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor="bl-inicio">Das *</Label>
            <Input id="bl-inicio" name="inicio" type="time" required step={900} className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor="bl-fim">Até *</Label>
            <Input id="bl-fim" name="fim" type="time" required step={900} className="mt-1.5" />
          </div>
        </div>
        <div>
          <Label htmlFor="bl-motivo">Motivo (opcional)</Label>
          <Input id="bl-motivo" name="motivo" maxLength={200} placeholder="Almoço, consulta, pessoal..." className="mt-1.5" />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" disabled={saving} className="rounded-full px-6">
          {saving ? "A guardar..." : "Bloquear"}
        </Button>
      </form>

      <h2 className="mt-8 font-heading text-lg font-semibold">Bloqueios ativos</h2>
      <ul className="mt-3 space-y-2">
        {blocks.length === 0 && (
          <li className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Sem bloqueios futuros.
          </li>
        )}
        {blocks.map((block) => {
          const start = new Date(block.startAt).toLocaleString("pt-PT", {
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          });
          const end = new Date(block.endAt).toLocaleString("pt-PT", {
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          });
          return (
            <li
              key={block.id}
              className="flex items-center justify-between gap-3 rounded-2xl border border-border/70 bg-card p-4"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium tabular-nums">
                  {start} → {end}
                </p>
                {block.reason && (
                  <p className="truncate text-xs text-muted-foreground">{block.reason}</p>
                )}
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="rounded-full text-destructive hover:text-destructive"
                onClick={() => remove(block.id)}
              >
                Remover
              </Button>
            </li>
          );
        })}
      </ul>
    </>
  );
}

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

interface Reward {
  id: string;
  name: string;
  description: string | null;
  pointsCost: number;
  active: boolean;
}

export function RewardList({
  rewards,
  onDeleted,
}: {
  rewards: Reward[];
  onDeleted?: () => void;
}) {
  const [deleting, setDeleting] = useState<string | null>(null);

  async function handleDelete(id: string) {
    if (!confirm("Eliminar esta recompensa?")) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/admin/loyalty?id=${id}`, {
        method: "DELETE",
      });
      if (res.ok) onDeleted?.();
    } finally {
      setDeleting(null);
    }
  }

  const active = rewards.filter((r) => r.active);
  const inactive = rewards.filter((r) => !r.active);

  return (
    <div>
      {active.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Ainda não existem recompensas. Crie a primeira acima.
        </p>
      ) : (
        <div className="space-y-2">
          {active.map((r) => (
            <div key={r.id} className="flex items-center justify-between rounded-xl border bg-card p-4">
              <div className="min-w-0 flex-1">
                <div className="font-medium">{r.name}</div>
                {r.description && (
                  <div className="text-xs text-muted-foreground">{r.description}</div>
                )}
              </div>
              <div className="flex items-center gap-3">
                <div className="text-sm font-semibold text-primary">{r.pointsCost} pts</div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void handleDelete(r.id)}
                  disabled={deleting === r.id}
                  className="text-destructive hover:text-destructive"
                >
                  {deleting === r.id ? "..." : "Eliminar"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
      {inactive.length > 0 && (
        <details className="mt-4">
          <summary className="cursor-pointer text-sm text-muted-foreground">
            Recompensas inativas ({inactive.length})
          </summary>
          <div className="mt-2 space-y-2">
            {inactive.map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-xl border bg-card p-4 opacity-60">
                <div className="font-medium line-through">{r.name}</div>
                <div className="text-sm text-muted-foreground">{r.pointsCost} pts</div>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

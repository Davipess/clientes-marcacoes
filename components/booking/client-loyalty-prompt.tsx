"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function ClientLoyaltyPrompt() {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-center">
      <p className="text-sm font-medium">🎉 Ganhe pontos de fidelidade!</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Com cada marcação concluída, acumula pontos para trocar por recompensas.
      </p>
      <div className="mt-3 flex justify-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setDismissed(true)}
          className="rounded-full"
        >
          Depois
        </Button>
      </div>
    </div>
  );
}

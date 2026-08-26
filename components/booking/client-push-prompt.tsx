"use client";

import { useState } from "react";
import { usePushSubscription } from "@/lib/use-push";

export function ClientPushPrompt() {
  const { supported, subscribed, loading, subscribe } = usePushSubscription();
  const [asked, setAsked] = useState(false);

  if (!supported || loading || subscribed || asked) return null;

  return (
    <div className="rounded-xl border border-dashed border-primary/30 bg-primary/5 p-4">
      <p className="text-sm text-muted-foreground">
        Quer receber um lembrete 1 hora antes da sua marcação?
      </p>
      <button
        type="button"
        onClick={async () => {
          try {
            const res = await fetch("/api/push/vapid-key");
            const { key } = await res.json();
            await subscribe(key);
          } catch { /* silent */ }
          setAsked(true);
        }}
        className="mt-2 rounded-full bg-primary px-4 py-1.5 text-xs font-medium text-white hover:bg-primary/90 transition-colors"
      >
        Ativar lembretes
      </button>
    </div>
  );
}

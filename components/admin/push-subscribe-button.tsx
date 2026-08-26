"use client";

import { usePushSubscription } from "@/lib/use-push";

export function PushSubscribeButton({ vapidPublicKey }: { vapidPublicKey: string }) {
  const { supported, subscribed, loading, subscribe, unsubscribe } = usePushSubscription();

  if (!supported || loading) return null;

  return (
    <button
      type="button"
      onClick={() => (subscribed ? unsubscribe() : subscribe(vapidPublicKey))}
      className="rounded-full border px-4 py-2 text-sm font-medium transition-colors"
      style={{
        borderColor: subscribed ? "#16a34a" : "#d4d4d8",
        color: subscribed ? "#16a34a" : "#52525b",
        backgroundColor: subscribed ? "#f0fdf4" : "white",
      }}
    >
      {subscribed ? "Notificações ativadas" : "Ativar notificações"}
    </button>
  );
}

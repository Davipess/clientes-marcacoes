"use client";

import { useState, useEffect, useCallback } from "react";
import { Bell } from "lucide-react";

type Notification = {
  id: string;
  title: string;
  body: string;
  url: string;
  read: boolean;
  createdAt: string;
};

export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);

  const unread = notifications.filter((n) => !n.read).length;

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/notifications");
      if (res.ok) {
        const data = await res.json();
        const notifs = data.notifications ?? [];
        setNotifications(notifs);
      }
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      await load();
      if (!cancelled) {
        const interval = setInterval(load, 15_000);
        return () => clearInterval(interval);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [load]);

  const markRead = async (id: string) => {
    await fetch("/api/admin/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="relative rounded-full p-2 hover:bg-muted transition-colors"
        aria-label="Notificações"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-xl border bg-white shadow-lg">
          <div className="border-b p-3 font-medium text-sm">Notificações</div>
          {notifications.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              Sem notificações
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto">
              {notifications.slice(0, 20).map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => {
                    markRead(n.id);
                    if (n.url) window.location.href = n.url;
                    setOpen(false);
                  }}
                  className={`w-full border-b px-4 py-3 text-left text-sm hover:bg-muted/50 transition-colors ${
                    !n.read ? "bg-blue-50" : ""
                  }`}
                >
                  <div className="font-medium">{n.title}</div>
                  <div className="text-muted-foreground text-xs">{n.body}</div>
                  <div className="mt-1 text-[10px] text-muted-foreground">
                    {new Date(n.createdAt).toLocaleString("pt-PT")}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

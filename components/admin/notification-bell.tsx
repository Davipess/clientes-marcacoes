"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { Bell, X } from "lucide-react";

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
  const [mounted, setMounted] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const unread = notifications.filter((n) => !n.read).length;

  useEffect(() => { queueMicrotask(() => setMounted(true)); }, []);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/notifications");
      if (res.ok) {
        const data = await res.json();
        queueMicrotask(() => setNotifications(data.notifications ?? []));
      }
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let interval: ReturnType<typeof setInterval>;
    load().then(() => {
      if (!cancelled) interval = setInterval(load, 15_000);
    });
    return () => { cancelled = true; clearInterval(interval); };
  }, [load]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        btnRef.current && !btnRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const markRead = async (id: string) => {
    await fetch("/api/admin/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  const markAllRead = async () => {
    for (const n of notifications.filter((x) => !x.read)) {
      await fetch("/api/admin/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: n.id }),
      });
    }
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const panel = open ? (
    <div
      ref={panelRef}
      className="fixed top-16 right-4 z-[9999] w-[380px] max-w-[calc(100vw-2rem)] rounded-2xl border border-border/60 bg-white shadow-2xl"
    >
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h3 className="font-heading text-sm font-semibold">Notificações</h3>
        <div className="flex items-center gap-2">
          {unread > 0 && (
            <button
              type="button"
              onClick={markAllRead}
              className="text-xs text-primary hover:underline"
            >
              Marcar tudo como lido
            </button>
          )}
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-full p-1 hover:bg-muted transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {notifications.length === 0 ? (
        <div className="p-8 text-center text-sm text-muted-foreground">
          Sem notificações novas
        </div>
      ) : (
        <div className="max-h-[60vh] overflow-y-auto">
          {notifications.slice(0, 30).map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => {
                markRead(n.id);
                if (n.url) window.location.href = n.url;
                setOpen(false);
              }}
              className={`w-full border-b border-border/40 px-4 py-3 text-left transition-colors hover:bg-muted/50 ${
                !n.read ? "bg-primary/5" : ""
              }`}
            >
              <div className="flex items-start gap-3">
                {!n.read && (
                  <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-primary" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{n.title}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                    {n.body}
                  </div>
                  <div className="mt-1 text-[10px] text-muted-foreground">
                    {new Date(n.createdAt).toLocaleString("pt-PT", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  ) : null;

  return (
    <>
      <button
        ref={btnRef}
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
      {mounted && createPortal(panel, document.body)}
    </>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

type StaffAppointment = {
  id: string;
  startAt: string;
  endAt: string;
  status: string;
  clientName: string;
  services: string[];
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendente",
  CONFIRMED: "Confirmada",
  COMPLETED: "Concluída",
  CANCELLED: "Cancelada",
  NO_SHOW: "Não compareceu",
};

function statusClasses(status: string): string {
  if (status === "COMPLETED") return "bg-green-100 text-green-800";
  if (status === "CANCELLED" || status === "NO_SHOW") return "bg-red-100 text-red-700";
  return "bg-secondary text-secondary-foreground";
}

export function StaffAgenda({
  date,
  prevDate,
  nextDate,
  timezone,
  appointments,
}: {
  date: string;
  prevDate: string;
  nextDate: string;
  timezone: string;
  appointments: StaffAppointment[];
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pending, setPending] = useState<{ id: string; action: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pretty = new Date(`${date}T12:00:00Z`).toLocaleDateString("pt-PT", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  async function act(id: string, action: "COMPLETED" | "NO_SHOW") {
    if (!pending || pending.id !== id || pending.action !== action) {
      setPending({ id, action });
      return;
    }
    setPending(null);
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch("/api/staff/marcacoes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      if (!res.ok) {
        const json = await res.json();
        setError(json.error ?? "Erro.");
        return;
      }
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <h2 className="mt-6 font-heading text-lg font-semibold capitalize">{pretty}</h2>

      <div className="mt-3 flex items-center gap-2">
        <Link
          href={`/staff?data=${prevDate}`}
          className="rounded-full border border-border bg-card px-4 py-2 text-sm transition-colors hover:border-primary/40"
        >
          ← Anterior
        </Link>
        <Link
          href="/staff"
          className="rounded-full border border-border bg-card px-4 py-2 text-sm transition-colors hover:border-primary/40"
        >
          Hoje
        </Link>
        <Link
          href={`/staff?data=${nextDate}`}
          className="rounded-full border border-border bg-card px-4 py-2 text-sm transition-colors hover:border-primary/40"
        >
          Seguinte →
        </Link>
      </div>

      {error && (
        <p className="mt-4 rounded-xl bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <ul className="mt-5 space-y-3">
        {appointments.length === 0 && (
          <li className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Sem marcações neste dia.
          </li>
        )}
        {appointments.map((appt) => {
          const start = new Date(appt.startAt).toLocaleTimeString("pt-PT", {
            hour: "2-digit",
            minute: "2-digit",
            timeZone: timezone,
          });
          const end = new Date(appt.endAt).toLocaleTimeString("pt-PT", {
            hour: "2-digit",
            minute: "2-digit",
            timeZone: timezone,
          });
          const active = appt.status === "PENDING" || appt.status === "CONFIRMED";
          return (
            <li
              key={appt.id}
              className="rounded-2xl border border-border/70 bg-card p-4"
            >
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <span className="text-sm font-semibold tabular-nums">
                  {start}–{end}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{appt.clientName}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {appt.services.join(" + ")}
                  </p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-medium ${statusClasses(appt.status)}`}
                >
                  {STATUS_LABELS[appt.status]}
                </span>
              </div>
              {active && (
                <div className="mt-3 flex gap-2 border-t border-border/60 pt-3">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="rounded-full"
                    disabled={busyId === appt.id}
                    onClick={() => act(appt.id, "COMPLETED")}
                  >
                    {pending?.id === appt.id && pending.action === "COMPLETED"
                      ? "Confirmar conclusão?"
                      : "✓ Marcar como concluída"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="rounded-full"
                    disabled={busyId === appt.id}
                    onClick={() => act(appt.id, "NO_SHOW")}
                  >
                    {pending?.id === appt.id && pending.action === "NO_SHOW"
                      ? "Confirmar falta?"
                      : "Não compareceu"}
                  </Button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}

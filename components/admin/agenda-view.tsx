"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type AgendaAppointment = {
  id: string;
  startAt: string;
  endAt: string;
  status: string;
  source: string;
  notes: string;
  clientName: string;
  clientEmail: string | null;
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

export function AgendaView({
  date,
  prevDate,
  nextDate,
  timezone,
  services,
  appointments,
}: {
  date: string;
  prevDate: string;
  nextDate: string;
  timezone: string;
  services: { id: string; name: string; durationMin: number }[];
  appointments: AgendaAppointment[];
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pretty = new Date(`${date}T12:00:00Z`).toLocaleDateString("pt-PT", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  async function act(id: string, action: "COMPLETED" | "NO_SHOW" | "CANCEL") {
    const messages: Record<string, string> = {
      CANCEL: "Cancelar esta marcação?",
      NO_SHOW: "Marcar como não compareceu?",
      COMPLETED: "Marcar como concluída?",
    };
    if (!confirm(messages[action])) return;
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch("/api/admin/marcacoes", {
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

  async function createManual(formData: FormData) {
    setError(null);
    const time = String(formData.get("hora"));
    const res = await fetch("/api/admin/marcacoes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        servicos: formData.getAll("servicos"),
        inicio: wallToIso(date, time, timezone),
        nome: formData.get("nome"),
        email: formData.get("email"),
        notas: String(formData.get("notas")) || undefined,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Erro ao criar marcação.");
      return;
    }
    setShowNew(false);
    router.refresh();
  }

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-heading text-2xl font-semibold capitalize">{pretty}</h1>
        <Button
          type="button"
          onClick={() => setShowNew((s) => !s)}
          className="rounded-full px-5"
        >
          {showNew ? "Fechar" : "+ Marcação manual"}
        </Button>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <Link
          href={`/admin/agenda?data=${prevDate}`}
          className="rounded-full border border-border bg-card px-4 py-2 text-sm transition-colors hover:border-primary/40"
        >
          ← Anterior
        </Link>
        <Link
          href="/admin/agenda"
          className="rounded-full border border-border bg-card px-4 py-2 text-sm transition-colors hover:border-primary/40"
        >
          Hoje
        </Link>
        <Link
          href={`/admin/agenda?data=${nextDate}`}
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

      {/* Manual booking form */}
      {showNew && (
        <form
          action={createManual}
          className="animate-rise-in mt-6 space-y-4 rounded-2xl border border-border/70 bg-card p-5"
        >
          <h2 className="font-heading text-lg font-semibold">Nova marcação (walk-in / telefone)</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="ag-nome">Nome da cliente *</Label>
              <Input id="ag-nome" name="nome" required minLength={2} className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="ag-email">Email *</Label>
              <Input id="ag-email" name="email" type="email" required className="mt-1.5" />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="ag-hora">Hora de início *</Label>
              <Input id="ag-hora" name="hora" type="time" required step={900} defaultValue="10:00" className="mt-1.5" />
            </div>
            <div>
              <Label>Serviços * (mantenha Ctrl para vários)</Label>
              <select name="servicos" multiple required size={3} className="mt-1.5 w-full rounded-md border border-input bg-card px-3 py-2 text-sm">
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.durationMin} min)
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <Label htmlFor="ag-notas">Notas</Label>
            <Textarea id="ag-notas" name="notas" rows={2} maxLength={500} className="mt-1.5" />
          </div>
          <Button type="submit" className="rounded-full px-7">
            Criar marcação
          </Button>
        </form>
      )}

      {/* Day list */}
      <ul className="mt-6 space-y-3">
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
                  <p className="font-medium">
                    {appt.clientName}
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      {appt.clientEmail}
                      {appt.source === "ADMIN" && " · manual"}
                    </span>
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {appt.services.join(" + ")}
                  </p>
                  {appt.notes && (
                    <p className="mt-1 text-xs italic text-muted-foreground">“{appt.notes}”</p>
                  )}
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-medium ${statusClasses(appt.status)}`}
                >
                  {STATUS_LABELS[appt.status]}
                </span>
              </div>
              {active && (
                <div className="mt-3 flex flex-wrap gap-2 border-t border-border/60 pt-3">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="rounded-full"
                    disabled={busyId === appt.id}
                    onClick={() => act(appt.id, "COMPLETED")}
                  >
                    ✓ Concluída
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="rounded-full"
                    disabled={busyId === appt.id}
                    onClick={() => act(appt.id, "NO_SHOW")}
                  >
                    Não compareceu
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="rounded-full text-destructive hover:text-destructive"
                    disabled={busyId === appt.id}
                    onClick={() => act(appt.id, "CANCEL")}
                  >
                    Cancelar
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

function wallToIso(date: string, time: string, timeZone: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const parts: Record<string, string> = {};
  for (const p of dtf.formatToParts(new Date(guess))) parts[p.type] = p.value;
  const hour = parts.hour === "24" ? 0 : Number(parts.hour);
  const offset =
    Date.UTC(+parts.year, +parts.month - 1, +parts.day, hour, +parts.minute) - guess;
  return new Date(guess - offset).toISOString();
}

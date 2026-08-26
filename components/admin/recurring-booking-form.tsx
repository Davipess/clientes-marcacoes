"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface RecurringBookingFormProps {
  clients: { id: string; name: string }[];
  staff: { id: string; displayName: string }[];
  services: { id: string; name: string }[];
}

export function RecurringBookingForm({ clients, staff, services }: RecurringBookingFormProps) {
  const [clientId, setClientId] = useState("");
  const [staffId, setStaffId] = useState("");
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [frequency, setFrequency] = useState<"weekly" | "biweekly" | "monthly">("weekly");
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [timeOfDay, setTimeOfDay] = useState("10:00");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!clientId || !staffId || selectedServices.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/recurring", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          staffId,
          serviceIds: selectedServices,
          frequency,
          dayOfWeek: frequency !== "monthly" ? dayOfWeek : undefined,
          dayOfMonth: frequency === "monthly" ? dayOfMonth : undefined,
          timeOfDay,
          startDate: new Date().toISOString(),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Erro ao criar recorrência.");
        return;
      }
      setSuccess(true);
    } catch {
      setError("Erro de rede.");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="rounded-2xl border border-green-200 bg-green-50 p-4 text-center">
        <p className="text-sm font-medium text-green-800">✅ Marcação recorrente criada!</p>
        <p className="mt-1 text-xs text-green-700">
          As marcações serão geradas automaticamente.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4 rounded-2xl border bg-card p-4">
      <div>
        <Label>Cliente</Label>
        <select
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          className="mt-1 w-full rounded-xl border bg-background px-3 py-2 text-sm"
          required
        >
          <option value="">Selecionar cliente...</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      <div>
        <Label>Técnica</Label>
        <select
          value={staffId}
          onChange={(e) => setStaffId(e.target.value)}
          className="mt-1 w-full rounded-xl border bg-background px-3 py-2 text-sm"
          required
        >
          <option value="">Selecionar...</option>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>{s.displayName}</option>
          ))}
        </select>
      </div>

      <div>
        <Label>Serviços</Label>
        <div className="mt-1 space-y-1">
          {services.map((s) => (
            <label key={s.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={selectedServices.includes(s.id)}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedServices((prev) => [...prev, s.id]);
                  } else {
                    setSelectedServices((prev) => prev.filter((id) => id !== s.id));
                  }
                }}
                className="h-4 w-4 accent-[var(--primary)]"
              />
              {s.name}
            </label>
          ))}
        </div>
      </div>

      <div>
        <Label>Frequência</Label>
        <select
          value={frequency}
          onChange={(e) => setFrequency(e.target.value as typeof frequency)}
          className="mt-1 w-full rounded-xl border bg-background px-3 py-2 text-sm"
        >
          <option value="weekly">Semanal</option>
          <option value="biweekly">Quinzenal</option>
          <option value="monthly">Mensal</option>
        </select>
      </div>

      {frequency !== "monthly" && (
        <div>
          <Label>Dia da semana</Label>
          <select
            value={dayOfWeek}
            onChange={(e) => setDayOfWeek(Number(e.target.value))}
            className="mt-1 w-full rounded-xl border bg-background px-3 py-2 text-sm"
          >
            <option value={1}>Segunda-feira</option>
            <option value={2}>Terça-feira</option>
            <option value={3}>Quarta-feira</option>
            <option value={4}>Quinta-feira</option>
            <option value={5}>Sexta-feira</option>
            <option value={6}>Sábado</option>
            <option value={0}>Domingo</option>
          </select>
        </div>
      )}

      {frequency === "monthly" && (
        <div>
          <Label>Dia do mês</Label>
          <Input
            type="number"
            min={1}
            max={31}
            value={dayOfMonth}
            onChange={(e) => setDayOfMonth(Number(e.target.value))}
          />
        </div>
      )}

      <div>
        <Label>Hora</Label>
        <Input
          type="time"
          value={timeOfDay}
          onChange={(e) => setTimeOfDay(e.target.value)}
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button
        type="submit"
        disabled={loading || !clientId || !staffId || selectedServices.length === 0}
        className="w-full rounded-full"
      >
        {loading ? "A criar..." : "Criar marcação recorrente"}
      </Button>
    </form>
  );
}

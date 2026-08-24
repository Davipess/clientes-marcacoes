"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Hours = Record<string, { open: string; close: string }[] | null>;

const DAYS: { key: string; label: string }[] = [
  { key: "mon", label: "Segunda" },
  { key: "tue", label: "Terça" },
  { key: "wed", label: "Quarta" },
  { key: "thu", label: "Quinta" },
  { key: "fri", label: "Sexta" },
  { key: "sat", label: "Sábado" },
  { key: "sun", label: "Domingo" },
];

export function SettingsForm({
  business,
  openingHours,
  settings,
  soloMode,
}: {
  business: { name: string; address: string; email: string };
  openingHours: Hours;
  settings: {
    bufferMinutes: number;
    minLeadHours: number;
    maxLeadDays: number;
    cancellationWindowHours: number;
    cancellationPolicyText: string;
  };
  soloMode: {
    hasOwnProfile: boolean;
    staff: {
      id: string;
      displayName: string;
      email: string | null;
      active: boolean;
      isOwnProfile: boolean;
    }[];
  };
}) {
  const router = useRouter();
  const [hours, setHours] = useState<Hours>(openingHours);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activatingSolo, setActivatingSolo] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  function setDay(day: string, closed: boolean, open?: string, close?: string) {
    setHours((prev) => ({
      ...prev,
      [day]: closed ? null : [{ open: open ?? "09:00", close: close ?? "18:00" }],
    }));
  }

  async function submit(formData: FormData) {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/admin/definicoes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.get("name"),
          address: String(formData.get("address")) || null,
          email: String(formData.get("email")) || null,
          openingHours: hours,
          bufferMinutes: Number(formData.get("bufferMinutes")),
          minLeadHours: Number(formData.get("minLeadHours")),
          maxLeadDays: Number(formData.get("maxLeadDays")),
          cancellationWindowHours: Number(formData.get("cancellationWindowHours")),
          cancellationPolicyText: String(formData.get("cancellationPolicyText")),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Erro ao guardar.");
        return;
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      setError("Erro de rede.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleStaff(staffId: string, active: boolean) {
    setTogglingId(staffId);
    setError(null);
    try {
      const res = await fetch("/api/admin/equipa", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staffId, active }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Erro ao alterar a técnica.");
        return;
      }
      router.refresh();
    } catch {
      setError("Erro de rede.");
    } finally {
      setTogglingId(null);
    }
  }

  async function activateSoloMode() {
    setActivatingSolo(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/equipa/solo", { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Erro ao ativar o modo individual.");
        return;
      }
      router.refresh();
    } catch {
      setError("Erro de rede.");
    } finally {
      setActivatingSolo(false);
    }
  }

  return (
    <form action={submit} className="mt-6 space-y-8">
      {/* Solo mode / team */}
      {soloMode.staff.length === 0 && (
        <section className="rounded-2xl border border-primary/30 bg-secondary/40 p-5">
          <h2 className="font-heading text-lg font-semibold">Modo individual</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            É a única técnica do salão? Ative o seu próprio perfil para passar a
            receber marcações (horário padrão: seg–sáb, 09:00–18:00, ajustável
            depois).
          </p>
          <Button
            type="button"
            onClick={activateSoloMode}
            disabled={activatingSolo}
            className="mt-3 rounded-full px-6"
          >
            {activatingSolo ? "A ativar..." : "Ativar o meu perfil de técnica"}
          </Button>
        </section>
      )}
      {soloMode.staff.length > 0 && (
        <section className="rounded-2xl border border-border/70 bg-card p-5">
          <h2 className="font-heading text-lg font-semibold">Equipa</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Só as técnicas ativas recebem marcações. Desative quem não trabalha
            consigo para que apenas apareça a si no site.
          </p>
          <ul className="mt-4 space-y-2">
            {soloMode.staff.map((member) => (
              <li
                key={member.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-border/60 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {member.displayName}
                    {member.isOwnProfile && (
                      <span className="ml-2 rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
                        você
                      </span>
                    )}
                    {!member.active && (
                      <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        inativa
                      </span>
                    )}
                  </p>
                  {member.email && (
                    <p className="truncate text-xs text-muted-foreground">{member.email}</p>
                  )}
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className={`rounded-full ${
                    member.active ? "" : "border-primary/40 text-primary"
                  }`}
                  disabled={togglingId === member.id}
                  onClick={() => toggleStaff(member.id, !member.active)}
                >
                  {togglingId === member.id
                    ? "..."
                    : member.active
                      ? "Desativar"
                      : "Reativar"}
                </Button>
              </li>
            ))}
          </ul>

          <AddStaffForm onCreated={() => router.refresh()} />
        </section>
      )}
      {/* Business info */}
      <section className="space-y-4 rounded-2xl border border-border/70 bg-card p-5">
        <h2 className="font-heading text-lg font-semibold">Negócio</h2>
        <div>
          <Label htmlFor="name">Nome *</Label>
          <Input id="name" name="name" required minLength={2} defaultValue={business.name} className="mt-1.5" />
        </div>
        <div>
          <Label htmlFor="address">Morada</Label>
          <Input id="address" name="address" defaultValue={business.address} className="mt-1.5" />
        </div>
        <div>
          <Label htmlFor="email">Email de contacto</Label>
          <Input id="email" name="email" type="email" defaultValue={business.email} className="mt-1.5" />
        </div>
      </section>

      {/* Opening hours */}
      <section className="rounded-2xl border border-border/70 bg-card p-5">
        <h2 className="font-heading text-lg font-semibold">Horário</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Usado para calcular os horários disponíveis no site.
        </p>
        <div className="mt-4 space-y-2">
          {DAYS.map(({ key, label }) => {
            const windows = hours[key];
            const closed = !windows;
            const first = windows?.[0];
            return (
              <div key={key} className="flex items-center gap-3">
                <span className="w-24 text-sm">{label}</span>
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={closed}
                    onChange={(e) => setDay(key, e.target.checked)}
                    className="h-4 w-4"
                  />
                  Fechado
                </label>
                {!closed && first && (
                  <div className="flex items-center gap-2">
                    <Input
                      type="time"
                      value={first.open}
                      onChange={(e) => setDay(key, false, e.target.value, first.close)}
                      className="w-28"
                      step={900}
                    />
                    <span className="text-muted-foreground">–</span>
                    <Input
                      type="time"
                      value={first.close}
                      onChange={(e) => setDay(key, false, first.open, e.target.value)}
                      className="w-28"
                      step={900}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Booking rules */}
      <section className="space-y-4 rounded-2xl border border-border/70 bg-card p-5">
        <h2 className="font-heading text-lg font-semibold">Regras de marcação</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="minLeadHours">Antecedência mínima (horas)</Label>
            <Input id="minLeadHours" name="minLeadHours" type="number" min={0} max={168} defaultValue={settings.minLeadHours} className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor="maxLeadDays">Antecedência máxima (dias)</Label>
            <Input id="maxLeadDays" name="maxLeadDays" type="number" min={1} max={365} defaultValue={settings.maxLeadDays} className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor="bufferMinutes">Intervalo entre marcações (min)</Label>
            <Input id="bufferMinutes" name="bufferMinutes" type="number" min={0} max={120} defaultValue={settings.bufferMinutes} className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor="cancellationWindowHours">Cancelar até X horas antes</Label>
            <Input id="cancellationWindowHours" name="cancellationWindowHours" type="number" min={0} max={168} defaultValue={settings.cancellationWindowHours} className="mt-1.5" />
          </div>
        </div>
        <div>
          <Label htmlFor="cancellationPolicyText">Texto da política de cancelamento</Label>
          <Textarea
            id="cancellationPolicyText"
            name="cancellationPolicyText"
            rows={2}
            maxLength={1000}
            defaultValue={settings.cancellationPolicyText}
            placeholder="Pode cancelar ou alterar gratuitamente até 24 horas antes."
            className="mt-1.5"
          />
        </div>
      </section>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={saving} className="rounded-full px-8">
          {saving ? "A guardar..." : "Guardar definições"}
        </Button>
        {saved && (
          <span className="animate-fade-in text-sm text-green-700">
            Guardado ✓ — as alterações já estão visíveis no site.
          </span>
        )}
        {error && <span className="text-sm text-destructive">{error}</span>}
      </div>
    </form>
  );
}

function AddStaffForm({ onCreated }: { onCreated: () => void }) {
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    setSaving(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/equipa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) {
        setErr(json.error ?? "Erro ao criar a técnica.");
        return;
      }
      setMsg(`Conta criada para ${String(data.displayName)} — já pode entrar em /entrar.`);
      form.reset();
      onCreated();
    } catch {
      setErr("Erro de rede.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-5 space-y-3 rounded-xl border border-dashed border-border p-4">
      <p className="text-sm font-medium">Adicionar nova técnica</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="new-staff-name">Nome *</Label>
          <Input id="new-staff-name" name="displayName" required minLength={2} maxLength={80} className="mt-1" />
        </div>
        <div>
          <Label htmlFor="new-staff-email">Email (para entrar) *</Label>
          <Input id="new-staff-email" name="email" type="email" required className="mt-1" />
        </div>
        <div>
          <Label htmlFor="new-staff-pass">Palavra-passe inicial *</Label>
          <Input id="new-staff-pass" name="password" type="password" required minLength={12} autoComplete="new-password" className="mt-1" />
          <p className="mt-1 text-xs text-muted-foreground">
            Mín. 12 caracteres, com maiúsculas, minúsculas e um dígito.
          </p>
        </div>
        <div>
          <Label htmlFor="new-staff-bio">Pequena bio (opcional)</Label>
          <Input id="new-staff-bio" name="bio" maxLength={500} className="mt-1" />
        </div>
      </div>
      {msg && <p className="text-sm text-green-700">{msg}</p>}
      {err && <p className="text-sm text-destructive">{err}</p>}
      <Button type="submit" size="sm" className="rounded-full px-5" disabled={saving}>
        {saving ? "A criar..." : "Criar conta de técnica"}
      </Button>
    </form>
  );
}

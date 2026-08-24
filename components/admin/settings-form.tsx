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
  business: {
    name: string;
    address: string;
    email: string;
    logoUrl: string | null;
    primaryColor: string;
    secondaryColor: string;
  };
  openingHours: Hours;
  settings: {
    bufferMinutes: number;
    minLeadHours: number;
    maxLeadDays: number;
    cancellationWindowHours: number;
    cancellationPolicyText: string;
    maxActiveBookingsPerPhone: number;
    maxBookingsPerPhonePerDay: number;
    noShowFlagThreshold: number;
    retentionMonths: number;
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
  const [logoUrl, setLogoUrl] = useState(business.logoUrl);
  const [primaryColor, setPrimaryColor] = useState(business.primaryColor);
  const [secondaryColor, setSecondaryColor] = useState(business.secondaryColor);
  const [brandSaving, setBrandSaving] = useState(false);
  const [brandSaved, setBrandSaved] = useState(false);

  async function uploadLogo(file: File) {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 400 / bitmap.width);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve) =>
      canvas.toBlob((b) => resolve(b ?? file), "image/webp", 0.85),
    );
    const form = new FormData();
    form.append("ficheiro", new File([blob], "logo.webp", { type: "image/webp" }));
    const res = await fetch("/api/admin/imagens", { method: "POST", body: form });
    const json = await res.json();
    if (res.ok) setLogoUrl(json.url);
    else setError(json.error ?? "Erro no envio do logótipo.");
  }

  async function saveBranding() {
    setBrandSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/branding", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          logoUrl,
          primaryColor,
          secondaryColor,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Erro ao guardar a identidade visual.");
        return;
      }
      setBrandSaved(true);
      setTimeout(() => setBrandSaved(false), 2500);
      router.refresh();
    } catch {
      setError("Erro de rede.");
    } finally {
      setBrandSaving(false);
    }
  }

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
          maxActiveBookingsPerPhone: Number(formData.get("maxActiveBookingsPerPhone")),
          maxBookingsPerPhonePerDay: Number(formData.get("maxBookingsPerPhonePerDay")),
          noShowFlagThreshold: Number(formData.get("noShowFlagThreshold")),
          retentionMonths: Number(formData.get("retentionMonths")),
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
      {/* Branding */}
      <section className="space-y-4 rounded-2xl border border-border/70 bg-card p-5">
        <h2 className="font-heading text-lg font-semibold">Identidade visual</h2>
        <p className="text-xs text-muted-foreground">
          Logótipo e cores aplicados em todo o site público.
        </p>
        <div className="flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logoUrl ?? undefined}
            alt=""
            className="h-16 w-16 rounded-xl bg-gradient-to-br from-secondary to-accent object-contain"
          />
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="text-sm file:mr-3 file:rounded-full file:border-0 file:bg-secondary file:px-4 file:py-2 file:text-sm file:font-medium file:text-secondary-foreground hover:file:brightness-95"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void uploadLogo(file);
            }}
          />
        </div>
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <Label htmlFor="cor-primaria">Cor principal</Label>
            <div className="mt-1.5 flex items-center gap-2">
              <input
                id="cor-primaria"
                type="color"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="h-9 w-12 cursor-pointer rounded border border-input"
              />
              <span className="text-sm tabular-nums text-muted-foreground">{primaryColor}</span>
            </div>
          </div>
          <div>
            <Label htmlFor="cor-secundaria">Cor secundária</Label>
            <div className="mt-1.5 flex items-center gap-2">
              <input
                id="cor-secundaria"
                type="color"
                value={secondaryColor}
                onChange={(e) => setSecondaryColor(e.target.value)}
                className="h-9 w-12 cursor-pointer rounded border border-input"
              />
              <span className="text-sm tabular-nums text-muted-foreground">{secondaryColor}</span>
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            className="rounded-full px-5"
            disabled={brandSaving}
            onClick={saveBranding}
          >
            {brandSaving ? "A guardar..." : "Guardar identidade"}
          </Button>
          {brandSaved && (
            <span className="animate-fade-in text-xs text-green-700">
              Guardado ✓ — visível no site público
            </span>
          )}
        </div>
      </section>

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

      {/* Abuse prevention */}
      <section className="space-y-4 rounded-2xl border border-border/70 bg-card p-5">
        <h2 className="font-heading text-lg font-semibold">Prevenção de abusos</h2>
        <p className="text-xs text-muted-foreground">
          Limites por número de telefone. Quem atinge o limite de faltas fica
          com um aviso no painel — o bloqueio é sempre manual, nunca automático.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="maxActive">Máx. marcações futuras por telefone</Label>
            <Input id="maxActive" name="maxActiveBookingsPerPhone" type="number" min={1} max={20} defaultValue={settings.maxActiveBookingsPerPhone} className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor="maxDaily">Máx. marcações criadas por dia</Label>
            <Input id="maxDaily" name="maxBookingsPerPhonePerDay" type="number" min={1} max={20} defaultValue={settings.maxBookingsPerPhonePerDay} className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor="noShowThreshold">Faltas para aviso de risco</Label>
            <Input id="noShowThreshold" name="noShowFlagThreshold" type="number" min={1} max={20} defaultValue={settings.noShowFlagThreshold} className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor="retentionMonths">Manter histórico (meses)</Label>
            <Input id="retentionMonths" name="retentionMonths" type="number" min={6} max={120} defaultValue={settings.retentionMonths} className="mt-1.5" />
          </div>
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

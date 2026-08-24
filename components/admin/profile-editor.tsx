"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ProfileEditor({
  name,
  email,
  technicianName,
}: {
  name: string;
  email: string;
  technicianName: string | null;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/admin/perfil", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.get("nome"),
          email: data.get("email"),
          technicianName: data.get("tecnica") || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Erro ao guardar o perfil.");
        return;
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      router.refresh();
    } catch {
      setError("Erro de rede.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="pf-nome">O seu nome *</Label>
          <Input
            id="pf-nome"
            name="nome"
            required
            minLength={2}
            defaultValue={name}
            autoComplete="name"
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="pf-email">Email (tamb&eacute;m &eacute; o seu login) *</Label>
          <Input
            id="pf-email"
            name="email"
            type="email"
            required
            defaultValue={email}
            autoComplete="email"
            className="mt-1"
          />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="pf-tecnica">
            Nome p&uacute;blico como t&eacute;cnica {technicianName === null && "(sem perfil de t&eacute;cnica ativo)"}
          </Label>
          <Input
            id="pf-tecnica"
            name="tecnica"
            minLength={2}
            maxLength={80}
            defaultValue={technicianName ?? ""}
            disabled={technicianName === null}
            placeholder="Como as clientes a v&ecirc;m ao marcar"
            className="mt-1"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            &Eacute; o nome que aparece na marca&ccedil;&atilde;o p&uacute;blica e na agenda.
          </p>
        </div>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {saved && (
        <p className="animate-fade-in text-sm text-green-700">
          Perfil atualizado ✓
        </p>
      )}
      <Button type="submit" size="sm" className="rounded-full px-6" disabled={saving}>
        {saving ? "A guardar..." : "Guardar perfil"}
      </Button>
    </form>
  );
}

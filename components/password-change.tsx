"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function PasswordChange() {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    if (data.get("nova") !== data.get("confirmacao")) {
      setError("As palavras-passe novas não coincidem.");
      return;
    }
    setSaving(true);
    setError(null);
    setDone(false);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: data.get("atual"),
          newPassword: data.get("nova"),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Erro ao alterar a palavra-passe.");
        return;
      }
      form.reset();
      setDone(true);
      setTimeout(() => setDone(false), 4000);
    } catch {
      setError("Erro de rede.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <Label htmlFor="pc-atual">Palavra-passe atual</Label>
          <Input id="pc-atual" name="atual" type="password" required autoComplete="current-password" className="mt-1" />
        </div>
        <div>
          <Label htmlFor="pc-nova">Nova</Label>
          <Input id="pc-nova" name="nova" type="password" required minLength={12} autoComplete="new-password" className="mt-1" />
        </div>
        <div>
          <Label htmlFor="pc-conf">Confirmar nova</Label>
          <Input id="pc-conf" name="confirmacao" type="password" required minLength={12} autoComplete="new-password" className="mt-1" />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Mín. 12 caracteres, com maiúsculas, minúsculas e um dígito. Ao alterar,
        todas as outras sessões são terminadas.
      </p>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {done && (
        <p className="animate-fade-in text-sm text-green-700">
          Palavra-passe alterada ✓
        </p>
      )}
      <Button type="submit" size="sm" variant="outline" className="rounded-full" disabled={saving}>
        {saving ? "A guardar..." : "Alterar palavra-passe"}
      </Button>
    </form>
  );
}

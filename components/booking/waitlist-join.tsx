"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface WaitlistJoinProps {
  businessId: string;
  serviceId: string;
  preferredDate: string;
  preferredTime?: string;
}

export function WaitlistJoin({ businessId, serviceId, preferredDate, preferredTime }: WaitlistJoinProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId,
          serviceId,
          clientName: name,
          clientPhone: phone,
          preferredDate: new Date(preferredDate).toISOString(),
          preferredTime,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Erro ao juntar à lista.");
        return;
      }
      setSubmitted(true);
    } catch {
      setError("Erro de rede. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="rounded-2xl border border-green-200 bg-green-50 p-4 text-center">
        <p className="text-sm font-medium text-green-800">✅ Adicionado à lista de espera!</p>
        <p className="mt-1 text-xs text-green-700">
          Será notificado quando houver uma vaga disponível.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
      <p className="text-sm font-medium">📅 Sem horários disponíveis?</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Junte-se à lista de espera e será notificado quando houver uma vaga.
      </p>
      <form onSubmit={(e) => void handleSubmit(e)} className="mt-3 space-y-2">
        <Input
          placeholder="O seu nome"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          minLength={2}
          className="h-9 text-sm"
        />
        <Input
          placeholder="Telemóvel"
          type="tel"
          inputMode="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          required
          className="h-9 text-sm"
        />
        {error && <p className="text-xs text-destructive">{error}</p>}
        <Button
          type="submit"
          disabled={loading || !name || !phone}
          className="w-full rounded-full"
          size="sm"
        >
          {loading ? "A juntar..." : "Juntar à lista de espera"}
        </Button>
      </form>
    </div>
  );
}

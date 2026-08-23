"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

type ClientItem = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  notes: string;
  marketingConsent: boolean;
  visits: number;
  lastVisit: string | null;
};

export function ClientManager({ clients }: { clients: ClientItem[] }) {
  const [search, setSearch] = useState("");
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.phone?.toLowerCase().includes(q),
    );
  }, [clients, search]);

  async function saveNotes(id: string) {
    setSavingId(id);
    try {
      const res = await fetch("/api/admin/clientes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, notes: notesDraft[id] ?? null }),
      });
      if (res.ok) {
        setSavedId(id);
        setTimeout(() => setSavedId(null), 2000);
      }
    } finally {
      setSavingId(null);
    }
  }

  if (clients.length === 0) {
    return (
      <p className="mt-6 rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        Ainda não há clientes. Aparecerão aqui após a primeira marcação.
      </p>
    );
  }

  return (
    <div className="mt-6">
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Pesquisar por nome, email ou telefone..."
        className="max-w-md rounded-full"
      />

      <ul className="stagger mt-4 space-y-3">
        {filtered.map((client) => (
          <li
            key={client.id}
            className="rounded-2xl border border-border/70 bg-card p-4"
          >
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <p className="font-medium">{client.name}</p>
              <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground">
                {client.visits} {client.visits === 1 ? "visita" : "visitas"}
              </span>
              {client.marketingConsent && (
                <span className="rounded-full bg-accent px-2.5 py-0.5 text-xs text-accent-foreground">
                  aceita novidades
                </span>
              )}
            </div>
            <div className="mt-1 text-sm text-muted-foreground">
              <p>{client.email}</p>
              {client.phone && <p className="tabular-nums">{client.phone}</p>}
              {client.lastVisit && (
                <p className="mt-0.5 text-xs">
                  Última visita:{" "}
                  {new Date(client.lastVisit).toLocaleDateString("pt-PT", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              )}
            </div>

            <div className="mt-3">
              <Textarea
                rows={2}
                maxLength={2000}
                placeholder="Notas internas (apenas visíveis aqui)..."
                value={notesDraft[client.id] ?? client.notes}
                onChange={(e) =>
                  setNotesDraft((prev) => ({ ...prev, [client.id]: e.target.value }))
                }
                className="text-sm"
              />
              <div className="mt-2 flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="rounded-full"
                  disabled={savingId === client.id}
                  onClick={() => saveNotes(client.id)}
                >
                  {savingId === client.id ? "A guardar..." : "Guardar notas"}
                </Button>
                {savedId === client.id && (
                  <span className="animate-fade-in text-xs text-green-700">
                    Guardado ✓
                  </span>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>

      {filtered.length === 0 && (
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Nenhum cliente encontrado para “{search}”.
        </p>
      )}
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

type ClientItem = {
  id: string;
  name: string;
  phone: string | null;
  notes: string;
  marketingConsent: boolean;
  noShowCount: number;
  blocked: boolean;
  blockReason: string | null;
  visits: number;
  lastVisit: string | null;
};

export function ClientManager({
  clients,
  noShowFlagThreshold,
}: {
  clients: ClientItem[];
  noShowFlagThreshold: number;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [blockingReason, setBlockingReason] = useState<Record<string, string>>({});
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function clientAction(
    id: string,
    action: "block" | "unblock" | "resetNoShows",
    reason?: string,
  ) {
    const key = `${id}:${action}`;
    // Two-step confirmation for destructive/irreversible-feeling actions.
    if (action !== "unblock" && pendingAction !== key) {
      setPendingAction(key);
      return;
    }
    setPendingAction(null);
    setSavingId(id);
    setActionError(null);
    try {
      const res = await fetch("/api/admin/clientes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action, reason }),
      });
      const json = await res.json();
      if (!res.ok) {
        setActionError(json.error ?? "Erro.");
        return;
      }
      router.refresh();
    } catch {
      setActionError("Erro de rede.");
    } finally {
      setSavingId(null);
    }
  }

  async function anonymize(client: ClientItem) {
    if (pendingDelete !== client.id) {
      setPendingDelete(client.id);
      return;
    }
    setPendingDelete(null);
    setSavingId(client.id);
    try {
      const res = await fetch("/api/admin/clientes", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: client.id }),
      });
      if (res.ok) {
        // Remove from the list; the row stays in the DB anonymized.
        window.location.reload();
      }
    } finally {
      setSavingId(null);
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
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
        placeholder="Pesquisar por nome ou telefone..."
        className="max-w-md rounded-full"
      />
      {actionError && (
        <p className="mt-3 rounded-xl bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {actionError}
        </p>
      )}

      <ul className="stagger mt-4 space-y-3">
        {filtered.map((client) => {
          const atRisk = client.noShowCount >= noShowFlagThreshold;
          return (
          <li
            key={client.id}
            className={`rounded-2xl border p-4 ${
              client.blocked
                ? "border-destructive/40 bg-destructive/5"
                : "border-border/70 bg-card"
            }`}
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
              {atRisk && (
                <span
                  className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800"
                  title={`${client.noShowCount} faltas registadas`}
                >
                  ⚠ risco de falta ({client.noShowCount})
                </span>
              )}
              {client.blocked && (
                <span
                  className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700"
                  title={client.blockReason ?? undefined}
                >
                  🚫 bloqueado
                </span>
              )}
            </div>
            <div className="mt-1 text-sm text-muted-foreground">
              <p className="tabular-nums">{client.phone}</p>
              {client.blocked && client.blockReason && (
                <p className="mt-0.5 text-xs text-red-700">
                  Motivo do bloqueio: {client.blockReason}
                </p>
              )}
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
              <div className="mt-2 flex flex-wrap items-center gap-2">
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

                {client.blocked ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="rounded-full border-primary/40 text-primary"
                    disabled={savingId === client.id}
                    onClick={() => clientAction(client.id, "unblock")}
                  >
                    Desbloquear
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className={`rounded-full ${
                      pendingAction === `${client.id}:block`
                        ? "bg-destructive text-white hover:bg-destructive"
                        : "text-destructive hover:text-destructive"
                    }`}
                    disabled={
                      savingId === client.id ||
                      (blockingReason[client.id]?.trim().length ?? 0) < 3
                    }
                    onClick={() =>
                      clientAction(
                        client.id,
                        "block",
                        blockingReason[client.id]?.trim(),
                      )
                    }
                  >
                    {pendingAction === `${client.id}:block`
                      ? "Confirmar bloqueio?"
                      : "Bloquear online"}
                  </Button>
                )}
                {client.noShowCount > 0 && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className={`rounded-full ${
                      pendingAction === `${client.id}:resetNoShows`
                        ? "bg-neutral-900 text-white hover:bg-neutral-900"
                        : ""
                    }`}
                    disabled={savingId === client.id}
                    onClick={() => clientAction(client.id, "resetNoShows")}
                  >
                    {pendingAction === `${client.id}:resetNoShows`
                      ? "Confirmar reset?"
                      : `Zerar faltas (${client.noShowCount})`}
                  </Button>
                )}

                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className={`rounded-full ${
                    pendingDelete === client.id
                      ? "bg-destructive text-white hover:bg-destructive"
                      : "text-destructive hover:text-destructive"
                  }`}
                  disabled={savingId === client.id}
                  onClick={() => anonymize(client)}
                >
                  {pendingDelete === client.id
                    ? "Confirmar anonimização?"
                    : "Anonimizar (RGPD)"}
                </Button>
                {savedId === client.id && (
                  <span className="animate-fade-in text-xs text-green-700">
                    Guardado ✓
                  </span>
                )}
              </div>
              {!client.blocked && (
                <Input
                  value={blockingReason[client.id] ?? ""}
                  onChange={(e) =>
                    setBlockingReason((prev) => ({
                      ...prev,
                      [client.id]: e.target.value,
                    }))
                  }
                  placeholder="Motivo do bloqueio (obrigatório, mínimo 3 caracteres)..."
                  maxLength={300}
                  className="mt-2 text-sm"
                />
              )}
            </div>
          </li>
          );
        })}
      </ul>

      {filtered.length === 0 && (
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Nenhum cliente encontrado para “{search}”.
        </p>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Interval = { weekday: number; startTime: string; endTime: string };

type StaffMember = {
  id: string;
  displayName: string;
  active: boolean;
  intervals: Interval[];
  serviceIds: string[];
};

const DAYS: { key: number; label: string }[] = [
  { key: 1, label: "Segunda" },
  { key: 2, label: "Terça" },
  { key: 3, label: "Quarta" },
  { key: 4, label: "Quinta" },
  { key: 5, label: "Sexta" },
  { key: 6, label: "Sábado" },
  { key: 0, label: "Domingo" },
];

export function TeamManager({
  staff,
  services,
  timeOff,
}: {
  staff: StaffMember[];
  services: { id: string; name: string }[];
  timeOff: {
    id: string;
    staffId: string;
    startAt: string;
    endAt: string;
    reason: string;
  }[];
}) {
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Interval[]>>({});
  const [draftServices, setDraftServices] = useState<Record<string, string[]>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [folga, setFolga] = useState<Record<string, { inicio: string; fim: string; motivo: string }>>({});

  function draftFor(member: StaffMember): Interval[] {
    return (
      drafts[member.id] ??
      member.intervals.map((iv) => ({ ...iv }))
    );
  }

  function setDay(member: StaffMember, weekday: number, closed: boolean, start?: string, end?: string) {
    const current = draftFor(member).filter((iv) => iv.weekday !== weekday);
    if (!closed) {
      current.push({
        weekday,
        startTime: start ?? "09:00",
        endTime: end ?? "18:00",
      });
    }
    setDrafts((prev) => ({ ...prev, [member.id]: current.sort((a, b) => a.weekday - b.weekday) }));
  }

  function servicesFor(member: StaffMember): string[] {
    return draftServices[member.id] ?? member.serviceIds;
  }

  function toggleService(member: StaffMember, serviceId: string) {
    const current = servicesFor(member);
    const next = current.includes(serviceId)
      ? current.filter((x) => x !== serviceId)
      : [...current, serviceId];
    setDraftServices((prev) => ({ ...prev, [member.id]: next }));
  }

  async function saveSchedule(member: StaffMember) {
    setBusy(member.id);
    setError(null);
    try {
      const res = await fetch("/api/admin/horarios", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          staffId: member.id,
          intervals: draftFor(member),
          serviceIds: servicesFor(member),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Erro ao guardar.");
        return;
      }
      setSavedId(member.id);
      setTimeout(() => setSavedId(null), 2500);
      router.refresh();
    } catch {
      setError("Erro de rede.");
    } finally {
      setBusy(null);
    }
  }

  async function addFolga(member: StaffMember) {
    const f = folga[member.id];
    if (!f?.inicio || !f?.fim) return;
    setBusy(member.id);
    setError(null);
    try {
      const res = await fetch("/api/admin/horarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          staffId: member.id,
          inicio: new Date(f.inicio).toISOString(),
          fim: new Date(f.fim).toISOString(),
          motivo: f.motivo || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Erro ao adicionar folga.");
        return;
      }
      setFolga((prev) => ({ ...prev, [member.id]: { inicio: "", fim: "", motivo: "" } }));
      router.refresh();
    } catch {
      setError("Erro de rede.");
    } finally {
      setBusy(null);
    }
  }

  async function removeFolga(id: string) {
    setBusy(id);
    try {
      await fetch("/api/admin/horarios", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-6 space-y-3">
      {error && (
        <p className="rounded-xl bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {staff.map((member) => {
        const open = openId === member.id;
        const intervals = draftFor(member);
        const memberFolgas = timeOff.filter((t) => t.staffId === member.id);
        return (
          <div
            key={member.id}
            className="rounded-2xl border border-border/70 bg-card"
          >
            <button
              type="button"
              className="flex w-full items-center justify-between p-4 text-left"
              onClick={() => setOpenId(open ? null : member.id)}
            >
              <div>
                <p className="font-medium">
                  {member.displayName}
                  {!member.active && (
                    <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      inativa
                    </span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  {intervals.length > 0
                    ? `${intervals.length} dias/semana · ${servicesFor(member).length} serviços`
                    : "Sem horário definido"}
                  {memberFolgas.length > 0 && ` · ${memberFolgas.length} folgas futuras`}
                </p>
              </div>
              <span className="text-muted-foreground">{open ? "▲" : "▼"}</span>
            </button>

            {open && (
              <div className="animate-fade-in space-y-5 border-t border-border/60 p-4">
                {/* Weekly schedule */}
                <div>
                  <p className="mb-2 text-sm font-medium">Horário semanal</p>
                  <div className="space-y-2">
                    {DAYS.map(({ key, label }) => {
                      const iv = intervals.find((x) => x.weekday === key);
                      const closed = !iv;
                      return (
                        <div key={key} className="flex flex-wrap items-center gap-2">
                          <span className="w-20 text-sm">{label}</span>
                          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <input
                              type="checkbox"
                              checked={closed}
                              onChange={(e) =>
                                setDay(member, key, e.target.checked, iv?.startTime, iv?.endTime)
                              }
                              className="h-4 w-4"
                            />
                            Fechado
                          </label>
                          {iv && (
                            <div className="flex items-center gap-2">
                              <Input
                                type="time"
                                step={900}
                                value={iv.startTime}
                                onChange={(e) =>
                                  setDay(member, key, false, e.target.value, iv.endTime)
                                }
                                className="w-28"
                              />
                              <span className="text-muted-foreground">–</span>
                              <Input
                                type="time"
                                step={900}
                                value={iv.endTime}
                                onChange={(e) =>
                                  setDay(member, key, false, iv.startTime, e.target.value)
                                }
                                className="w-28"
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Services */}
                <div>
                  <p className="mb-2 text-sm font-medium">Serviços que realiza</p>
                  <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                    {services.map((s) => (
                      <label key={s.id} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={servicesFor(member).includes(s.id)}
                          onChange={() => toggleService(member, s.id)}
                          className="h-4 w-4"
                        />
                        {s.name}
                      </label>
                    ))}
                  </div>
                </div>

                <Button
                  type="button"
                  size="sm"
                  className="rounded-full px-6"
                  disabled={busy === member.id}
                  onClick={() => saveSchedule(member)}
                >
                  {busy === member.id ? "A guardar..." : "Guardar horário e serviços"}
                </Button>
                {savedId === member.id && (
                  <span className="animate-fade-in ml-2 text-xs text-green-700">
                    Guardado ✓
                  </span>
                )}

                {/* Time off */}
                <div className="border-t border-border/60 pt-4">
                  <p className="mb-2 text-sm font-medium">Folgas e férias</p>
                  <ul className="mb-3 space-y-1.5">
                    {memberFolgas.length === 0 && (
                      <li className="text-xs text-muted-foreground">Sem folgas futuras.</li>
                    )}
                    {memberFolgas.map((t) => (
                      <li
                        key={t.id}
                        className="flex items-center justify-between gap-2 rounded-lg bg-muted/60 px-3 py-2 text-sm"
                      >
                        <span className="tabular-nums">
                          {new Date(t.startAt).toLocaleString("pt-PT", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                          {" → "}
                          {new Date(t.endAt).toLocaleString("pt-PT", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                          {t.reason && (
                            <span className="ml-2 text-xs text-muted-foreground">
                              {t.reason}
                            </span>
                          )}
                        </span>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          disabled={busy === t.id}
                          onClick={() => removeFolga(t.id)}
                        >
                          Remover
                        </Button>
                      </li>
                    ))}
                  </ul>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <Label
                        htmlFor={`folga-inicio-${member.id}`}
                        className="text-xs"
                      >
                        De
                      </Label>
                      <Input
                        id={`folga-inicio-${member.id}`}
                        type="datetime-local"
                        value={folga[member.id]?.inicio ?? ""}
                        onChange={(e) =>
                          setFolga((prev) => ({
                            ...prev,
                            [member.id]: {
                              inicio: e.target.value,
                              fim: prev[member.id]?.fim ?? "",
                              motivo: prev[member.id]?.motivo ?? "",
                            },
                          }))
                        }
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor={`folga-fim-${member.id}`} className="text-xs">
                        Até
                      </Label>
                      <Input
                        id={`folga-fim-${member.id}`}
                        type="datetime-local"
                        value={folga[member.id]?.fim ?? ""}
                        onChange={(e) =>
                          setFolga((prev) => ({
                            ...prev,
                            [member.id]: {
                              inicio: prev[member.id]?.inicio ?? "",
                              fim: e.target.value,
                              motivo: prev[member.id]?.motivo ?? "",
                            },
                          }))
                        }
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor={`folga-motivo-${member.id}`} className="text-xs">
                        Motivo
                      </Label>
                      <Input
                        id={`folga-motivo-${member.id}`}
                        value={folga[member.id]?.motivo ?? ""}
                        onChange={(e) =>
                          setFolga((prev) => ({
                            ...prev,
                            [member.id]: {
                              inicio: prev[member.id]?.inicio ?? "",
                              fim: prev[member.id]?.fim ?? "",
                              motivo: e.target.value,
                            },
                          }))
                        }
                        placeholder="Férias, formação..."
                        className="mt-1"
                      />
                    </div>
                    <div className="flex items-end">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="rounded-full"
                        disabled={
                          busy === member.id ||
                          !folga[member.id]?.inicio ||
                          !folga[member.id]?.fim
                        }
                        onClick={() => addFolga(member)}
                      >
                        Adicionar folga
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

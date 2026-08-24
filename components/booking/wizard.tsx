"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  formatEuros,
} from "@/lib/format";
import type { PublicCategory, PublicStaff } from "@/lib/public-data";

type Props = {
  categories: PublicCategory[];
  staff: PublicStaff[];
  timezone: string;
  cancellationPolicyText: string;
  initialServiceId?: string;
};

const STEP_LABELS = ["Serviços", "Profissional", "Data e hora", "Os seus dados", "Confirmar"];
const WEEKDAY_SHORT = ["D", "S", "T", "Q", "Q", "S", "S"];

/** Wall-clock (business tz) → UTC instant, using the browser's Intl. */
function wallTimeToUtcIso(
  dateStr: string,
  timeStr: string,
  timeZone: string,
): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = timeStr.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const offset = offsetFor(new Date(guess), timeZone);
  return new Date(guess - offset).toISOString();
}

function offsetFor(date: Date, timeZone: string): number {
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
  for (const p of dtf.formatToParts(date)) parts[p.type] = p.value;
  const hour = parts.hour === "24" ? 0 : Number(parts.hour);
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    hour,
    Number(parts.minute),
  );
  return asUtc - date.getTime();
}

export function BookingWizard({
  categories,
  staff,
  timezone,
  cancellationPolicyText,
  initialServiceId,
}: Props) {
  const [step, setStep] = useState(initialServiceId ? 1 : 0);
  const [selectedIds, setSelectedIds] = useState<string[]>(
    initialServiceId ? [initialServiceId] : [],
  );
  const [staffId, setStaffId] = useState<string | null>(null); // null = sem preferência
  const [dateStr, setDateStr] = useState<string | null>(null);
  const [timeStr, setTimeStr] = useState<string | null>(null);
  const [slotsByDay, setSlotsByDay] = useState<Record<string, string[]>>({});
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ id: string; when: string } | null>(null);
  const [clientDetails, setClientDetails] = useState<{
    nome: string;
    telefone: string;
    notas: string;
    marketing: boolean;
  } | null>(null);
  const [searchingFar, setSearchingFar] = useState(false);

  const allServices = useMemo(
    () => categories.flatMap((c) => c.services),
    [categories],
  );
  const selected = allServices.filter((s) => selectedIds.includes(s.id));
  const totalMin = selected.reduce((sum, s) => sum + s.durationMin, 0);
  const totalPrice = selected.reduce((sum, s) => sum + s.price, 0);

  // Next 14 days strip (extends automatically when a far date is selected).
  const buildDays = (count: number) => {
    const out: { iso: string; weekday: number; dayNum: number; month: string }[] = [];
    const now = new Date();
    for (let i = 0; i < count; i++) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
      out.push({
        iso: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
        weekday: d.getDay(),
        dayNum: d.getDate(),
        month: d.toLocaleDateString("pt-PT", { month: "short" }),
      });
    }
    return out;
  };
  const [stripDays, setStripDays] = useState(() => buildDays(14));
  const days = stripDays;

  async function fetchSlots() {
    setLoadingSlots(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      selectedIds.forEach((id) => params.append("servico", id));
      if (staffId) params.set("colaborador", staffId);
      params.set("dias", "14");
      const res = await fetch(`/api/disponibilidade?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Erro ao carregar horários");
      const map: Record<string, string[]> = {};
      for (const day of json.days) map[day.date] = day.times;
      setSlotsByDay(map);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar horários.");
    } finally {
      setLoadingSlots(false);
    }
  }

  function goToStep(next: number) {
    // Leaving the details step: capture + validate the form values first.
    if (step === 3 && next === 4) {
      const form = document.getElementById("dados-form") as HTMLFormElement | null;
      if (!form) return;
      if (!form.reportValidity()) return;
      const data = new FormData(form);
      if (data.get("rgpd") !== "on") {
        setError("É necessário aceitar a Política de Privacidade.");
        return;
      }
      setClientDetails({
        nome: String(data.get("nome") ?? ""),
        telefone: String(data.get("telefone") ?? ""),
        notas: String(data.get("notas") ?? ""),
        marketing: data.get("marketing") === "on",
      });
      setError(null);
    }
    setStep(next);
    if (next === 2) void fetchSlots();
  }

  // Search up to 30 days ahead and jump to the first day with openings.
  async function findFirstAvailable() {
    setSearchingFar(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      selectedIds.forEach((id) => params.append("servico", id));
      if (staffId) params.set("colaborador", staffId);
      params.set("dias", "30");
      const res = await fetch(`/api/disponibilidade?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Erro ao procurar.");
      const first: { date: string; times: string[] } | undefined = json.days[0];
      if (!first) {
        setError("Sem horários nos próximos 30 dias. Contacte-nos, por favor.");
        return;
      }
      // Extend the visible strip if the first opening is beyond it.
      setStripDays((prev) => {
        if (prev.some((d) => d.iso === first.date)) return prev;
        const last = new Date(prev[prev.length - 1].iso);
        const target = new Date(first.date);
        const extra: typeof prev = [];
        for (let d = new Date(last); d < target; d.setDate(d.getDate() + 1)) {
          const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
          if (!prev.some((p) => p.iso === iso)) {
            extra.push({
              iso,
              weekday: d.getDay(),
              dayNum: d.getDate(),
              month: d.toLocaleDateString("pt-PT", { month: "short" }),
            });
          }
        }
        return [...prev, ...extra];
      });
      setSlotsByDay((prev) => ({ ...prev, [first.date]: first.times }));
      setDateStr(first.date);
      setTimeStr(first.times[0]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao procurar.");
    } finally {
      setSearchingFar(false);
    }
  }

  function toggleService(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  async function submit() {
    if (!dateStr || !timeStr || !clientDetails) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/marcacoes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          servicos: selectedIds,
          colaborador: staffId ?? undefined,
          inicio: wallTimeToUtcIso(dateStr, timeStr, timezone),
          nome: clientDetails.nome,
          telefone: clientDetails.telefone,
          notas: clientDetails.notas || undefined,
          consentimentoMarketing: clientDetails.marketing,
          consentimentoRGPD: true,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Não foi possível concluir a marcação.");
        if (json.code === "SLOT_TAKEN") {
          setStep(2);
          setTimeStr(null);
          void fetchSlots();
        }
        return;
      }
      const pretty = new Date(`${dateStr}T${timeStr}:00`).toLocaleDateString(
        "pt-PT",
        { weekday: "long", day: "numeric", month: "long" },
      );
      setDone({ id: json.marcacaoId, when: `${pretty} às ${timeStr}` });
    } catch {
      setError("Erro de rede. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="animate-rise-in rounded-3xl border border-border/70 bg-card p-8 text-center shadow-sm sm:p-12">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-secondary text-3xl">
          ✨
        </div>
        <h1 className="mt-6 font-heading text-2xl font-semibold sm:text-3xl">
          Marcação confirmada!
        </h1>
        <p className="mt-3 text-muted-foreground">
          Esperamos por si <strong className="text-foreground">{done.when}</strong>.
        </p>
        <p className="mt-4 rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">
          Pagamento efetuado no local. Receberá um email de confirmação em
          breve. Até já!
        </p>
        <Button asChild variant="outline" className="mt-7 rounded-full">
          <Link href="/">Voltar à página inicial</Link>
        </Button>
      </div>
    );
  }

  const canAdvance =
    step === 0 ? selected.length > 0 : step === 2 ? Boolean(dateStr && timeStr) : true;

  return (
    <div>
      {/* Progress */}
      <ol className="mb-8 flex items-center gap-1.5">
        {STEP_LABELS.map((label, i) => (
          <li key={label} className="flex flex-1 flex-col items-center gap-1.5">
            <div
              className={`h-1.5 w-full rounded-full transition-all duration-500 ${
                i <= step ? "bg-primary" : "bg-border"
              }`}
            />
            <span
              className={`hidden text-[10px] font-medium sm:block ${
                i === step ? "text-primary" : "text-muted-foreground"
              }`}
            >
              {label}
            </span>
          </li>
        ))}
      </ol>

      <div key={step} className="animate-rise-in">
        {/* Step 0: services */}
        {step === 0 && (
          <section>
            <h1 className="font-heading text-2xl font-semibold">Que serviços deseja?</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Pode escolher mais do que um — serão realizados na mesma visita.
            </p>
            <div className="stagger mt-6 space-y-2.5">
              {categories.map((cat) => (
                <div key={cat.id}>
                  <p className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {cat.name}
                  </p>
                  {cat.services.map((service) => {
                    const active = selectedIds.includes(service.id);
                    return (
                      <button
                        key={service.id}
                        type="button"
                        onClick={() => toggleService(service.id)}
                        aria-pressed={active}
                        className={`flex w-full items-center justify-between gap-3 rounded-2xl border p-4 text-left transition-all duration-200 active:scale-[0.99] ${
                          active
                            ? "border-primary bg-secondary/60 shadow-sm"
                            : "border-border/70 bg-card hover:border-primary/40"
                        }`}
                      >
                        <div className="min-w-0">
                          <span className="font-medium">{service.name}</span>
                          <span className="ml-2 text-xs text-muted-foreground">
                            {service.durationMin} min
                          </span>
                          {service.description && (
                            <span className="block truncate text-xs text-muted-foreground">
                              {service.description}
                            </span>
                          )}
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <span className="font-semibold tabular-nums">
                            {formatEuros(service.price)}
                          </span>
                          <span
                            className={`flex h-5 w-5 items-center justify-center rounded-full border text-[11px] transition-all ${
                              active
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border"
                            }`}
                          >
                            {active ? "✓" : ""}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Step 1: staff */}
        {step === 1 && (
          <section>
            <h1 className="font-heading text-2xl font-semibold">Alguma preferência?</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Escolha a sua profissional ou deixe-nos escolher por si.
            </p>
            <div className="stagger mt-6 space-y-2.5">
              <button
                type="button"
                onClick={() => setStaffId(null)}
                aria-pressed={staffId === null}
                className={`flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition-all duration-200 active:scale-[0.99] ${
                  staffId === null
                    ? "border-primary bg-secondary/60 shadow-sm"
                    : "border-border/70 bg-card hover:border-primary/40"
                }`}
              >
                <span
                  aria-hidden
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-secondary to-accent text-lg"
                >
                  ✦
                </span>
                <span>
                  <span className="font-medium">Sem preferência</span>
                  <span className="block text-xs text-muted-foreground">
                    Escolhemos a profissional disponível
                  </span>
                </span>
              </button>
              {staff.map((person) => {
                const active = staffId === person.id;
                return (
                  <button
                    key={person.id}
                    type="button"
                    onClick={() => setStaffId(person.id)}
                    aria-pressed={active}
                    className={`flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition-all duration-200 active:scale-[0.99] ${
                      active
                        ? "border-primary bg-secondary/60 shadow-sm"
                        : "border-border/70 bg-card hover:border-primary/40"
                    }`}
                  >
                    <span
                      aria-hidden
                      className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-secondary to-accent font-heading text-lg font-semibold text-primary"
                    >
                      {person.displayName.charAt(0)}
                    </span>
                    <span className="min-w-0">
                      <span className="font-medium">{person.displayName}</span>
                      {person.bio && (
                        <span className="block truncate text-xs text-muted-foreground">
                          {person.bio}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* Step 2: date & time */}
        {step === 2 && (
          <section>
            <h1 className="font-heading text-2xl font-semibold">Quando lhe dá jeito?</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Duração total da visita:{" "}
              <Badge variant="secondary" className="font-medium tabular-nums">
                {totalMin} min
              </Badge>
            </p>

            <div className="mt-6 -mx-4 overflow-x-auto px-4 pb-1">
              <div className="flex gap-2">
                {days.map((day) => {
                  const hasSlots = (slotsByDay[day.iso]?.length ?? 0) > 0;
                  const active = dateStr === day.iso;
                  return (
                    <button
                      key={day.iso}
                      type="button"
                      disabled={loadingSlots || !hasSlots}
                      onClick={() => {
                        setDateStr(day.iso);
                        setTimeStr(null);
                      }}
                      className={`flex w-14 shrink-0 flex-col items-center gap-0.5 rounded-2xl border py-3 transition-all duration-200 active:scale-[0.97] disabled:opacity-30 ${
                        active
                          ? "border-primary bg-primary text-primary-foreground shadow-md shadow-primary/20"
                          : "border-border/70 bg-card hover:border-primary/40"
                      }`}
                    >
                      <span className="text-[10px] uppercase tracking-wide opacity-70">
                        {WEEKDAY_SHORT[day.weekday]}
                      </span>
                      <span className="text-lg font-semibold leading-none">{day.dayNum}</span>
                      <span className="text-[10px] opacity-70">{day.month}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-6 min-h-40">
              {loadingSlots && (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div key={i} className="h-11 animate-pulse rounded-xl bg-muted" />
                  ))}
                </div>
              )}
              {!loadingSlots && dateStr && slotsByDay[dateStr]?.length > 0 && (
                <div key={dateStr} className="animate-fade-in grid grid-cols-3 gap-2 sm:grid-cols-5">
                  {slotsByDay[dateStr].map((time) => (
                    <button
                      key={time}
                      type="button"
                      onClick={() => setTimeStr(time)}
                      className={`rounded-xl border py-2.5 text-sm font-medium tabular-nums transition-all duration-150 active:scale-[0.97] ${
                        timeStr === time
                          ? "border-primary bg-primary text-primary-foreground shadow-md shadow-primary/20"
                          : "border-border/70 bg-card hover:border-primary/50"
                      }`}
                    >
                      {time}
                    </button>
                  ))}
                </div>
              )}
              {!loadingSlots && !error && (!dateStr || !slotsByDay[dateStr]) && (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Escolha um dia para ver os horários disponíveis.
                </p>
              )}
              {!loadingSlots && dateStr && slotsByDay[dateStr]?.length === 0 && (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Sem horários neste dia. Experimente outro.
                </p>
              )}
              {!loadingSlots && (
                <div className="mt-4 text-center">
                  <button
                    type="button"
                    onClick={() => void findFirstAvailable()}
                    disabled={searchingFar}
                    className="text-sm font-medium text-primary underline-offset-4 transition-colors hover:underline disabled:opacity-50"
                  >
                    {searchingFar
                      ? "A procurar..."
                      : "🔍 Ver a primeira data disponível (30 dias)"}
                  </button>
                </div>
              )}
              {error && <p className="py-4 text-center text-sm text-destructive">{error}</p>}
            </div>
          </section>
        )}

        {/* Step 3: details */}
        {step === 3 && (
          <section>
            <h1 className="font-heading text-2xl font-semibold">Os seus dados</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Só o essencial para confirmar a sua marcação.
            </p>
            <form id="dados-form" className="mt-6 space-y-4">
              <div>
                <Label htmlFor="nome">Nome *</Label>
                <Input id="nome" name="nome" required minLength={2} autoComplete="name" defaultValue={clientDetails?.nome} className="mt-1.5" />
              </div>
              <div>
                <Label htmlFor="telefone">Telefone *</Label>
                <Input
                  id="telefone"
                  name="telefone"
                  type="tel"
                  required
                  placeholder="+351 912 345 678"
                  autoComplete="tel"
                  defaultValue={clientDetails?.telefone}
                  className="mt-1.5"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Para gerir a sua marcação. Nunca será partilhado.
                </p>
              </div>
              <div>
                <Label htmlFor="notas">Notas (opcional)</Label>
                <Textarea id="notas" name="notas" rows={2} maxLength={500} defaultValue={clientDetails?.notas} className="mt-1.5" />
              </div>
              <div className="space-y-2 rounded-2xl bg-muted/60 p-4">
                <label className="flex items-start gap-2.5 text-sm">
                  <input type="checkbox" name="rgpd" required defaultChecked={Boolean(clientDetails)} className="mt-0.5 h-4 w-4 accent-[var(--primary)]" />
                  <span>
                    Li e aceito a{" "}
                    <a href="/privacidade" target="_blank" className="underline underline-offset-2">
                      Política de Privacidade
                    </a>{" "}
                    *
                  </span>
                </label>
                <label className="flex items-start gap-2.5 text-sm">
                  <input type="checkbox" name="marketing" defaultChecked={clientDetails?.marketing ?? false} className="mt-0.5 h-4 w-4 accent-[var(--primary)]" />
                  <span className="text-muted-foreground">
                    Quero receber novidades e promoções (opcional)
                  </span>
                </label>
              </div>
            </form>
          </section>
        )}

        {/* Step 4: confirm */}
        {step === 4 && (
          <section>
            <h1 className="font-heading text-2xl font-semibold">Confirme a marcação</h1>
            <div className="animate-fade-in mt-6 space-y-4 rounded-2xl border border-border/70 bg-card p-5">
              <SummaryRow label="Serviços">
                <ul className="space-y-1">
                  {selected.map((s) => (
                    <li key={s.id}>
                      {s.name}{" "}
                      <span className="text-xs text-muted-foreground">
                        ({s.durationMin} min · {formatEuros(s.price)})
                      </span>
                    </li>
                  ))}
                </ul>
              </SummaryRow>
              <SummaryRow label="Profissional">
                {staffId ? staff.find((s) => s.id === staffId)?.displayName : "Sem preferência"}
              </SummaryRow>
              <SummaryRow label="Quando">
                {dateStr &&
                  timeStr &&
                  `${new Date(`${dateStr}T${timeStr}:00`).toLocaleDateString("pt-PT", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                  })} às ${timeStr}`}
              </SummaryRow>
              <SummaryRow label="Duração">{totalMin} minutos</SummaryRow>
              <SummaryRow label="Total">
                <span className="font-semibold text-primary">{formatEuros(totalPrice)}</span>
              </SummaryRow>
              <p className="rounded-xl bg-muted px-3 py-2.5 text-xs text-muted-foreground">
                💳 Pagamento efetuado no local. {cancellationPolicyText}
              </p>
            </div>
            {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
          </section>
        )}
      </div>

      {/* Navigation */}
      <div className="sticky bottom-4 z-10 mt-8">
        <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-background/90 p-3 shadow-lg backdrop-blur-md">
          {step > 0 && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => goToStep(Math.max(0, step - 1))}
              className="rounded-full"
            >
              ← Voltar
            </Button>
          )}
          <div className="ml-auto flex items-center gap-3">
            {selected.length > 0 && step < 4 && (
              <span className="hidden text-sm text-muted-foreground tabular-nums sm:block">
                {formatEuros(totalPrice)} · {totalMin} min
              </span>
            )}
            {step < 4 ? (
              <Button
                type="button"
                disabled={!canAdvance}
                onClick={() => goToStep(step + 1)}
                className="rounded-full px-7"
              >
                Continuar
              </Button>
            ) : (
              <Button
                type="button"
                disabled={submitting || !clientDetails}
                onClick={() => void submit()}
                className="rounded-full px-7"
              >
                {submitting ? "A marcar..." : "Confirmar marcação"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[100px_1fr] gap-3 text-sm sm:grid-cols-[130px_1fr]">
      <span className="text-muted-foreground">{label}</span>
      <div>{children}</div>
    </div>
  );
}

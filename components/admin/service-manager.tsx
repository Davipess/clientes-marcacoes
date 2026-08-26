"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatEuros } from "@/lib/format";

type ServiceItem = {
  id: string;
  categoryId: string;
  name: string;
  description: string;
  durationMin: number;
  price: number;
  imageUrl: string | null;
};

type Category = { id: string; name: string };

/** Resize + compress an image in the browser before upload. */
async function optimizeImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1200 / bitmap.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => resolve(blob ?? file),
      "image/webp",
      0.82,
    );
  });
}

export function ServiceManager({
  categories,
  initialServices,
}: {
  categories: Category[];
  initialServices: ServiceItem[];
}) {
  const [services, setServices] = useState(initialServices);
  const [cats, setCats] = useState(categories);
  const [editing, setEditing] = useState<ServiceItem | "novo" | null>(null);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  async function api(url: string, method: string, body?: unknown) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Erro.");
      return json;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro de rede.");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function uploadImage(file: File): Promise<string | null> {
    const optimized = await optimizeImage(file);
    const form = new FormData();
    form.append("ficheiro", new File([optimized], "foto.webp", { type: "image/webp" }));
    try {
      const res = await fetch("/api/admin/imagens", { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Erro no envio da imagem.");
      return json.url as string;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro no envio da imagem.");
      return null;
    }
  }

  function startEdit(service: ServiceItem | "novo") {
    setError(null);
    setEditing(service);
  }

  async function handleImageChange(
    e: React.ChangeEvent<HTMLInputElement>,
    previewEl: HTMLImageElement | null,
  ) {
    const file = e.target.files?.[0];
    const current = editing;
    if (!file || current === null || typeof current === "string") return;
    const url = await uploadImage(file);
    if (url) {
      setEditing({ ...current, imageUrl: url });
      if (previewEl) previewEl.src = url;
    }
  }

  async function saveService(formData: FormData) {
    if (editing === null) return;
    const isEdit = typeof editing === "object";
    const categoryId = String(formData.get("categoryId"));
    const payload = {
      ...(isEdit ? { id: editing.id } : {}),
      categoryId,
      name: String(formData.get("name")),
      description: String(formData.get("description")) || null,
      durationMin: Number(formData.get("durationMin")),
      price: Number(String(formData.get("price")).replace(",", ".")),
      imageUrl:
        typeof editing === "object" ? editing.imageUrl : formData.get("imageUrl") || null,
    };

    const result = isEdit
      ? await api("/api/admin/servicos", "PATCH", payload)
      : await api("/api/admin/servicos", "POST", payload);
    if (!result) return;

    // Refresh list from server state.
    window.location.reload();
  }

  async function addCategory() {
    if (!newCategoryName.trim()) return;
    const result = await api("/api/admin/categorias", "POST", {
      name: newCategoryName.trim(),
    });
    if (!result) return;
    setCats((prev) => [...prev, { id: result.id, name: newCategoryName.trim() }]);
    setNewCategoryName("");
  }

  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  async function removeService(service: ServiceItem) {
    if (pendingDelete !== service.id) {
      setPendingDelete(service.id);
      return;
    }
    setPendingDelete(null);
    const result = await api("/api/admin/servicos", "DELETE", { id: service.id });
    if (!result) return;
    setServices((prev) => prev.filter((s) => s.id !== service.id));
  }

  const draft = typeof editing === "object" ? editing : null;

  return (
    <div className="mt-6">
      {/* Category creation */}
      <div className="flex flex-col gap-2 rounded-2xl border border-border/70 bg-card p-4 sm:flex-row">
        <Input
          value={newCategoryName}
          onChange={(e) => setNewCategoryName(e.target.value)}
          placeholder="Nova categoria (ex.: Unhas, Depilação...)"
          maxLength={80}
          className="flex-1"
        />
        <Button type="button" onClick={addCategory} disabled={busy || !newCategoryName.trim()} className="rounded-full">
          Adicionar categoria
        </Button>
      </div>

      {/* Services grouped by category */}
      {cats.map((cat) => (
        <section key={cat.id} className="mt-8">
          <h2 className="font-heading text-lg font-semibold text-primary">{cat.name}</h2>
          <div className="mt-3 space-y-2">
            {services.filter((s) => s.categoryId === cat.id).length === 0 && (
              <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                Sem serviços nesta categoria ainda.
              </p>
            )}
            {services
              .filter((s) => s.categoryId === cat.id)
              .map((service) => (
                <div
                  key={service.id}
                  className="flex items-center gap-3 rounded-2xl border border-border/70 bg-card p-3"
                >
                  <div
                    aria-hidden
                    className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-secondary to-accent"
                    style={
                      service.imageUrl
                        ? { backgroundImage: `url(${service.imageUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
                        : undefined
                    }
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{service.name}</p>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {service.durationMin} min · {formatEuros(service.price)}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => startEdit(service)}>
                    Editar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={
                      pendingDelete === service.id
                        ? "bg-destructive text-white hover:bg-destructive"
                        : "text-destructive hover:text-destructive"
                    }
                    onClick={() => removeService(service)}
                  >
                    {pendingDelete === service.id ? "Confirmar?" : "Eliminar"}
                  </Button>
                </div>
              ))}
          </div>
        </section>
      ))}

      <Button
        type="button"
        onClick={() => {
          if (cats.length > 0) startEdit("novo");
        }}
        disabled={cats.length === 0}
        className="mt-6 rounded-full px-6"
      >
        + Novo serviço
      </Button>
      {cats.length === 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          Crie primeiro uma categoria.
        </p>
      )}

      {error && (
        <p className="mt-4 rounded-xl bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {/* Editor */}
      {(editing === "novo" || draft) && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-card p-6 shadow-2xl animate-rise-in sm:rounded-3xl">
            <h2 className="font-heading text-xl font-semibold">
              {draft ? `Editar: ${draft.name}` : "Novo serviço"}
            </h2>

            <form ref={formRef} action={saveService} className="mt-5 space-y-4">
              <div>
                <Label htmlFor="svc-cat">Categoria *</Label>
                <select
                  id="svc-cat"
                  name="categoryId"
                  required
                  defaultValue={draft?.categoryId ?? cats[0]?.id}
                  className="mt-1.5 w-full rounded-md border border-input bg-card px-3 py-2"
                >
                  {cats.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label htmlFor="svc-name">Nome *</Label>
                <Input id="svc-name" name="name" required minLength={2} maxLength={120} defaultValue={draft?.name} className="mt-1.5" />
              </div>

              <div>
                <Label htmlFor="svc-desc">Descrição</Label>
                <Textarea id="svc-desc" name="description" rows={2} maxLength={1000} defaultValue={draft?.description} className="mt-1.5" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="svc-duration">Duração (minutos) *</Label>
                  <Input
                    id="svc-duration"
                    name="durationMin"
                    type="number"
                    required
                    min={5}
                    max={600}
                    step={5}
                    defaultValue={draft?.durationMin ?? 30}
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="svc-price">Preço (€) *</Label>
                  <Input
                    id="svc-price"
                    name="price"
                    type="text"
                    inputMode="decimal"
                    required
                    pattern="[0-9]+([.,][0-9]{1,2})?"
                    defaultValue={draft ? String(draft.price).replace(".", ",") : ""}
                    placeholder="15,00"
                    className="mt-1.5"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="svc-photo">Foto do serviço</Label>
                <div className="mt-1.5 flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    id="svc-preview"
                    alt=""
                    className="h-16 w-16 rounded-xl bg-gradient-to-br from-secondary to-accent object-cover"
                    src={draft?.imageUrl ?? undefined}
                  />
                  <input
                    id="svc-photo-input"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="text-sm file:mr-3 file:rounded-full file:border-0 file:bg-secondary file:px-4 file:py-2 file:text-sm file:font-medium file:text-secondary-foreground hover:file:brightness-95"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file && draft) void handleImageChange(e, null);
                    }}
                  />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  A imagem é otimizada automaticamente (máx. 1200px).
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={busy} className="rounded-full px-7">
                  {busy ? "A guardar..." : "Guardar"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

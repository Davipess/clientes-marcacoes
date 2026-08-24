"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { SiteContent } from "@/lib/public-data";

export function SiteContentEditor({ initial }: { initial: SiteContent }) {
  const router = useRouter();
  const [content, setContent] = useState<SiteContent>(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof SiteContent>(key: K, value: SiteContent[K]) {
    setContent((prev) => ({ ...prev, [key]: value }));
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/conteudo", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(content),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Erro ao guardar o conteúdo.");
        return;
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      router.refresh();
    } catch {
      setError("Erro de rede.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mt-8 space-y-4 rounded-2xl border border-border/70 bg-card p-5">
      <h2 className="font-heading text-lg font-semibold">Conteúdo do site</h2>
      <p className="text-xs text-muted-foreground">
        Os textos da página inicial — torne o site seu sem tocar em código.
        As alterações são imediatas no site público.
      </p>

      <div>
        <Label htmlFor="sc-badge">Etiqueta do topo</Label>
        <Input
          id="sc-badge"
          value={content.heroBadge}
          onChange={(e) => set("heroBadge", e.target.value)}
          maxLength={60}
          className="mt-1"
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="sc-title">Título principal</Label>
          <Input
            id="sc-title"
            value={content.heroTitle}
            onChange={(e) => set("heroTitle", e.target.value)}
            maxLength={80}
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="sc-highlight">Destaque do título (a cor)</Label>
          <Input
            id="sc-highlight"
            value={content.heroTitleHighlight}
            onChange={(e) => set("heroTitleHighlight", e.target.value)}
            maxLength={80}
            className="mt-1"
          />
        </div>
      </div>
      <div>
        <Label htmlFor="sc-subtitle">Subtítulo</Label>
        <Textarea
          id="sc-subtitle"
          value={content.heroSubtitle}
          onChange={(e) => set("heroSubtitle", e.target.value)}
          rows={2}
          maxLength={250}
          className="mt-1"
        />
      </div>
      <div>
        <Label htmlFor="sc-about-title">Título da secção sobre nós</Label>
        <Input
          id="sc-about-title"
          value={content.aboutTitle}
          onChange={(e) => set("aboutTitle", e.target.value)}
          maxLength={80}
          className="mt-1"
        />
      </div>
      {content.about.map((item, i) => (
        <div key={i} className="grid gap-2 rounded-xl bg-muted/50 p-3 sm:grid-cols-[200px_1fr]">
          <div>
            <Label htmlFor={`sc-about-t-${i}`} className="text-xs">
              Item {i + 1} — título
            </Label>
            <Input
              id={`sc-about-t-${i}`}
              value={item.title}
              onChange={(e) => {
                const about = [...content.about];
                about[i] = { ...item, title: e.target.value };
                set("about", about);
              }}
              maxLength={60}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor={`sc-about-x-${i}`} className="text-xs">
              Item {i + 1} — texto
            </Label>
            <Textarea
              id={`sc-about-x-${i}`}
              value={item.text}
              onChange={(e) => {
                const about = [...content.about];
                about[i] = { ...item, text: e.target.value };
                set("about", about);
              }}
              rows={2}
              maxLength={300}
              className="mt-1"
            />
          </div>
        </div>
      ))}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="sc-cta">Título do chamativo final</Label>
          <Input
            id="sc-cta"
            value={content.ctaTitle}
            onChange={(e) => set("ctaTitle", e.target.value)}
            maxLength={80}
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="sc-cta-sub">Subtítulo do chamativo</Label>
          <Input
            id="sc-cta-sub"
            value={content.ctaSubtitle}
            onChange={(e) => set("ctaSubtitle", e.target.value)}
            maxLength={250}
            className="mt-1"
          />
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button
        type="button"
        size="sm"
        className="rounded-full px-6"
        disabled={saving}
        onClick={save}
      >
        {saving ? "A guardar..." : "Guardar conteúdo"}
      </Button>
      {saved && (
        <span className="animate-fade-in ml-2 text-xs text-green-700">
          Guardado ✓ — já visível no site
        </span>
      )}
    </section>
  );
}

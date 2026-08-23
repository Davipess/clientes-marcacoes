import Link from "next/link";
import type { Metadata } from "next";
import { getPublicData } from "@/lib/public-data";
import { formatEuros } from "@/lib/format";
import { Reveal } from "@/components/site/reveal";

export const metadata: Metadata = {
  title: "Serviços — Salão Exemplo",
  description: "Veja os serviços, preços e durações disponíveis.",
};

export default async function ServicosPage() {
  const data = await getPublicData();

  if (!data || data.categories.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-24 text-center">
        <h1 className="font-heading text-3xl font-semibold">Serviços</h1>
        <p className="mt-3 text-muted-foreground">
          Os serviços serão brevemente publicados.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-14">
      <Reveal>
        <h1 className="font-heading text-3xl font-semibold sm:text-4xl">Serviços</h1>
        <p className="mt-2 text-muted-foreground">
          Escolha um serviço para começar a sua marcação.
        </p>
      </Reveal>

      {data.categories.map((category) => (
        <section key={category.id} className="mt-10">
          <Reveal>
            <h2 className="font-heading text-xl font-semibold text-primary">
              {category.name}
            </h2>
          </Reveal>
          <Reveal className="stagger mt-4 space-y-3">
            {category.services.map((service) => (
              <Link
                key={service.id}
                href={`/marcar?servico=${service.id}`}
                className="group flex items-center justify-between gap-4 rounded-2xl border border-border/70 bg-card p-5 transition-all duration-300 hover:border-primary/40 hover:shadow-md hover:shadow-primary/5"
              >
                <div className="min-w-0">
                  <h3 className="font-medium transition-colors group-hover:text-primary">
                    {service.name}
                  </h3>
                  {service.description && (
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                      {service.description}
                    </p>
                  )}
                  <p className="mt-2 text-xs text-muted-foreground">
                    {service.durationMin} minutos
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <span className="text-lg font-semibold tabular-nums">
                    {formatEuros(service.price)}
                  </span>
                  <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground opacity-80 transition-opacity group-hover:opacity-100">
                    Marcar
                  </span>
                </div>
              </Link>
            ))}
          </Reveal>
        </section>
      ))}
    </div>
  );
}

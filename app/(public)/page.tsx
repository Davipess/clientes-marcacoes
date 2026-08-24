import Link from "next/link";
import { getPublicData } from "@/lib/public-data";
import { Reveal } from "@/components/site/reveal";
import { formatEuros } from "@/lib/format";

export default async function HomePage() {
  const data = await getPublicData();
  if (!data) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-24 text-center">
        <h1 className="font-heading text-3xl font-semibold">Brevemente</h1>
        <p className="mt-3 text-muted-foreground">
          O salão está a preparar as suas marcações online.
        </p>
      </div>
    );
  }

  const content = data.business.siteContent;
  const featured = data.categories
    .flatMap((c) => c.services)
    .slice(0, 4);

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-b from-accent/70 via-background to-background"
        />
        <div className="relative mx-auto flex max-w-6xl flex-col items-center px-4 pb-20 pt-20 text-center sm:pb-28 sm:pt-28">
          <span className="animate-fade-in rounded-full border border-primary/25 bg-card px-4 py-1 text-xs font-medium tracking-wide text-primary">
            {content.heroBadge}
          </span>
          <h1 className="animate-rise-in mt-6 max-w-2xl font-heading text-4xl font-semibold leading-tight tracking-tight text-foreground sm:text-5xl md:text-6xl [animation-delay:100ms]">
            {content.heroTitle}
            <br />
            <span className="text-primary">{content.heroTitleHighlight}</span>
          </h1>
          <p className="animate-rise-in mt-5 max-w-xl text-base text-muted-foreground sm:text-lg [animation-delay:200ms]">
            {content.heroSubtitle}
          </p>
          <div className="animate-rise-in mt-8 flex flex-col gap-3 [animation-delay:300ms] sm:flex-row">
            <Link
              href="/marcar"
              className="rounded-full bg-primary px-8 py-3.5 text-base font-medium text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:brightness-110 hover:shadow-primary/30 active:scale-[0.98]"
            >
              Marcar agora
            </Link>
            <Link
              href="/servicos"
              className="rounded-full border border-border bg-card px-8 py-3.5 text-base font-medium text-foreground transition-colors hover:border-primary/40 hover:text-primary active:scale-[0.98]"
            >
              Ver serviços
            </Link>
          </div>
        </div>
      </section>

      {/* Featured services */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <Reveal>
          <h2 className="reveal font-heading text-2xl font-semibold sm:text-3xl">
            Serviços populares
          </h2>
          <p className="reveal mt-2 text-muted-foreground [animation-delay:80ms]">
            Os favoritos das nossas clientes.
          </p>
        </Reveal>
        <Reveal className="stagger mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {featured.map((service) => (
            <Link
              key={service.id}
              href={`/marcar?servico=${service.id}`}
              className="group reveal rounded-2xl border border-border/70 bg-card p-5 transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5"
            >
              <div
                aria-hidden
                className="mb-4 h-28 rounded-xl bg-gradient-to-br from-secondary via-accent to-secondary"
              />
              <h3 className="font-medium group-hover:text-primary">{service.name}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {service.durationMin} min · {formatEuros(service.price)}
              </p>
            </Link>
          ))}
        </Reveal>
      </section>

      {/* About / trust */}
      <section className="border-y border-border/60 bg-card/60">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <Reveal>
            <h2 className="reveal font-heading text-2xl font-semibold sm:text-3xl">
              {content.aboutTitle}
            </h2>
          </Reveal>
          <Reveal className="stagger mt-10 grid gap-10 sm:grid-cols-3">
            {content.about.map((item) => (
              <div key={item.title} className="reveal">
                <h3 className="font-heading text-lg font-semibold text-primary">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {item.text}
                </p>
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      {/* Location */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <Reveal>
          <h2 className="reveal font-heading text-2xl font-semibold sm:text-3xl">
            Onde nos encontra
          </h2>
          <div className="reveal mt-6 flex flex-col justify-between gap-6 rounded-2xl border border-border/70 bg-card p-6 sm:flex-row sm:items-center [animation-delay:120ms]">
            <div>
              <p className="text-lg font-medium">{data.business.name}</p>
              {data.business.address && (
                <p className="mt-1 text-sm text-muted-foreground">{data.business.address}</p>
              )}
              {data.business.phone && (
                <p className="mt-1 text-sm text-muted-foreground">{data.business.phone}</p>
              )}
            </div>
            {data.business.address && (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(data.business.address)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-fit items-center rounded-full border border-border px-5 py-2.5 text-sm font-medium transition-colors hover:border-primary/40 hover:text-primary"
              >
                Abrir no Google Maps ↗
              </a>
            )}
          </div>
        </Reveal>
      </section>

      {/* Final CTA */}
      <section className="mx-auto max-w-6xl px-4 pb-24">
        <Reveal>
          <div className="reveal rounded-3xl bg-gradient-to-br from-primary to-primary/80 px-6 py-14 text-center shadow-xl shadow-primary/15 sm:px-12">
            <h2 className="font-heading text-2xl font-semibold text-primary-foreground sm:text-3xl">
              {content.ctaTitle}
            </h2>
            <p className="mx-auto mt-3 max-w-md text-sm text-primary-foreground/85 sm:text-base">
              {content.ctaSubtitle}
            </p>
            <Link
              href="/marcar"
              className="mt-7 inline-block rounded-full bg-card px-8 py-3.5 font-medium text-foreground shadow-md transition-all hover:brightness-95 active:scale-[0.98]"
            >
              Marcar agora
            </Link>
          </div>
        </Reveal>
      </section>
    </>
  );
}

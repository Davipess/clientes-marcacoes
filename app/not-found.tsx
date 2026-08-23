import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
      <p className="animate-fade-in font-heading text-7xl font-semibold text-primary/90 sm:text-8xl">
        404
      </p>
      <div
        aria-hidden
        className="animate-rise-in mt-4 text-3xl [animation-delay:150ms]"
      >
        💅
      </div>
      <h1 className="animate-rise-in mt-4 font-heading text-2xl font-semibold [animation-delay:250ms]">
        Esta página não existe
      </h1>
      <p className="animate-rise-in mt-2 max-w-sm text-sm text-muted-foreground [animation-delay:350ms]">
        Talvez tenha sido movida ou o endereço esteja incorreto. Mas as suas
        unhas continuam à sua espera.
      </p>
      <div className="animate-rise-in mt-8 flex flex-col gap-3 [animation-delay:450ms] sm:flex-row">
        <Link
          href="/"
          className="rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow-md shadow-primary/20 transition-all hover:brightness-110 active:scale-[0.98]"
        >
          Voltar ao início
        </Link>
        <Link
          href="/marcar"
          className="rounded-full border border-border bg-card px-6 py-3 text-sm font-medium transition-colors hover:border-primary/40 hover:text-primary active:scale-[0.98]"
        >
          Marcar um serviço
        </Link>
      </div>
    </div>
  );
}

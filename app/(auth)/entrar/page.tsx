"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function EntrarPage() {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [aCarregar, setACarregar] = useState(false);

  async function submeter(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(null);
    setACarregar(true);
    const dados = Object.fromEntries(new FormData(e.currentTarget));
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dados),
      });
      const json = await res.json();
      if (!res.ok) {
        setErro(json.error ?? "Erro ao iniciar sessão");
        return;
      }
      router.push(json.redirect ?? "/admin");
    } catch {
      setErro("Erro de rede. Tente novamente.");
    } finally {
      setACarregar(false);
    }
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
      <h1 className="mb-1 text-xl font-semibold">Iniciar sessão</h1>
      <p className="mb-6 text-sm text-neutral-500">
        Área reservada a administradores e colaboradores.
      </p>

      <form onSubmit={submeter} className="space-y-4">
        <div>
          <label htmlFor="email" className="mb-1 block text-sm font-medium">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className="w-full rounded-md border border-neutral-300 px-3 py-2 focus:ring-2 focus:ring-neutral-900 focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="password" className="mb-1 block text-sm font-medium">
            Palavra-passe
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="w-full rounded-md border border-neutral-300 px-3 py-2 focus:ring-2 focus:ring-neutral-900 focus:outline-none"
          />
        </div>

        {erro && <p className="text-sm text-red-600">{erro}</p>}

        <button
          type="submit"
          disabled={aCarregar}
          className="w-full rounded-md bg-neutral-900 px-3 py-2 font-medium text-white hover:bg-neutral-700 disabled:opacity-50"
        >
          {aCarregar ? "A entrar..." : "Entrar"}
        </button>
      </form>

      <p className="mt-4 text-center text-sm">
        <a href="/recuperar-palavra-passe" className="text-neutral-500 hover:text-neutral-800">
          Esqueceu-se da palavra-passe?
        </a>
      </p>
    </div>
  );
}

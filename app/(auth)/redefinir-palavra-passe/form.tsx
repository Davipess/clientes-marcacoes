"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";

export default function RedefinirForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [erro, setErro] = useState<string | null>(null);
  const [concluido, setConcluido] = useState(false);
  const [aCarregar, setACarregar] = useState(false);

  async function submeter(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(null);
    const form = e.currentTarget;
    const dados = Object.fromEntries(new FormData(form));
    if (dados.password !== dados.confirmacao) {
      setErro("As palavras-passe não coincidem.");
      return;
    }
    setACarregar(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password: dados.password }),
      });
      const json = await res.json();
      if (!res.ok) {
        setErro(json.error ?? "Erro ao redefinir a palavra-passe.");
        return;
      }
      setConcluido(true);
    } catch {
      setErro("Erro de rede. Tente novamente.");
    } finally {
      setACarregar(false);
    }
  }

  if (concluido) {
    return (
      <div className="rounded-xl border border-neutral-200 bg-white p-6 text-center shadow-sm">
        <h1 className="text-xl font-semibold">Palavra-passe redefinida</h1>
        <p className="mt-2 mb-6 text-sm text-neutral-600">
          Inicie sessão com a sua nova palavra-passe.
        </p>
        <a
          href="/entrar"
          className="inline-block rounded-md bg-neutral-900 px-4 py-2 font-medium text-white hover:bg-neutral-700"
        >
          Ir para o início de sessão
        </a>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
      <h1 className="mb-1 text-xl font-semibold">Nova palavra-passe</h1>
      <p className="mb-6 text-sm text-neutral-500">
        Mínimo de 12 caracteres, com maiúsculas, minúsculas e um dígito.
      </p>

      {token ? (
        <form onSubmit={submeter} className="space-y-4">
          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium">
              Nova palavra-passe
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={12}
              autoComplete="new-password"
              className="w-full rounded-md border border-neutral-300 px-3 py-2 focus:ring-2 focus:ring-neutral-900 focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="confirmacao" className="mb-1 block text-sm font-medium">
              Confirmar palavra-passe
            </label>
            <input
              id="confirmacao"
              name="confirmacao"
              type="password"
              required
              minLength={12}
              autoComplete="new-password"
              className="w-full rounded-md border border-neutral-300 px-3 py-2 focus:ring-2 focus:ring-neutral-900 focus:outline-none"
            />
          </div>

          {erro && <p className="text-sm text-red-600">{erro}</p>}

          <button
            type="submit"
            disabled={aCarregar}
            className="w-full rounded-md bg-neutral-900 px-3 py-2 font-medium text-white hover:bg-neutral-700 disabled:opacity-50"
          >
            {aCarregar ? "A guardar..." : "Guardar nova palavra-passe"}
          </button>
        </form>
      ) : (
        <p className="text-sm text-red-600">
          Link inválido. Peça uma nova recuperação de palavra-passe.
        </p>
      )}
    </div>
  );
}

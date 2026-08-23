"use client";

import { useState } from "react";

export default function RecuperarPage() {
  const [enviado, setEnviado] = useState(false);
  const [aCarregar, setACarregar] = useState(false);

  async function submeter(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setACarregar(true);
    const dados = Object.fromEntries(new FormData(e.currentTarget));
    try {
      await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dados),
      });
    } finally {
      setACarregar(false);
      setEnviado(true);
    }
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
      <h1 className="mb-1 text-xl font-semibold">Recuperar palavra-passe</h1>

      {enviado ? (
        <p className="mt-6 text-sm text-neutral-600">
          Se existir uma conta associada a este email, receberá em breve as
          instruções para redefinir a palavra-passe.
        </p>
      ) : (
        <>
          <p className="mb-6 text-sm text-neutral-500">
            Indique o seu email e enviar-lhe-emos um link de recuperação.
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
            <button
              type="submit"
              disabled={aCarregar}
              className="w-full rounded-md bg-neutral-900 px-3 py-2 font-medium text-white hover:bg-neutral-700 disabled:opacity-50"
            >
              {aCarregar ? "A enviar..." : "Enviar link de recuperação"}
            </button>
          </form>
        </>
      )}
    </div>
  );
}

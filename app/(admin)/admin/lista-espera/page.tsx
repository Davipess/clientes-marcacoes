import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Lista de Espera — Administração" };

export default async function ListaEsperaPage() {
  const user = await getAuthUser();
  if (!user?.businessId) redirect("/entrar");

  const entries = await prisma.waitlistEntry.findMany({
    where: { businessId: user.businessId, status: { in: ["WAITING", "NOTIFIED"] } },
    include: { service: { select: { name: true } } },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="font-heading text-2xl font-semibold">Lista de Espera</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Clientes que ficaram na fila quando não havia horário disponível.
      </p>

      {entries.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">Ninguém na lista de espera.</p>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {entries.map((e) => (
            <div key={e.id} className="flex items-center justify-between rounded-xl border bg-card p-4">
              <div>
                <div className="font-medium">{e.clientName}</div>
                <div className="text-xs text-muted-foreground">
                  {e.service.name} · {e.preferredDate.toLocaleDateString("pt-PT", { weekday: "long", day: "numeric", month: "numeric" })}
                  {e.preferredTime ? ` · ${e.preferredTime}` : ""}
                </div>
                <div className="text-xs text-muted-foreground">{e.clientPhone}</div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  e.status === "NOTIFIED" ? "bg-yellow-100 text-yellow-800" : "bg-blue-100 text-blue-800"
                }`}>
                  {e.status === "NOTIFIED" ? "Notificado" : "Aguardar"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

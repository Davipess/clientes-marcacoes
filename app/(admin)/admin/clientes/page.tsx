import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { decryptPii } from "@/lib/crypto";
import { ClientManager } from "@/components/admin/client-manager";

export const metadata: Metadata = { title: "Clientes — Administração" };

export default async function AdminClientesPage() {
  const user = await getAuthUser();
  if (!user?.businessId) redirect("/entrar");

  const clients = await prisma.client.findMany({
    where: { businessId: user.businessId },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      emailEnc: true,
      notes: true,
      marketingConsent: true,
      appointments: {
        where: { status: { in: ["CONFIRMED", "COMPLETED"] } },
        select: { startAt: true },
        orderBy: { startAt: "desc" },
      },
    },
  });

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="font-heading text-2xl font-semibold">Clientes</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Os contactos estão encriptados na base de dados e apenas visíveis aqui.
      </p>
      <ClientManager
        clients={clients.map((c) => ({
          id: c.id,
          name: c.name,
          email: c.emailEnc ? decryptPii(c.emailEnc) : null,
          notes: c.notes ?? "",
          marketingConsent: c.marketingConsent,
          visits: c.appointments.length,
          lastVisit: c.appointments[0]?.startAt?.toISOString() ?? null,
        }))}
      />
    </div>
  );
}

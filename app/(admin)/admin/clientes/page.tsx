import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { decryptPiiSafe } from "@/lib/crypto";
import { ClientManager } from "@/components/admin/client-manager";

export const metadata: Metadata = { title: "Clientes — Administração" };

export default async function AdminClientesPage() {
  const user = await getAuthUser();
  if (!user?.businessId) redirect("/entrar");

  const [settings, clientsList] = await Promise.all([
    prisma.businessSettings.findUnique({
      where: { businessId: user.businessId },
      select: { noShowFlagThreshold: true },
    }),
    prisma.client.findMany({
      where: {
        businessId: user.businessId,
        // Anonymized clients (GDPR erasure) no longer identify a real person.
        phoneHash: { not: { startsWith: "anon-" } },
      },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        phoneEnc: true,
        notes: true,
        marketingConsent: true,
        noShowCount: true,
        blocked: true,
        blockReason: true,
        appointments: {
          where: { status: { in: ["CONFIRMED", "COMPLETED"] } },
          select: { startAt: true },
          orderBy: { startAt: "desc" },
        },
      },
    }),
  ]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="font-heading text-2xl font-semibold">Clientes</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Os contactos estão encriptados na base de dados e apenas visíveis aqui.
      </p>
      <ClientManager
        noShowFlagThreshold={settings?.noShowFlagThreshold ?? 2}
        clients={clientsList.map((c) => ({
          id: c.id,
          name: c.name,
          phone: decryptPiiSafe(c.phoneEnc) ?? "(indisponível)",
          notes: c.notes ?? "",
          marketingConsent: c.marketingConsent,
          noShowCount: c.noShowCount,
          blocked: c.blocked,
          blockReason: c.blockReason,
          visits: c.appointments.length,
          lastVisit: c.appointments[0]?.startAt?.toISOString() ?? null,
        }))}
      />
    </div>
  );
}

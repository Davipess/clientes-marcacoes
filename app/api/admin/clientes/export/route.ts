import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-guard";
import { audit } from "@/lib/audit";
import { decryptPiiSafe } from "@/lib/crypto";

function csvEscape(value: string): string {
  // Neutralize CSV injection (=, +, -, @ prefixes) and quote properly.
  const safe = value.replace(/"/g, '""').replace(/^([=+\-@])/, "'$1");
  return `"${safe}"`;
}

export async function GET(request: Request) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;

  const clients = await prisma.client.findMany({
    where: {
      businessId: guard.businessId,
      phoneHash: { not: { startsWith: "anon-" } },
    },
    orderBy: { name: "asc" },
    select: {
      name: true,
      phoneEnc: true,
      notes: true,
      marketingConsent: true,
      gdprConsentAt: true,
      appointments: {
        where: { status: { in: ["CONFIRMED", "COMPLETED"] } },
        select: { startAt: true },
        orderBy: { startAt: "desc" },
      },
    },
  });

  const rows = [
    ["Nome", "Telefone", "Visitas", "UltimaVisita", "ClienteDesde", "AceitaNovidades"],
    ...clients.map((c) => [
      c.name,
      decryptPiiSafe(c.phoneEnc) ?? "",
      String(c.appointments.length),
      c.appointments[0]
        ? c.appointments[0].startAt.toISOString().slice(0, 10)
        : "",
      c.gdprConsentAt ? c.gdprConsentAt.toISOString().slice(0, 10) : "",
      c.marketingConsent ? "Sim" : "Nao",
    ]),
  ];

  const csv = rows.map((row) => row.map(csvEscape).join(",")).join("\r\n");

  await audit(guard.businessId, guard.email, "clients.export", `${clients.length} clientes`);

  return new Response(`\uFEFF${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="clientes-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}

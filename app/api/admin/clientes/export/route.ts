import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-guard";
import { audit } from "@/lib/audit";
import { clientIpFrom, rateLimit } from "@/lib/rate-limit";
import { decryptPiiSafe, generateToken, sha256Hex } from "@/lib/crypto";

function csvEscape(value: string): string {
  // Neutralize CSV injection (=, +, -, @ prefixes) and quote properly.
  const safe = value.replace(/"/g, '""').replace(/^([=+\-@])/, "'$1");
  return `"${safe}"`;
}

// POST /api/admin/clientes/export — request an export, returns a confirmation token
export async function POST(request: Request) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;

  const ip = clientIpFrom(request);
  if (!rateLimit(`csvexport-req:${ip}`, 10, 300_000).ok) {
    return Response.json({ error: "Demasiados pedidos." }, { status: 429 });
  }

  const rawToken = generateToken(32);
  const tokenHash = sha256Hex(rawToken);
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

  // Store the hashed token temporarily in audit log
  await prisma.auditLog.create({
    data: {
      businessId: guard.businessId,
      actorEmail: guard.email,
      action: "clients.export.request",
      detail: tokenHash,
      createdAt: expiresAt, // reuse as expiry marker
    },
  });

  await audit(guard.businessId, guard.email, "clients.export.request", "token issued");

  return Response.json({ token: rawToken, expiresInSeconds: 300 });
}

// GET /api/admin/clientes/export?token=xxx — download the CSV with a valid token
export async function GET(request: Request) {
  const guard = await requireAdmin(request);
  const ip = clientIpFrom(request);
  if (!rateLimit(`csvexport:${ip}`, 5, 300_000).ok) {
    return Response.json({ error: "Demasiados pedidos." }, { status: 429 });
  }
  if (!guard.ok) return guard.response;

  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");
  if (!token || token.length < 20) {
    return Response.json({ error: "Token inválido. Solicite a exportação primeiro." }, { status: 400 });
  }

  const tokenHash = sha256Hex(token);

  // Find and consume the token (delete it to prevent reuse)
  const log = await prisma.auditLog.findFirst({
    where: {
      businessId: guard.businessId,
      actorEmail: guard.email,
      action: "clients.export.request",
      detail: tokenHash,
      createdAt: { gte: new Date(Date.now() - 5 * 60 * 1000) },
    },
  });

  if (!log) {
    return Response.json({ error: "Token expirado ou inválido. Solicite a exportação novamente." }, { status: 403 });
  }

  // Delete the token to prevent reuse
  await prisma.auditLog.delete({ where: { id: log.id } });

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

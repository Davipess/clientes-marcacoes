import { prisma } from "@/lib/db";
import { piiLookupHash, normalizePhone } from "@/lib/crypto";
import { useVoucher } from "@/lib/loyalty";
import { rateLimit } from "@/lib/rate-limit";
import { z } from "zod";

const schema = z.object({
  businessId: z.string().min(1),
  phone: z.string().min(8).max(20),
  voucherId: z.string().min(1),
});

export async function POST(request: Request) {
  // Rate limit: 3 voucher uses per minute per IP
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  if (!rateLimit(`loyalty-voucher:${ip}`, 3, 60_000).ok) {
    return Response.json({ error: "Demasiados pedidos." }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Dados inválidos." }, { status: 400 });
  }

  const phoneHash = piiLookupHash(normalizePhone(parsed.data.phone));

  const client = await prisma.client.findFirst({
    where: { businessId: parsed.data.businessId, phoneHash },
    select: { id: true },
  });

  if (!client) {
    return Response.json({ error: "Cliente não encontrado." }, { status: 404 });
  }

  const result = await useVoucher(
    parsed.data.businessId,
    client.id,
    parsed.data.voucherId,
  );

  if (!result.ok) {
    return Response.json({ error: result.message }, { status: 400 });
  }

  return Response.json({ ok: true });
}

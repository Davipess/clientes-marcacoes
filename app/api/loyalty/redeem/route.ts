import { prisma } from "@/lib/db";
import { piiLookupHash, normalizePhone } from "@/lib/crypto";
import { redeemReward } from "@/lib/loyalty";
import { z } from "zod";

const schema = z.object({
  businessId: z.string().min(1),
  phone: z.string().min(8).max(20),
  rewardId: z.string().min(1),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Dados inválidos." }, { status: 400 });
  }

  const phoneHash = piiLookupHash(normalizePhone(parsed.data.phone));

  // Find client
  const client = await prisma.client.findFirst({
    where: { businessId: parsed.data.businessId, phoneHash },
    select: { id: true },
  });

  if (!client) {
    return Response.json({ error: "Cliente não encontrado." }, { status: 404 });
  }

  const result = await redeemReward(
    parsed.data.businessId,
    client.id,
    parsed.data.rewardId,
  );

  if (!result.ok) {
    return Response.json({ error: result.message }, { status: 400 });
  }

  return Response.json({ ok: true, newBalance: result.newBalance });
}

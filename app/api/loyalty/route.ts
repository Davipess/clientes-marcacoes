import { prisma } from "@/lib/db";
import { piiLookupHash, normalizePhone } from "@/lib/crypto";
import { z } from "zod";

const schema = z.object({
  businessId: z.string().min(1),
  phone: z.string().min(8).max(20),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const businessId = url.searchParams.get("businessId") ?? "";
  const phone = url.searchParams.get("phone") ?? "";

  const parsed = schema.safeParse({ businessId, phone });
  if (!parsed.success) {
    return Response.json({ error: "Parâmetros inválidos." }, { status: 400 });
  }

  const phoneHash = piiLookupHash(normalizePhone(parsed.data.phone));

  const client = await prisma.client.findFirst({
    where: { businessId: parsed.data.businessId, phoneHash },
    select: { id: true },
  });

  if (!client) {
    return Response.json({ points: 0, totalEarned: 0, rewards: [], vouchers: [] });
  }

  const loyaltyCard = await prisma.loyaltyCard.findUnique({
    where: { businessId_clientId: { businessId: parsed.data.businessId, clientId: client.id } },
  });

  // Get active rewards
  const rewards = await prisma.loyaltyReward.findMany({
    where: { businessId: parsed.data.businessId, active: true },
    select: { id: true, name: true, description: true, pointsCost: true },
    orderBy: { pointsCost: "asc" },
  });

  // Get active vouchers
  const vouchers = await prisma.loyaltyVoucher.findMany({
    where: {
      businessId: parsed.data.businessId,
      clientId: client.id,
      status: "ACTIVE",
    },
    select: { id: true, rewardName: true, pointsCost: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  if (!loyaltyCard) {
    return Response.json({ points: 0, totalEarned: 0, rewards, vouchers });
  }

  return Response.json({
    points: loyaltyCard.points,
    totalEarned: loyaltyCard.totalEarned,
    rewards,
    vouchers,
  });
}

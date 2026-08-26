import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-guard";
import { bonusPoints } from "@/lib/loyalty";
import { z } from "zod";

export async function GET(request: Request) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;

  const cards = await prisma.loyaltyCard.findMany({
    where: { businessId: guard.businessId },
    include: {
      client: { select: { id: true, name: true, phoneEnc: true } },
      transactions: { orderBy: { createdAt: "desc" }, take: 5 },
    },
    orderBy: { points: "desc" },
  });

  const rewards = await prisma.loyaltyReward.findMany({
    where: { businessId: guard.businessId, active: true },
    orderBy: { pointsCost: "asc" },
  });

  return Response.json({ cards, rewards });
}

const bonusSchema = z.object({
  clientId: z.string().min(1),
  points: z.number().int().min(1).max(100),
  reason: z.string().min(1).max(100),
});

export async function POST(request: Request) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;

  const body = await request.json().catch(() => null);
  const parsed = bonusSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Dados inválidos." }, { status: 400 });
  }

  const result = await bonusPoints(
    guard.businessId,
    parsed.data.clientId,
    parsed.data.points,
    parsed.data.reason,
  );

  return Response.json({ ok: true, newBalance: result.newBalance });
}

import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-guard";
import { bonusPoints } from "@/lib/loyalty";
import { mutationLimit } from "@/lib/rate-limit";
import { z } from "zod";

export async function GET(request: Request) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;

  const cards = await prisma.loyaltyCard.findMany({
    where: { businessId: guard.businessId },
    include: {
      client: { select: { id: true, name: true } },
      transactions: { orderBy: { createdAt: "desc" }, take: 5 },
    },
    orderBy: { points: "desc" },
  });

  const rewards = await prisma.loyaltyReward.findMany({
    where: { businessId: guard.businessId },
    orderBy: { pointsCost: "asc" },
  });

  return Response.json({ cards, rewards });
}

const bonusSchema = z.object({
  action: z.literal("bonus"),
  clientId: z.string().min(1),
  points: z.number().int().min(1).max(100),
  reason: z.string().min(1).max(100),
});

const createRewardSchema = z.object({
  action: z.literal("createReward"),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  pointsCost: z.number().int().min(1).max(10000),
});

export async function POST(request: Request) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;
  const limited = mutationLimit(request, "admin/loyalty");
  if (limited) return limited;

  const body = await request.json().catch(() => null);

  // Try bonus action first
  const bonusParsed = bonusSchema.safeParse(body);
  if (bonusParsed.success) {
    const result = await bonusPoints(
      guard.businessId,
      bonusParsed.data.clientId,
      bonusParsed.data.points,
      bonusParsed.data.reason,
    );
    return Response.json({ ok: true, newBalance: result.newBalance });
  }

  // Try create reward action
  const rewardParsed = createRewardSchema.safeParse(body);
  if (rewardParsed.success) {
    const reward = await prisma.loyaltyReward.create({
      data: {
        businessId: guard.businessId,
        name: rewardParsed.data.name,
        description: rewardParsed.data.description ?? null,
        pointsCost: rewardParsed.data.pointsCost,
      },
    });
    return Response.json({ ok: true, id: reward.id }, { status: 201 });
  }

  return Response.json({ error: "Dados inválidos." }, { status: 400 });
}

const updateRewardSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  pointsCost: z.number().int().min(1).max(10000).optional(),
  active: z.boolean().optional(),
});

export async function PUT(request: Request) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;
  const limited = mutationLimit(request, "admin/loyalty");
  if (limited) return limited;

  const body = await request.json().catch(() => null);
  const parsed = updateRewardSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Dados inválidos." }, { status: 400 });
  }

  const { id, ...data } = parsed.data;

  // Verify ownership
  const existing = await prisma.loyaltyReward.findFirst({
    where: { id, businessId: guard.businessId },
  });
  if (!existing) {
    return Response.json({ error: "Recompensa não encontrada." }, { status: 404 });
  }

  const reward = await prisma.loyaltyReward.update({
    where: { id },
    data,
  });

  return Response.json({ ok: true, reward });
}

export async function DELETE(request: Request) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;
  const limited = mutationLimit(request, "admin/loyalty");
  if (limited) return limited;

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) {
    return Response.json({ error: "ID obrigatório." }, { status: 400 });
  }

  // Verify ownership
  const existing = await prisma.loyaltyReward.findFirst({
    where: { id, businessId: guard.businessId },
  });
  if (!existing) {
    return Response.json({ error: "Recompensa não encontrada." }, { status: 404 });
  }

  // Soft delete - just deactivate
  await prisma.loyaltyReward.update({
    where: { id },
    data: { active: false },
  });

  return Response.json({ ok: true });
}

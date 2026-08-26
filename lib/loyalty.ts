import { prisma } from "@/lib/db";

/**
 * Get or create loyalty card for a client.
 */
export async function getOrCreateCard(businessId: string, clientId: string) {
  return prisma.loyaltyCard.upsert({
    where: { businessId_clientId: { businessId, clientId } },
    create: { businessId, clientId },
    update: {},
  });
}

/**
 * Earn points when an appointment is completed.
 */
export async function earnPoints(
  businessId: string,
  clientId: string,
  appointmentId: string,
  points: number,
) {
  const card = await getOrCreateCard(businessId, clientId);

  await prisma.$transaction([
    prisma.loyaltyCard.update({
      where: { id: card.id },
      data: { points: { increment: points }, totalEarned: { increment: points } },
    }),
    prisma.loyaltyTransaction.create({
      data: {
        businessId,
        clientId,
        cardId: card.id,
        appointmentId,
        points,
        reason: "booking_completed",
      },
    }),
  ]);

  return { cardId: card.id, newBalance: card.points + points };
}

/**
 * Redeem points for a reward.
 */
export async function redeemReward(
  businessId: string,
  clientId: string,
  rewardId: string,
) {
  const card = await getOrCreateCard(businessId, clientId);
  const reward = await prisma.loyaltyReward.findFirst({
    where: { id: rewardId, businessId, active: true },
  });

  if (!reward) return { ok: false, message: "Recompensa não encontrada." };
  if (card.points < reward.pointsCost) {
    return { ok: false, message: `Pontos insuficientes. Tem ${card.points}, precisa de ${reward.pointsCost}.` };
  }

  await prisma.$transaction([
    prisma.loyaltyCard.update({
      where: { id: card.id },
      data: { points: { decrement: reward.pointsCost } },
    }),
    prisma.loyaltyTransaction.create({
      data: {
        businessId,
        clientId,
        cardId: card.id,
        points: -reward.pointsCost,
        reason: "reward_redeemed",
      },
    }),
  ]);

  return { ok: true, newBalance: card.points - reward.pointsCost };
}

/**
 * Bonus points (admin manual).
 */
export async function bonusPoints(
  businessId: string,
  clientId: string,
  points: number,
  reason: string,
) {
  const card = await getOrCreateCard(businessId, clientId);

  await prisma.$transaction([
    prisma.loyaltyCard.update({
      where: { id: card.id },
      data: { points: { increment: points }, totalEarned: { increment: points } },
    }),
    prisma.loyaltyTransaction.create({
      data: { businessId, clientId, cardId: card.id, points, reason },
    }),
  ]);

  return { newBalance: card.points + points };
}

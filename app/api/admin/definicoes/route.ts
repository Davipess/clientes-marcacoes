﻿import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-guard";
import { z } from "zod";
import { audit } from "@/lib/audit";

const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

const hoursEntry = z.array(
  z.object({
    open: z.string().regex(/^([01]\d|2[0-4]):[0-5]\d$/),
    close: z.string().regex(/^([01]\d|2[0-4]):[0-5]\d$/),
  }),
);

const settingsSchema = z.object({
  name: z.string().trim().min(2).max(120),
  address: z.string().trim().max(300).nullable(),
  email: z.string().trim().email().max(254).nullable(),
  openingHours: z.object(
    Object.fromEntries(DAY_KEYS.map((k) => [k, hoursEntry.nullable()])),
  ),
  bufferMinutes: z.number().int().min(0).max(120),
  minLeadHours: z.number().int().min(0).max(168),
  maxLeadDays: z.number().int().min(1).max(365),
  cancellationWindowHours: z.number().int().min(0).max(168),
  cancellationPolicyText: z.string().trim().max(1000),
  maxActiveBookingsPerPhone: z.number().int().min(1).max(20),
  maxBookingsPerPhonePerDay: z.number().int().min(1).max(20),
  noShowFlagThreshold: z.number().int().min(1).max(20),
  retentionMonths: z.number().int().min(6).max(120),
});

export async function PATCH(request: Request) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;

  const body = await request.json().catch(() => null);
  const parsed = settingsSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
      { status: 400 },
    );
  }
  const data = parsed.data;

  // Sanity: open before close on every interval.
  for (const day of DAY_KEYS) {
    for (const iv of data.openingHours[day] ?? []) {
      if (iv.open >= iv.close) {
        return Response.json(
          { error: "A hora de abertura deve ser anterior à de fecho." },
          { status: 400 },
        );
      }
    }
  }

  await prisma.$transaction([
    prisma.business.update({
      where: { id: guard.businessId },
      data: {
        name: data.name,
        address: data.address,
        email: data.email,
      },
    }),
    prisma.businessSettings.upsert({
      where: { businessId: guard.businessId },
      update: {
        openingHours: data.openingHours,
        bufferMinutes: data.bufferMinutes,
        minLeadHours: data.minLeadHours,
        maxLeadDays: data.maxLeadDays,
        cancellationWindowHours: data.cancellationWindowHours,
        cancellationPolicyText: data.cancellationPolicyText,
        maxActiveBookingsPerPhone: data.maxActiveBookingsPerPhone,
        maxBookingsPerPhonePerDay: data.maxBookingsPerPhonePerDay,
        noShowFlagThreshold: data.noShowFlagThreshold,
        retentionMonths: data.retentionMonths,
      },
      create: {
        businessId: guard.businessId,
        openingHours: data.openingHours,
        bufferMinutes: data.bufferMinutes,
        minLeadHours: data.minLeadHours,
        maxLeadDays: data.maxLeadDays,
        cancellationWindowHours: data.cancellationWindowHours,
        cancellationPolicyText: data.cancellationPolicyText,
        maxActiveBookingsPerPhone: data.maxActiveBookingsPerPhone,
        maxBookingsPerPhonePerDay: data.maxBookingsPerPhonePerDay,
        noShowFlagThreshold: data.noShowFlagThreshold,
        retentionMonths: data.retentionMonths,
      },
    }),
  ]);

  await audit(guard.businessId, guard.email, "settings.update");
  return Response.json({ ok: true });
}

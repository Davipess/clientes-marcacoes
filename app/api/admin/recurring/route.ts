import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-guard";
import { cancelRecurringRule, createRecurringRule } from "@/lib/recurring";
import { z } from "zod";

export async function GET(request: Request) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;

  const rules = await prisma.recurringRule.findMany({
    where: { businessId: guard.businessId },
    include: {
      client: { select: { name: true, phoneEnc: true } },
      staff: { select: { displayName: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return Response.json({ rules: rules.filter((r) => r.client.phoneEnc) });
}

const createSchema = z.object({
  clientId: z.string().min(1),
  staffId: z.string().min(1),
  serviceIds: z.array(z.string().min(1)).min(1),
  frequency: z.enum(["weekly", "biweekly", "monthly"]),
  dayOfWeek: z.number().min(0).max(6).optional(),
  dayOfMonth: z.number().min(1).max(31).optional(),
  timeOfDay: z.string().regex(/^\d{2}:\d{2}$/),
  startDate: z.string().datetime(),
});

export async function POST(request: Request) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Dados inválidos." }, { status: 400 });
  }

  const rule = await createRecurringRule({
    businessId: guard.businessId,
    ...parsed.data,
    startDate: new Date(parsed.data.startDate),
  });

  return Response.json({ ok: true, id: rule.id }, { status: 201 });
}

const cancelSchema = z.object({ id: z.string().min(1) });

export async function PATCH(request: Request) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;

  const body = await request.json().catch(() => null);
  const parsed = cancelSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Dados inválidos." }, { status: 400 });
  }

  await cancelRecurringRule(parsed.data.id);
  return Response.json({ ok: true });
}

import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-guard";
import { cancelRecurringRule } from "@/lib/recurring";
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

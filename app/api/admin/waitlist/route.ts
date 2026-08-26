import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-guard";
import { cancelWaitlistEntry } from "@/lib/waitlist";
import { z } from "zod";

export async function GET(request: Request) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;

  const entries = await prisma.waitlistEntry.findMany({
    where: { businessId: guard.businessId, status: { in: ["WAITING", "NOTIFIED"] } },
    include: { service: { select: { name: true } } },
    orderBy: { createdAt: "asc" },
  });

  return Response.json({ entries });
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

  await cancelWaitlistEntry(parsed.data.id, guard.businessId);
  return Response.json({ ok: true });
}

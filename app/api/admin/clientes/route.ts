import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-guard";
import { z } from "zod";

const notesSchema = z.object({
  id: z.string().min(1),
  notes: z.string().trim().max(2000).nullable(),
});

export async function GET(request: Request) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;
  const clients = await prisma.client.findMany({
    where: { businessId: guard.businessId },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  return Response.json({ clients });
}

export async function PATCH(request: Request) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;

  const body = await request.json().catch(() => null);
  const parsed = notesSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Dados inválidos." }, { status: 400 });
  }

  await prisma.client.updateMany({
    where: { id: parsed.data.id, businessId: guard.businessId },
    data: { notes: parsed.data.notes },
  });
  return Response.json({ ok: true });
}

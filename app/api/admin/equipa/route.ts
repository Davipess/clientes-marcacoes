import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-guard";
import { z } from "zod";

const toggleSchema = z.object({
  staffId: z.string().min(1),
  active: z.boolean(),
});

export async function GET(request: Request) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;

  const staff = await prisma.staff.findMany({
    where: { businessId: guard.businessId },
    select: {
      id: true,
      displayName: true,
      active: true,
      userId: true,
      user: { select: { email: true } },
    },
    orderBy: { displayName: "asc" },
  });
  return Response.json({ staff });
}

export async function PATCH(request: Request) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;

  const body = await request.json().catch(() => null);
  const parsed = toggleSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Dados inválidos." }, { status: 400 });
  }
  const { staffId, active } = parsed.data;

  const staff = await prisma.staff.findFirst({
    where: { id: staffId, businessId: guard.businessId },
  });
  if (!staff) {
    return Response.json({ error: "Técnica não encontrada." }, { status: 404 });
  }

  if (!active) {
    const activeCount = await prisma.staff.count({
      where: { businessId: guard.businessId, active: true },
    });
    if (activeCount <= 1) {
      return Response.json(
        { error: "Tem de existir pelo menos uma técnica ativa." },
        { status: 400 },
      );
    }
  }

  await prisma.staff.update({
    where: { id: staffId },
    data: { active },
  });

  // Deactivating: remove future availability impact happens automatically
  // because the availability engine only considers active staff.
  return Response.json({ ok: true });
}

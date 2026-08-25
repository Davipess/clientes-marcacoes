import { prisma } from "@/lib/db";
import { mutationLimit } from "@/lib/rate-limit";
import { requireAdmin } from "@/lib/admin-guard";
import { z } from "zod";

const categorySchema = z.object({
  name: z.string().trim().min(2).max(80),
});

export async function POST(request: Request) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;
  const limited = mutationLimit(request, "admin/categorias");
  if (limited) return limited;

  const body = await request.json().catch(() => null);
  const parsed = categorySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Nome inválido." }, { status: 400 });
  }

  const count = await prisma.serviceCategory.count({
    where: { businessId: guard.businessId },
  });

  try {
    const category = await prisma.serviceCategory.create({
      data: {
        businessId: guard.businessId,
        name: parsed.data.name,
        sortOrder: count,
      },
      select: { id: true },
    });
    return Response.json({ ok: true, id: category.id }, { status: 201 });
  } catch {
    return Response.json({ error: "Essa categoria já existe." }, { status: 409 });
  }
}

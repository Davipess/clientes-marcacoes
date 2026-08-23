import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-guard";
import { z } from "zod";

const serviceSchema = z.object({
  categoryId: z.string().min(1),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(1000).optional().nullable(),
  durationMin: z.number().int().min(5).max(600),
  price: z.number().min(0).max(10000),
  imageUrl: z.string().startsWith("/api/imagens/").optional().nullable(),
});

const serviceUpdateSchema = serviceSchema.partial().extend({
  id: z.string().min(1),
  archived: z.boolean().optional(),
});

export async function POST(request: Request) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;

  const body = await request.json().catch(() => null);
  const parsed = serviceSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
      { status: 400 },
    );
  }

  // Category must belong to this business.
  const category = await prisma.serviceCategory.findFirst({
    where: { id: parsed.data.categoryId, businessId: guard.businessId },
  });
  if (!category) {
    return Response.json({ error: "Categoria inválida." }, { status: 400 });
  }

  const { imageUrl, ...data } = parsed.data;
  const service = await prisma.service.create({
    data: {
      ...data,
      description: data.description ?? null,
      businessId: guard.businessId,
      ...(imageUrl ? { imageUrl } : {}),
    },
    select: { id: true },
  });

  // New services must be bookable immediately: link every active staff member.
  const activeStaff = await prisma.staff.findMany({
    where: { businessId: guard.businessId, active: true },
    select: { id: true },
  });
  if (activeStaff.length > 0) {
    await prisma.serviceStaff.createMany({
      data: activeStaff.map((s) => ({ serviceId: service.id, staffId: s.id })),
      skipDuplicates: true,
    });
  }

  return Response.json({ ok: true, id: service.id }, { status: 201 });
}

export async function PATCH(request: Request) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;

  const body = await request.json().catch(() => null);
  const parsed = serviceUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
      { status: 400 },
    );
  }
  const { id, imageUrl, categoryId, ...rest } = parsed.data;

  if (categoryId) {
    const category = await prisma.serviceCategory.findFirst({
      where: { id: categoryId, businessId: guard.businessId },
    });
    if (!category) {
      return Response.json({ error: "Categoria inválida." }, { status: 400 });
    }
  }

  await prisma.service.updateMany({
    where: { id, businessId: guard.businessId },
    data: {
      ...rest,
      ...(categoryId ? { categoryId } : {}),
      ...(imageUrl !== undefined ? { imageUrl } : {}),
    },
  });

  // Re-activating an archived service: restore staff links so it is bookable.
  if (rest.archived === false) {
    const activeStaff = await prisma.staff.findMany({
      where: { businessId: guard.businessId, active: true },
      select: { id: true },
    });
    if (activeStaff.length > 0) {
      await prisma.serviceStaff.createMany({
        data: activeStaff.map((s) => ({ serviceId: id, staffId: s.id })),
        skipDuplicates: true,
      });
    }
  }

  return Response.json({ ok: true });
}

export async function DELETE(request: Request) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;

  const body = (await request.json().catch(() => null)) as { id?: string } | null;
  const id = body?.id;
  if (!id) return Response.json({ error: "ID em falta." }, { status: 400 });

  // Soft-delete keeps appointment history consistent.
  await prisma.service.updateMany({
    where: { id, businessId: guard.businessId },
    data: { archived: true },
  });
  return Response.json({ ok: true });
}

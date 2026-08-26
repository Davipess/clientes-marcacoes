import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-guard";
import { mutationLimit } from "@/lib/rate-limit";
import { z } from "zod";
import { audit } from "@/lib/audit";

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
  const limited = mutationLimit(request, "admin/servicos");
  if (limited) return limited;

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

  await audit(guard.businessId, guard.email, 'service.create', parsed.data.name);
  return Response.json({ ok: true, id: service.id }, { status: 201 });
}

export async function PATCH(request: Request) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;
  const limited = mutationLimit(request, "admin/servicos");
  if (limited) return limited;

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

  await audit(guard.businessId, guard.email, "service.update", id);
  return Response.json({ ok: true });
}

export async function DELETE(request: Request) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;
  const limited = mutationLimit(request, "admin/servicos");
  if (limited) return limited;

  const body = (await request.json().catch(() => null)) as { id?: string } | null;
  const id = body?.id;
  if (!id) return Response.json({ error: "ID em falta." }, { status: 400 });

  // Check service exists and belongs to this business
  const service = await prisma.service.findFirst({
    where: { id, businessId: guard.businessId },
    select: { id: true },
  });
  if (!service) return Response.json({ error: "Serviço não encontrado." }, { status: 404 });

  // Hard delete: remove appointment items referencing this service, staff links, then service
  await prisma.$transaction([
    prisma.appointmentItem.deleteMany({ where: { serviceId: id } }),
    prisma.serviceStaff.deleteMany({ where: { serviceId: id } }),
    prisma.service.delete({ where: { id } }),
  ]);
  await audit(guard.businessId, guard.email, "service.delete", id);
  return Response.json({ ok: true });
}

import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-guard";

/**
 * Solo mode: creates the admin's own technician profile with a default
 * schedule and links every existing service, so the salon owner can take
 * bookings without managing a separate staff account.
 */
export async function POST(request: Request) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;

  const existing = await prisma.staff.findFirst({
    where: { businessId: guard.businessId, userId: guard.userId },
  });
  if (existing) {
    return Response.json({ error: "Já tem um perfil de técnica." }, { status: 409 });
  }

  const staff = await prisma.staff.create({
    data: {
      businessId: guard.businessId,
      userId: guard.userId,
      displayName: "Gestora",
      bio: null,
    },
  });

  // Default schedule: Monday to Saturday, 09:00–18:00 (editable later).
  await prisma.workSchedule.createMany({
    data: [1, 2, 3, 4, 5, 6].map((weekday) => ({
      staffId: staff.id,
      weekday,
      startTime: "09:00",
      endTime: "18:00",
    })),
  });

  // Link every active service so nothing becomes unbookable.
  const services = await prisma.service.findMany({
    where: { businessId: guard.businessId, archived: false },
    select: { id: true },
  });
  if (services.length > 0) {
    await prisma.serviceStaff.createMany({
      data: services.map((s) => ({ serviceId: s.id, staffId: staff.id })),
      skipDuplicates: true,
    });
  }

  return Response.json({ ok: true, staffId: staff.id }, { status: 201 });
}

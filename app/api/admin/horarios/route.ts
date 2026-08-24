import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-guard";
import { audit } from "@/lib/audit";
import { z } from "zod";

const intervalSchema = z.object({
  weekday: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
});

const scheduleSchema = z.object({
  staffId: z.string().min(1),
  intervals: z.array(intervalSchema).max(30),
  serviceIds: z.array(z.string().min(1)).max(100),
});

export async function PUT(request: Request) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;

  const body = await request.json().catch(() => null);
  const parsed = scheduleSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
      { status: 400 },
    );
  }
  const { staffId, intervals, serviceIds } = parsed.data;

  const staff = await prisma.staff.findFirst({
    where: { id: staffId, businessId: guard.businessId },
    select: { id: true, displayName: true },
  });
  if (!staff) {
    return Response.json({ error: "Técnica não encontrada." }, { status: 404 });
  }

  // Sanity: start before end on every interval.
  for (const iv of intervals) {
    if (iv.startTime >= iv.endTime) {
      return Response.json(
        { error: "A hora de início deve ser anterior à de fim." },
        { status: 400 },
      );
    }
  }

  // Services must belong to this business.
  const validServices = await prisma.service.count({
    where: { id: { in: serviceIds }, businessId: guard.businessId, archived: false },
  });
  if (validServices !== serviceIds.length) {
    return Response.json({ error: "Serviço inválido." }, { status: 400 });
  }

  await prisma.$transaction([
    // Replace the weekly schedule wholesale.
    prisma.workSchedule.deleteMany({ where: { staffId } }),
    prisma.workSchedule.createMany({
      data: intervals.map((iv) => ({
        staffId,
        weekday: iv.weekday,
        startTime: iv.startTime,
        endTime: iv.endTime,
      })),
    }),
    // Replace the service links wholesale.
    prisma.serviceStaff.deleteMany({ where: { staffId } }),
    prisma.serviceStaff.createMany({
      data: serviceIds.map((serviceId) => ({ staffId, serviceId })),
      skipDuplicates: true,
    }),
  ]);

  await audit(
    guard.businessId,
    guard.email,
    "staff.schedule_update",
    `${staff.displayName} (${intervals.length} intervalos, ${serviceIds.length} serviços)`,
  );
  return Response.json({ ok: true });
}

const timeOffSchema = z.object({
  staffId: z.string().min(1),
  inicio: z.string().datetime(),
  fim: z.string().datetime(),
  motivo: z.string().trim().max(200).optional(),
});

export async function POST(request: Request) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;

  const body = await request.json().catch(() => null);
  const parsed = timeOffSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Dados inválidos." }, { status: 400 });
  }
  const { staffId, inicio, fim, motivo } = parsed.data;
  if (new Date(inicio) >= new Date(fim)) {
    return Response.json(
      { error: "A data de início deve ser anterior ao fim." },
      { status: 400 },
    );
  }

  const staff = await prisma.staff.findFirst({
    where: { id: staffId, businessId: guard.businessId },
    select: { id: true, displayName: true },
  });
  if (!staff) {
    return Response.json({ error: "Técnica não encontrada." }, { status: 404 });
  }

  const exception = await prisma.availabilityException.create({
    data: {
      businessId: guard.businessId,
      staffId,
      startAt: new Date(inicio),
      endAt: new Date(fim),
      reason: motivo ?? "Folga atribuída pela gerência",
    },
    select: { id: true },
  });

  await audit(guard.businessId, guard.email, "staff.time_off", staff.displayName);
  return Response.json({ ok: true, id: exception.id }, { status: 201 });
}

const removeTimeOffSchema = z.object({ id: z.string().min(1) });

export async function DELETE(request: Request) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;

  const body = await request.json().catch(() => null);
  const parsed = removeTimeOffSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Dados inválidos." }, { status: 400 });
  }

  await prisma.availabilityException.deleteMany({
    where: { id: parsed.data.id, businessId: guard.businessId },
  });
  return Response.json({ ok: true });
}

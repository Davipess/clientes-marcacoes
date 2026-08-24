import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-guard";
import { hashPassword } from "@/lib/crypto";
import { emailSchema, passwordSchema } from "@/lib/validation";
import { Role } from "@/lib/generated/prisma/client";
import { z } from "zod";
import { audit } from "@/lib/audit";

const createSchema = z.object({
  displayName: z.string().trim().min(2).max(80),
  email: emailSchema,
  password: passwordSchema,
  bio: z.string().trim().max(500).optional(),
});

export async function POST(request: Request) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
      { status: 400 },
    );
  }
  const { displayName, email, password, bio } = parsed.data;

  const duplicate = await prisma.user.findUnique({
    where: {
      businessId_email: { businessId: guard.businessId, email },
    },
  });
  if (duplicate) {
    return Response.json({ error: "Esse email já está em uso." }, { status: 409 });
  }

  const user = await prisma.user.create({
    data: {
      businessId: guard.businessId,
      role: Role.STAFF,
      name: displayName,
      email,
      passwordHash: await hashPassword(password),
    },
  });

  const staff = await prisma.staff.create({
    data: {
      businessId: guard.businessId,
      userId: user.id,
      displayName,
      bio: bio ?? null,
    },
  });

  // Default schedule Mon-Fri 09:00–18:00; admin can adjust later.
  await prisma.workSchedule.createMany({
    data: [1, 2, 3, 4, 5].map((weekday) => ({
      staffId: staff.id,
      weekday,
      startTime: "09:00",
      endTime: "18:00",
    })),
  });

  // Link all active services so the new technician is immediately bookable.
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

  await audit(guard.businessId, guard.email, 'staff.create', email);
  return Response.json({ ok: true, staffId: staff.id }, { status: 201 });
}

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
    select: { id: true, active: true },
  });
  if (!staff) {
    return Response.json({ error: "Técnica não encontrada." }, { status: 404 });
  }

  // Only enforce the "last active technician" guard when actually
  // deactivating someone who is currently active (re-activating is always
  // allowed, and toggling an already-inactive staff member is a no-op).
  if (!active && staff.active) {
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

  await audit(guard.businessId, guard.email, active ? 'staff.activate' : 'staff.deactivate', staffId);
  return Response.json({ ok: true });
}

import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-guard";
import { createAppointment } from "@/lib/booking/create-appointment";
import { cancelAppointment } from "@/lib/booking/modify-appointment";
import { audit } from "@/lib/audit";
import { z } from "zod";

const createSchema = z.object({
  servicos: z.array(z.string().min(1)).min(1).max(10),
  inicio: z.string().datetime(),
  nome: z.string().trim().min(2).max(120),
  telefone: z
    .string()
    .trim()
    .regex(/^[+\d][\d\s().-]{7,19}$/, "Telefone inválido"),
  notas: z.string().trim().max(500).optional(),
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

  const result = await createAppointment({
    businessId: guard.businessId,
    serviceIds: parsed.data.servicos,
    startAt: new Date(parsed.data.inicio),
    source: "ADMIN",
    bypassLeadTime: true,
    client: {
      name: parsed.data.nome,
      phone: parsed.data.telefone,
      notes: parsed.data.notas,
      gdprConsent: true,
    },
  });

  if (!result.ok) {
    const status = result.code === "SLOT_TAKEN" ? 409 : 400;
    return Response.json({ error: result.message, code: result.code }, { status });
  }
  return Response.json({ ok: true, id: result.appointmentId }, { status: 201 });
}

const patchSchema = z.object({
  id: z.string().min(1),
  action: z.enum(["COMPLETED", "NO_SHOW", "CANCEL"]),
});

export async function PATCH(request: Request) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;

  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Dados inválidos." }, { status: 400 });
  }

  const { id, action } = parsed.data;

  if (action === "CANCEL") {
    const result = await cancelAppointment(id, "Cancelada pelo salão");
    if (!result.ok) {
      return Response.json({ error: result.message }, { status: 400 });
    }
    return Response.json({ ok: true });
  }

  const appointment = await prisma.appointment.findFirst({
    where: { id, businessId: guard.businessId, status: { in: ["PENDING", "CONFIRMED"] } },
    select: { id: true, clientId: true },
  });
  if (!appointment) {
    return Response.json(
      { error: "Marcação não encontrada ou já finalizada." },
      { status: 400 },
    );
  }

  await prisma.$transaction([
    prisma.appointment.update({
      where: { id: appointment.id },
      data: { status: action },
    }),
    // No-show counter lives on the client and outlives appointment cleanup.
    ...(action === "NO_SHOW"
      ? [
          prisma.client.update({
            where: { id: appointment.clientId },
            data: { noShowCount: { increment: 1 } },
          }),
        ]
      : []),
  ]);

  if (action === "NO_SHOW") {
    await audit(guard.businessId, guard.email, "appointment.no_show", appointment.id);
  }
  return Response.json({ ok: true });
}

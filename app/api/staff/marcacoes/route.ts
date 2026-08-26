import { prisma } from "@/lib/db";
import { mutationLimit } from "@/lib/rate-limit";
import { requireStaff } from "@/lib/staff-guard";
import { minimizeClientIfNoFuture } from "@/lib/retention";
import { earnPoints } from "@/lib/loyalty";
import { z } from "zod";

const patchSchema = z.object({
  id: z.string().min(1),
  action: z.enum(["COMPLETED", "NO_SHOW"]),
});

export async function PATCH(request: Request) {
  const guard = await requireStaff(request);
  if (!guard.ok) return guard.response;
  const limited = mutationLimit(request, "staff/marcacoes");
  if (limited) return limited;

  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Dados inválidos." }, { status: 400 });
  }
  const { id, action } = parsed.data;

  // Ownership: staff may only touch their own appointments.
  const appointment = await prisma.appointment.findFirst({
    where: {
      id,
      staffId: guard.staffId,
      status: { in: ["PENDING", "CONFIRMED"] },
    },
    select: { id: true, clientId: true },
  });
  if (!appointment) {
    return Response.json(
      { error: "Marcação não encontrada ou já finalizada." },
      { status: 404 },
    );
  }

  await prisma.$transaction([
    prisma.appointment.update({
      where: { id: appointment.id },
      data: { status: action },
    }),
    ...(action === "NO_SHOW"
      ? [
          prisma.client.update({
            where: { id: appointment.clientId },
            data: { noShowCount: { increment: 1 } },
          }),
        ]
      : []),
  ]);

  // Earn loyalty points on completion (1 point per service)
  if (action === "COMPLETED") {
    const items = await prisma.appointmentItem.findMany({
      where: { appointmentId: appointment.id },
    });
    if (items.length > 0) {
      await earnPoints(guard.businessId, appointment.clientId, appointment.id, items.length);
    }
  }

  await minimizeClientIfNoFuture(appointment.clientId);
  return Response.json({ ok: true });
}

import { prisma } from "@/lib/db";
import { requireStaff } from "@/lib/staff-guard";
import { z } from "zod";

const patchSchema = z.object({
  id: z.string().min(1),
  action: z.enum(["COMPLETED", "NO_SHOW"]),
});

export async function PATCH(request: Request) {
  const guard = await requireStaff(request);
  if (!guard.ok) return guard.response;

  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Dados inválidos." }, { status: 400 });
  }
  const { id, action } = parsed.data;

  // Ownership: staff may only touch their own appointments.
  const updated = await prisma.appointment.updateMany({
    where: {
      id,
      staffId: guard.staffId,
      status: { in: ["PENDING", "CONFIRMED"] },
    },
    data: { status: action },
  });
  if (updated.count === 0) {
    return Response.json(
      { error: "Marcação não encontrada ou já finalizada." },
      { status: 404 },
    );
  }
  return Response.json({ ok: true });
}

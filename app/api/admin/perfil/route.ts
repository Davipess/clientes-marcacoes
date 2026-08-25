import { prisma } from "@/lib/db";
import { mutationLimit } from "@/lib/rate-limit";
import { requireAdmin } from "@/lib/admin-guard";
import { audit } from "@/lib/audit";
import { emailSchema } from "@/lib/validation";
import { z } from "zod";

const profileSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: emailSchema,
  technicianName: z.string().trim().min(2).max(80).nullable(),
});

/**
 * Updates the logged-in admin's own profile: login name, login email and
 * the public technician display name (what clients see when booking).
 */
export async function PATCH(request: Request) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;
  const limited = mutationLimit(request, "admin/perfil");
  if (limited) return limited;

  const body = await request.json().catch(() => null);
  const parsed = profileSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
      { status: 400 },
    );
  }
  const { name, email, technicianName } = parsed.data;

  // Email must stay unique within the business (it is the login).
  const conflict = await prisma.user.findFirst({
    where: {
      businessId: guard.businessId,
      email,
      id: { not: guard.userId },
    },
    select: { id: true },
  });
  if (conflict) {
    return Response.json(
      { error: "Esse email já está em uso por outra conta." },
      { status: 409 },
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: guard.userId },
      data: { name, email },
    });
    if (technicianName !== null) {
      await tx.staff.updateMany({
        where: { businessId: guard.businessId, userId: guard.userId },
        data: { displayName: technicianName },
      });
    }
  });

  await audit(guard.businessId, guard.email, "profile.update", name);
  return Response.json({ ok: true });
}

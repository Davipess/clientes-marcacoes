import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-guard";
import { audit } from "@/lib/audit";
import { z } from "zod";

const brandingSchema = z.object({
  logoUrl: z.string().startsWith("/api/imagens/").nullable(),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  secondaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});

export async function PUT(request: Request) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;

  const body = await request.json().catch(() => null);
  const parsed = brandingSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Dados inválidos." }, { status: 400 });
  }

  await prisma.business.update({
    where: { id: guard.businessId },
    data: {
      logoUrl: parsed.data.logoUrl,
      primaryColor: parsed.data.primaryColor,
      secondaryColor: parsed.data.secondaryColor,
    },
  });

  await audit(
    guard.businessId,
    guard.email,
    "branding.update",
    `${parsed.data.primaryColor}/${parsed.data.secondaryColor}`,
  );
  return Response.json({ ok: true });
}

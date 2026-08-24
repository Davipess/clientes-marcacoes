import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-guard";
import { audit } from "@/lib/audit";
import { parseSiteContent } from "@/lib/public-data";
import { z } from "zod";

const aboutItem = z.object({
  title: z.string().trim().min(1).max(60),
  text: z.string().trim().min(1).max(300),
});

const contentSchema = z.object({
  heroBadge: z.string().trim().max(60),
  heroTitle: z.string().trim().min(1).max(80),
  heroTitleHighlight: z.string().trim().max(80),
  heroSubtitle: z.string().trim().max(250),
  aboutTitle: z.string().trim().max(80),
  about: z.array(aboutItem).min(1).max(6),
  ctaTitle: z.string().trim().max(80),
  ctaSubtitle: z.string().trim().max(250),
});

export async function PUT(request: Request) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;

  const body = await request.json().catch(() => null);
  const parsed = contentSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
      { status: 400 },
    );
  }

  const settings = await prisma.businessSettings.findUnique({
    where: { businessId: guard.businessId },
    select: { id: true },
  });
  if (!settings) {
    return Response.json(
      { error: "Definições em falta — guarde primeiro as Definições gerais." },
      { status: 400 },
    );
  }

  await prisma.businessSettings.update({
    where: { businessId: guard.businessId },
    data: { siteContent: parsed.data },
  });

  await audit(guard.businessId, guard.email, "site_content.update");
  return Response.json({ ok: true });
}

export async function GET(request: Request) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;

  const settings = await prisma.businessSettings.findUnique({
    where: { businessId: guard.businessId },
    select: { siteContent: true },
  });
  return Response.json({ content: parseSiteContent(settings?.siteContent) });
}

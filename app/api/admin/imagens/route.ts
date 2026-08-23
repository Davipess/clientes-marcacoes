import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-guard";
import { rateLimit } from "@/lib/rate-limit";

const MAX_BYTES = 400 * 1024; // images are resized client-side before upload

export async function POST(request: Request) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;

  const ip = request.headers.get("x-forwarded-for") ?? "local";
  if (!rateLimit(`upload:${ip}`, 20, 60_000).ok) {
    return Response.json({ error: "Demasiados envios." }, { status: 429 });
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("ficheiro");
  if (!(file instanceof File)) {
    return Response.json({ error: "Ficheiro em falta." }, { status: 400 });
  }
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    return Response.json(
      { error: "Formato não suportado. Use JPG, PNG ou WebP." },
      { status: 400 },
    );
  }
  if (file.size > MAX_BYTES) {
    return Response.json(
      { error: "Imagem demasiado grande (máximo 400 KB após otimização)." },
      { status: 400 },
    );
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const image = await prisma.image.create({
    data: {
      businessId: guard.businessId,
      mime: file.type,
      data: bytes,
    },
    select: { id: true },
  });

  return Response.json({ ok: true, url: `/api/imagens/${image.id}` }, { status: 201 });
}

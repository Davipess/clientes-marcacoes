import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";

export async function GET(
  request: Request,
  ctx: RouteContext<"/api/imagens/[id]">,
) {
  const { id } = await ctx.params;

  const user = await getAuthUser();
  if (!user?.businessId) {
    return new Response("Não autorizado", { status: 401 });
  }

  const image = await prisma.image.findFirst({
    where: { id, businessId: user.businessId },
    select: { mime: true, data: true },
  });
  if (!image) {
    return new Response("Não encontrado", { status: 404 });
  }
  return new Response(new Uint8Array(image.data), {
    headers: {
      "Content-Type": image.mime,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}

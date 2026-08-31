import { prisma } from "@/lib/db";

export async function GET(
  request: Request,
  ctx: RouteContext<"/api/imagens/[id]">,
) {
  const { id } = await ctx.params;

  const image = await prisma.image.findFirst({
    where: { id },
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

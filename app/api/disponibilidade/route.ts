import { prisma } from "@/lib/db";
import { getAvailableSlots } from "@/lib/booking/availability";
import { clientIpFrom, rateLimit } from "@/lib/rate-limit";

export async function GET(request: Request) {
  const ip = clientIpFrom(request);
  if (!rateLimit(`slots:${ip}`, 60, 60_000).ok) {
    return Response.json({ error: "Demasiados pedidos." }, { status: 429 });
  }

  const url = new URL(request.url);
  const servicos = url.searchParams.getAll("servico").filter(Boolean);
  const colaborador = url.searchParams.get("colaborador") ?? undefined;
  const rawDias = Number(url.searchParams.get("dias") ?? 14);
  const dias = Number.isFinite(rawDias) ? rawDias : 14;

  if (servicos.length === 0) {
    return Response.json({ error: "Indique pelo menos um serviço." }, { status: 400 });
  }

  const business = await prisma.business.findFirst();
  if (!business) {
    return Response.json({ error: "Negócio não configurado." }, { status: 500 });
  }

  try {
    const result = await getAvailableSlots({
      businessId: business.id,
      serviceIds: servicos,
      staffId: colaborador || undefined,
      days: Math.min(Math.max(dias, 1), 30),
    });
    return Response.json(result);
  } catch (error) {
    if (error instanceof Error && error.message.includes("não existem")) {
      return Response.json({ error: "Serviço inexistente." }, { status: 400 });
    }
    throw error;
  }
}

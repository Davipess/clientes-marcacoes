import { prisma } from "@/lib/db";
import { joinWaitlist } from "@/lib/waitlist";
import { z } from "zod";

const schema = z.object({
  businessId: z.string().min(1),
  clientName: z.string().min(2).max(120),
  clientPhone: z.string().min(8).max(20),
  serviceId: z.string().min(1),
  preferredDate: z.string().datetime(),
  preferredTime: z.string().optional(),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Dados inválidos." }, { status: 400 });
  }

  const service = await prisma.service.findFirst({
    where: { id: parsed.data.serviceId, businessId: parsed.data.businessId, archived: false },
  });
  if (!service) {
    return Response.json({ error: "Serviço não encontrado." }, { status: 404 });
  }

  const entry = await joinWaitlist({
    businessId: parsed.data.businessId,
    clientName: parsed.data.clientName,
    clientPhone: parsed.data.clientPhone,
    serviceId: parsed.data.serviceId,
    preferredDate: new Date(parsed.data.preferredDate),
    preferredTime: parsed.data.preferredTime,
  });

  return Response.json({ ok: true, id: entry.id });
}

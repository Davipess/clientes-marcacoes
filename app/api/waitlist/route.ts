import { prisma } from "@/lib/db";
import { joinWaitlist } from "@/lib/waitlist";
import { phoneSchema } from "@/lib/validation";
import { piiLookupHash, normalizePhone } from "@/lib/crypto";
import { rateLimit } from "@/lib/rate-limit";
import { z } from "zod";

const schema = z.object({
  businessId: z.string().min(1),
  clientName: z.string().min(2).max(120),
  clientPhone: phoneSchema,
  serviceId: z.string().min(1),
  preferredDate: z.string().datetime(),
  preferredTime: z.string().optional(),
});

export async function POST(request: Request) {
  // Rate limit: 5 waitlist joins per minute per IP
  const limited = rateLimit(`waitlist:${request.headers.get("x-forwarded-for") ?? "unknown"}`, 5, 60_000);
  if (!limited.ok) {
    return Response.json({ error: "Demasiados pedidos." }, { status: 429 });
  }

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

  // Expire old entries (older than 7 days)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  await prisma.waitlistEntry.updateMany({
    where: {
      businessId: parsed.data.businessId,
      status: { in: ["WAITING", "NOTIFIED"] },
      createdAt: { lt: sevenDaysAgo },
    },
    data: { status: "CANCELLED" },
  });

  // Check for duplicate (same phone hash + service + date already waiting)
  const phoneHash = piiLookupHash(normalizePhone(parsed.data.clientPhone));
  const existing = await prisma.waitlistEntry.findFirst({
    where: {
      businessId: parsed.data.businessId,
      serviceId: parsed.data.serviceId,
      clientPhoneHash: phoneHash,
      status: "WAITING",
      preferredDate: {
        gte: new Date(new Date(parsed.data.preferredDate).setHours(0, 0, 0, 0)),
        lt: new Date(new Date(parsed.data.preferredDate).setHours(23, 59, 59, 999)),
      },
    },
  });
  if (existing) {
    return Response.json({ error: "Já está na lista de espera para este dia." }, { status: 409 });
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

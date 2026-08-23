import { prisma } from "@/lib/db";
import { createAppointment } from "@/lib/booking/create-appointment";
import { isSameOrigin } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { emailSchema } from "@/lib/validation";
import { z } from "zod";

const bookingSchema = z.object({
  servicos: z.array(z.string().min(1)).min(1).max(10),
  colaborador: z.string().optional(),
  inicio: z.string().datetime(),
  nome: z.string().trim().min(2).max(120),
  telefone: z.string().trim().regex(/^[+\d][\d\s().-]{7,19}$/, "Telefone inválido"),
  email: emailSchema.optional(),
  notas: z.string().trim().max(500).optional(),
  consentimentoMarketing: z.boolean().optional(),
  consentimentoRGPD: z.literal(true),
});

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return Response.json({ error: "Pedido inválido" }, { status: 403 });
  }

  const ip = request.headers.get("x-forwarded-for") ?? "local";
  if (!rateLimit(`booking:${ip}`, 6, 60_000).ok) {
    return Response.json(
      { error: "Demasiadas tentativas. Aguarde um momento." },
      { status: 429 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = bookingSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
      { status: 400 },
    );
  }

  const business = await prisma.business.findFirst();
  if (!business) {
    return Response.json({ error: "Negócio não configurado." }, { status: 500 });
  }

  const result = await createAppointment({
    businessId: business.id,
    serviceIds: parsed.data.servicos,
    staffId: parsed.data.colaborador || undefined,
    startAt: new Date(parsed.data.inicio),
    client: {
      name: parsed.data.nome,
      phone: parsed.data.telefone,
      email: parsed.data.email,
      notes: parsed.data.notas,
      marketingConsent: parsed.data.consentimentoMarketing,
      gdprConsent: parsed.data.consentimentoRGPD,
    },
  });

  if (!result.ok) {
    const status = result.code === "SLOT_TAKEN" ? 409 : 400;
    return Response.json({ error: result.message, code: result.code }, { status });
  }

  // Phase 7 will send the confirmation email here (via NotificationLog queue).
  return Response.json(
    { ok: true, marcacaoId: result.appointmentId },
    { status: 201 },
  );
}

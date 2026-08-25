import { prisma } from "@/lib/db";
import { mutationLimit } from "@/lib/rate-limit";
import { requireStaff } from "@/lib/staff-guard";
import { z } from "zod";

const createSchema = z.object({
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  inicio: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  fim: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  motivo: z.string().trim().max(200).optional(),
});

export async function POST(request: Request) {
  const guard = await requireStaff(request);
  if (!guard.ok) return guard.response;
  const limited = mutationLimit(request, "staff/blocos");
  if (limited) return limited;

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Dados inválidos." }, { status: 400 });
  }
  const { data, inicio, fim, motivo } = parsed.data;
  if (inicio >= fim) {
    return Response.json(
      { error: "A hora de início deve ser anterior à de fim." },
      { status: 400 },
    );
  }

  const business = await prisma.business.findUniqueOrThrow({
    where: { id: guard.businessId },
    select: { timezone: true },
  });
  const [y, m, d] = data.split("-").map(Number);
  const [sh, sm] = inicio.split(":").map(Number);
  const [eh, em] = fim.split(":").map(Number);

  const startUtc = zonedToUtc(y, m, d, sh, sm, business.timezone);
  const endUtc = zonedToUtc(y, m, d, eh, em, business.timezone);

  await prisma.availabilityException.create({
    data: {
      businessId: guard.businessId,
      staffId: guard.staffId,
      startAt: startUtc,
      endAt: endUtc,
      reason: motivo ?? "Bloqueio da técnica",
    },
  });

  return Response.json({ ok: true }, { status: 201 });
}

const deleteSchema = z.object({ id: z.string().min(1) });

export async function DELETE(request: Request) {
  const guard = await requireStaff(request);
  if (!guard.ok) return guard.response;
  const limited = mutationLimit(request, "staff/blocos");
  if (limited) return limited;

  const body = await request.json().catch(() => null);
  const parsed = deleteSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Dados inválidos." }, { status: 400 });
  }

  await prisma.availabilityException.deleteMany({
    where: { id: parsed.data.id, staffId: guard.staffId },
  });
  return Response.json({ ok: true });
}

function zonedToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const parts: Record<string, string> = {};
  for (const p of dtf.formatToParts(new Date(guess))) parts[p.type] = p.value;
  const h = parts.hour === "24" ? 0 : Number(parts.hour);
  const offset =
    Date.UTC(+parts.year, +parts.month - 1, +parts.day, h, +parts.minute) - guess;
  return new Date(guess - offset);
}

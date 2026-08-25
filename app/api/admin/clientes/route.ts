import { prisma } from "@/lib/db";
import { mutationLimit } from "@/lib/rate-limit";
import { requireAdmin } from "@/lib/admin-guard";
import { audit } from "@/lib/audit";
import { z } from "zod";

const notesSchema = z.object({
  id: z.string().min(1),
  notes: z.string().trim().max(2000).nullable(),
});

export async function PATCH(request: Request) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;
  const limited = mutationLimit(request, "admin/clientes");
  if (limited) return limited;

  const body = await request.json().catch(() => null);
  const parsed = notesSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Dados inválidos." }, { status: 400 });
  }

  await prisma.client.updateMany({
    where: { id: parsed.data.id, businessId: guard.businessId },
    data: { notes: parsed.data.notes },
  });
  return Response.json({ ok: true });
}

const actionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("block"),
    id: z.string().min(1),
    reason: z.string().trim().min(3).max(300),
  }),
  z.object({ action: z.literal("unblock"), id: z.string().min(1) }),
  z.object({ action: z.literal("resetNoShows"), id: z.string().min(1) }),
]);

export async function PUT(request: Request) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;
  const limited = mutationLimit(request, "admin/clientes");
  if (limited) return limited;

  const body = await request.json().catch(() => null);
  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Dados inválidos." },
      { status: 400 },
    );
  }
  const { action, id } = parsed.data;

  const client = await prisma.client.findFirst({
    where: { id, businessId: guard.businessId },
    select: { id: true, name: true },
  });
  if (!client) {
    return Response.json({ error: "Cliente não encontrado." }, { status: 404 });
  }

  switch (action) {
    case "block": {
      await prisma.client.update({
        where: { id: client.id },
        data: {
          blocked: true,
          blockReason: parsed.data.reason,
          blockedAt: new Date(),
        },
      });
      await audit(guard.businessId, guard.email, "client.block", client.name);
      break;
    }
    case "unblock": {
      await prisma.client.update({
        where: { id: client.id },
        data: { blocked: false, blockReason: null, blockedAt: null },
      });
      await audit(guard.businessId, guard.email, "client.unblock", client.name);
      break;
    }
    case "resetNoShows": {
      await prisma.client.update({
        where: { id: client.id },
        data: { noShowCount: 0 },
      });
      await audit(guard.businessId, guard.email, "client.reset_no_shows", client.name);
      break;
    }
  }

  return Response.json({ ok: true });
}

const deleteSchema = z.object({ id: z.string().min(1) });

/**
 * GDPR erasure: anonymizes the client (name, encrypted contacts, notes,
 * consents) while keeping the appointment rows so the salon's history and
 * revenue stats stay intact. The phone hash is randomized so the person can
 * no longer be identified or matched.
 */
export async function DELETE(request: Request) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;
  const limited = mutationLimit(request, "admin/clientes");
  if (limited) return limited;

  const body = await request.json().catch(() => null);
  const parsed = deleteSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Dados inválidos." }, { status: 400 });
  }

  const client = await prisma.client.findFirst({
    where: { id: parsed.data.id, businessId: guard.businessId },
    select: { id: true, name: true },
  });
  if (!client) {
    return Response.json({ error: "Cliente não encontrado." }, { status: 404 });
  }

  await prisma.client.update({
    where: { id: client.id },
    data: {
      name: "Cliente anonimizado",
      phoneEnc: "[apagado]",
      phoneHash: `anon-${client.id}-${Date.now()}`,
      emailEnc: null,
      emailHash: null,
      notes: null,
      marketingConsent: false,
    },
  });

  await audit(guard.businessId, guard.email, "client.anonymize", client.name);
  return Response.json({ ok: true });
}

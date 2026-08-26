import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-guard";

export async function GET(request: Request) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;

  const since = new Date(Date.now() - 24 * 3_600_000); // last 24h

  // Get the last time the admin read notifications
  const settings = await prisma.businessSettings.findUnique({
    where: { businessId: guard.businessId },
    select: { notificationsLastReadAt: true },
  });
  const lastReadAt = settings?.notificationsLastReadAt;

  const appointments = await prisma.appointment.findMany({
    where: {
      businessId: guard.businessId,
      createdAt: { gte: since },
    },
    select: {
      id: true,
      status: true,
      startAt: true,
      createdAt: true,
      client: { select: { name: true } },
      items: { select: { serviceName: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const notifications = appointments.map((a) => ({
    id: a.id,
    title:
      a.status === "CONFIRMED"
        ? "Nova marcação"
        : a.status === "CANCELLED"
          ? "Marcação cancelada"
          : "Marcação atualizada",
    body: `${a.client.name} — ${a.items.map((i) => i.serviceName).join(" + ")} — ${a.startAt.toLocaleDateString("pt-PT", { weekday: "long", day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" })}`,
    url: "/admin/agenda",
    read: lastReadAt ? a.createdAt <= lastReadAt : false,
    createdAt: a.createdAt.toISOString(),
  }));

  return Response.json({ notifications });
}

export async function PATCH(request: Request) {
  const guard = await requireAdmin(request);
  if (!guard.ok) return guard.response;

  // Mark all current notifications as read by updating the timestamp
  await prisma.businessSettings.update({
    where: { businessId: guard.businessId },
    data: { notificationsLastReadAt: new Date() },
  });

  return Response.json({ ok: true });
}

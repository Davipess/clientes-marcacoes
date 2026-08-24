import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { TeamManager } from "@/components/admin/team-manager";

export const metadata: Metadata = { title: "Equipa — Administração" };

export default async function AdminEquipaPage() {
  const user = await getAuthUser();
  if (!user?.businessId) redirect("/entrar");

  const [staff, services] = await Promise.all([
    prisma.staff.findMany({
      where: { businessId: user.businessId },
      orderBy: { displayName: "asc" },
      select: {
        id: true,
        displayName: true,
        active: true,
        userId: true,
        workSchedules: {
          select: { weekday: true, startTime: true, endTime: true },
        },
        services: { select: { serviceId: true } },
      },
    }),
    prisma.service.findMany({
      where: { businessId: user.businessId, archived: false },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const timeOff = await prisma.availabilityException.findMany({
    where: {
      businessId: user.businessId,
      staffId: { in: staff.map((s) => s.id) },
      endAt: { gte: new Date() },
    },
    orderBy: { startAt: "asc" },
    select: { id: true, staffId: true, startAt: true, endAt: true, reason: true },
  });
  const timeOffList = timeOff.filter(
    (t): t is typeof t & { staffId: string } => t.staffId !== null,
  );

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="font-heading text-2xl font-semibold">Equipa</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Horários semanais, serviços realizados e folgas de cada técnica. As
        alterações refletem de imediato na disponibilidade pública.
      </p>
      <TeamManager
        staff={staff.map((s) => ({
          id: s.id,
          displayName: s.displayName,
          active: s.active,
          intervals: s.workSchedules.map((ws) => ({
            weekday: ws.weekday,
            startTime: ws.startTime,
            endTime: ws.endTime,
          })),
          serviceIds: s.services.map((sv) => sv.serviceId),
        }))}
        services={services}
        timeOff={timeOffList.map((t) => ({
          id: t.id,
          staffId: t.staffId,
          startAt: t.startAt.toISOString(),
          endAt: t.endAt.toISOString(),
          reason: t.reason ?? "",
        }))}
      />
    </div>
  );
}

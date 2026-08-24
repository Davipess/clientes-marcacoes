import { prisma } from "@/lib/db";

/**
 * Data-retention sweep (Phase 14): deletes final-state appointments older
 * than the configurable retention period. The client row and its no-show
 * counter are intentionally preserved — the counter outlives the records.
 * Run periodically: `npm run retention` (cron / Netlify Scheduled Function).
 */
export async function runRetentionCleanup(): Promise<{
  deletedAppointments: number;
  deletedNotifications: number;
}> {
  const settingsList = await prisma.businessSettings.findMany({
    select: { businessId: true, retentionMonths: true },
  });

  let deletedAppointments = 0;
  let deletedNotifications = 0;

  for (const settings of settingsList) {
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - settings.retentionMonths);

    const old = await prisma.appointment.findMany({
      where: {
        businessId: settings.businessId,
        status: { in: ["COMPLETED", "CANCELLED", "NO_SHOW"] },
        endAt: { lt: cutoff },
      },
      select: { id: true },
    });
    if (old.length === 0) continue;

    const ids = old.map((a) => a.id);

    // Notification logs reference appointments; clean them first.
    const notif = await prisma.notificationLog.deleteMany({
      where: { appointmentId: { in: ids } },
    });
    deletedNotifications += notif.count;

    const res = await prisma.appointment.deleteMany({
      where: { id: { in: ids } },
    });
    deletedAppointments += res.count;
  }

  return { deletedAppointments, deletedNotifications };
}

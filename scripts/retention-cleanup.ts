import "dotenv/config";
import { runRetentionCleanup } from "../lib/retention";
import { prisma } from "../lib/db";

runRetentionCleanup()
  .then((r) => {
    console.log(
      `Retenção: ${r.deletedAppointments} marcações removidas, ${r.deletedNotifications} registos de notificação removidos.`,
    );
  })
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

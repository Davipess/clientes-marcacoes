import "dotenv/config";
import { minimizeStaleContacts, runRetentionCleanup } from "../lib/retention";
import { prisma } from "../lib/db";

Promise.all([runRetentionCleanup(), minimizeStaleContacts()])
  .then(([r, m]) => {
    console.log(
      `Retenção: ${r.deletedAppointments} marcações removidas, ${r.deletedNotifications} notificações removidas, ${m} contactos minimizados (nome/telefone apagados).`,
    );
  })
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

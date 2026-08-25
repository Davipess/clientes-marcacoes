import "dotenv/config";
import { prisma } from "../lib/db";

async function main() {
  console.log("=== Limpeza de dados de teste ===");

  // 0. Apagar marcacoes + items (depende de clients e staff)
  const appointmentItems = await prisma.appointmentItem.deleteMany({});
  console.log(`[0a] AppointmentItems removidos: ${appointmentItems.count}`);
  const appointments = await prisma.appointment.deleteMany({});
  console.log(`[0b] Marcacoes removidas: ${appointments.count}`);

  // 1. Apagar audit logs
  const auditLogs = await prisma.auditLog.deleteMany({});
  console.log(`[1] Audit logs removidos: ${auditLogs.count}`);

  // 2. Apagar clientes
  const testClients = await prisma.client.deleteMany({});
  console.log(`[2] Clientes removidos: ${testClients.count}`);

  // 3. Apagar service_staff + work_schedules + time_off (depende de staff)
  const serviceStaff = await prisma.serviceStaff.deleteMany({});
  console.log(`[3] ServiceStaff removidos: ${serviceStaff.count}`);
  const schedules = await prisma.workSchedule.deleteMany({});
  console.log(`[4] WorkSchedules removidos: ${schedules.count}`);
  const timeOff = await prisma.timeOff.deleteMany({});
  console.log(`[5] TimeOff removidos: ${timeOff.count}`);

  // 4. Apagar staff
  const testStaff = await prisma.staff.deleteMany({});
  console.log(`[6] Staff removido: ${testStaff.count}`);

  // 5. Apagar sessions + notification_logs
  const sessions = await prisma.session.deleteMany({});
  console.log(`[7] Sessions removidas: ${sessions.count}`);
  const notifications = await prisma.notificationLog.deleteMany({});
  console.log(`[8] NotificationLogs removidos: ${notifications.count}`);

  // 6. Apagar utilizadores de teste
  const testUsers = await prisma.user.deleteMany({
    where: { email: { contains: "audit.local" } },
  });
  console.log(`[9] Utilizadores de teste removidos: ${testUsers.count}`);

  // 7. Garantir que o admin tem nome "Lénia"
  const admin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
  if (admin && admin.name !== "Lénia") {
    await prisma.user.update({ where: { id: admin.id }, data: { name: "Lénia" } });
    console.log("[10] Nome do admin atualizado para Lénia");
  } else {
    console.log("[10] Admin ja tem nome Lénia");
  }

  // 8. Verificar estado final
  const finalUsers = await prisma.user.findMany({ select: { email: true, role: true, name: true } });
  const finalClients = await prisma.client.count();
  const finalAppointments = await prisma.appointment.count();
  const finalAudit = await prisma.auditLog.count();
  console.log("\n=== Estado final ===");
  console.log(`Utilizadores: ${finalUsers.length}`);
  for (const u of finalUsers) console.log(`  - ${u.email} (${u.role}) ${u.name}`);
  console.log(`Clientes: ${finalClients}`);
  console.log(`Marcacoes: ${finalAppointments}`);
  console.log(`Audit logs: ${finalAudit}`);
  console.log("\nLimpeza concluida!");
}

main()
  .catch((e) => { console.error("ERR", e.message); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());

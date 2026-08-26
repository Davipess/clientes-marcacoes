import "dotenv/config";
import { prisma } from "../lib/db";
import { queueDueReminders } from "../lib/notifications";

async function main() {
  console.log("=== Reminder sweep ===");
  const queued = await queueDueReminders();
  console.log(`Lembretes enviados: ${queued}`);
}

main()
  .catch((e) => { console.error("ERR", e.message); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());

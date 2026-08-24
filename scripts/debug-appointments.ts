import "dotenv/config";
import { prisma } from "../lib/db";

async function main() {
  const appts = await prisma.appointment.findMany({
    include: {
      staff: { include: { user: { select: { email: true } } } },
      client: { select: { name: true } },
      business: { select: { name: true } },
    },
    orderBy: { startAt: "asc" },
  });
  for (const a of appts) {
    console.log(
      `${a.startAt.toISOString()} | ${a.business.name} | ${a.staff.user.email} | ${a.client.name} | ${a.status}`,
    );
  }
  console.log(`total: ${appts.length}`);
}

main()
  .catch((e) => console.error("ERR", e.message))
  .finally(() => prisma.$disconnect());

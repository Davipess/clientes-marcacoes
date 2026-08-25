import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "npx tsx prisma/seed.ts",
  },
  datasource: {
    // CLI (migracoes/studio) usa o utilizador OWNER; a aplicacao usa app_user via DATABASE_URL
    url: process.env.MIGRATE_DATABASE_URL || process.env.DATABASE_URL || "",
  },
});

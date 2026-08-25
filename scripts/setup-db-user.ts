import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../lib/generated/prisma/client";
import { randomBytes } from "node:crypto";

/**
 * Cria o utilizador de aplicacao com privilegios minimos (sem DDL):
 * a app corre com este utilizador; migracoes correm com o owner.
 * Idempotente — pode correr-se varias vezes.
 *
 * Requer MIGRATE_DATABASE_URL (owner) no .env.
 * Escreve a nova DATABASE_URL para a consola — copiar para o .env.
 */

  const ownerUrl = process.env.MIGRATE_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!ownerUrl) throw new Error("MIGRATE_DATABASE_URL/DATABASE_URL em falta");
  const owner: string = ownerUrl;

const adapter = new PrismaPg({ connectionString: ownerUrl });
const prisma = new PrismaClient({ adapter });

const APP_PASSWORD = randomBytes(24).toString("base64url"); // alfanumerico, URL-safe

async function main() {
  // Neon: criar role via SQL (CREATE ROLE em transacao nao pode — correr direto)
  await prisma.$executeRawUnsafe(
    `DO $$ BEGIN
       IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_user') THEN
         CREATE ROLE app_user LOGIN PASSWORD '${APP_PASSWORD}';
       ELSE
         ALTER ROLE app_user LOGIN PASSWORD '${APP_PASSWORD}';
       END IF;
     END $$;`,
  );

  await prisma.$executeRawUnsafe(
    `GRANT CONNECT ON DATABASE "neondb" TO app_user;`,
  );
  await prisma.$executeRawUnsafe(
    `GRANT USAGE ON SCHEMA public TO app_user;`,
  );
  await prisma.$executeRawUnsafe(
    `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;`,
  );
  // Tabelas futuras (migracoes feitas pelo owner) ficam automaticamente acessiveis.
  await prisma.$executeRawUnsafe(
    `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;`,
  );

  const host = new URL(owner).host;
  const db = new URL(owner).pathname.slice(1);
  const appUrl = `postgresql://app_user:${APP_PASSWORD}@${host}/${db}?sslmode=require&uselibpqcompat=true`;
  // Escrever para ficheiro (evita problemas de encoding no console/redirect).
  const { writeFileSync } = await import("node:fs");
  writeFileSync("db-user-url.txt", `DATABASE_URL="${appUrl}"\n`, "utf8");
  console.log("Utilizador app_user pronto. URL escrita em db-user-url.txt");
}

main()
  .catch((e) => console.error("ERR", e.message))
  .finally(() => prisma.$disconnect());

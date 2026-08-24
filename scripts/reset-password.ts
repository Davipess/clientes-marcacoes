import "dotenv/config";
import { hashPassword } from "../lib/crypto";
import { prisma } from "../lib/db";

/**
 * Emergency password reset (no email dependency).
 * Usage: npx tsx scripts/reset-password.ts <email> <nova-palavra-passe>
 * Password policy: min 12 chars, upper + lower + digit.
 */
async function main() {
  const [email, password] = process.argv.slice(2);

  if (!email || !password) {
    console.error("Uso: npx tsx scripts/reset-password.ts <email> <nova-palavra-passe>");
    process.exitCode = 1;
    return;
  }
  if (
    password.length < 12 ||
    !/[A-Z]/.test(password) ||
    !/[a-z]/.test(password) ||
    !/[0-9]/.test(password)
  ) {
    console.error(
      "Palavra-passe fraca: mínimo 12 caracteres, com maiúsculas, minúsculas e um dígito.",
    );
    process.exitCode = 1;
    return;
  }

  const user = await prisma.user.findFirst({ where: { email } });
  if (!user) {
    console.error(`Utilizador não encontrado: ${email}`);
    process.exitCode = 1;
    return;
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(password) },
    }),
    // Kill all sessions — the old password must not keep working anywhere.
    prisma.session.deleteMany({ where: { userId: user.id } }),
  ]);

  console.log(`Palavra-passe redefinida para ${email}. Todas as sessões foram terminadas.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

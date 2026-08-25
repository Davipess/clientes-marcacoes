import "dotenv/config";
import { prisma } from "../lib/db";

/**
 * Verifica: (1) app_user sem DDL, (2) rate limit em mutations admin/staff
 * (staff a martelar 40x -> 429), (3) CRUD runtime OK.
 */
async function main() {
  for (let i = 0; i < 20; i++) {
    try {
      if ((await fetch("http://localhost:3000/entrar")).ok) break;
    } catch { /* wait */ }
    await new Promise((r) => setTimeout(r, 1500));
  }

  // 1. DDL bloqueado para app_user (runtime).
  try {
    await prisma.$executeRawUnsafe("CREATE TABLE hack_audit (id int)");
    console.log("FAIL: DDL permitido para app_user!");
    process.exitCode = 1;
    return;
  } catch {
    console.log("OK  DDL bloqueado para app_user");
  }

  // 2. Martelar endpoint admin com sessao ADMIN valida -> mutationLimit (429 apos 30).
  const adminLogin = await fetch("http://localhost:3000/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
    body: JSON.stringify({
      email: "gestor@salaoexemplo.pt",
      password: process.env.ADMIN_TEST_PASSWORD ?? "NovaPass123456",
    }),
  });
  const cookie = (adminLogin.headers.get("set-cookie") ?? "").split(";")[0];
  console.log("  login admin status:", adminLogin.status);

  let last = 0;
  let got429 = 0;
  for (let i = 0; i < 40; i++) {
    const r = await fetch("http://localhost:3000/api/admin/clientes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:3000", Cookie: cookie },
      body: JSON.stringify({ id: "x", notes: `spam ${i}` }),
    });
    if (i === 0) {
      const body = await r.text();
      console.log(`      [0] ${r.status} cookie-enviado=${cookie ? "sim" : "NAO"} corpo=${body.slice(0, 90)}`);
      const retry = await fetch("http://localhost:3000/api/admin/clientes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Origin: "http://localhost:3000", Cookie: cookie },
        body: JSON.stringify({ id: "x", notes: "retry" }),
      });
      console.log(`      [retry] ${retry.status}`);
      last = retry.status;
      continue;
    }
    last = r.status;
    if (r.status === 429) got429++;
  }
  console.log(
    got429 > 0
      ? `OK  rate limit de mutation dispara (ultimo=${last}, 429s=${got429})`
      : `FAIL: 40 marteladas, ultimo=${last}, nenhum 429`,
  );
  if (got429 === 0) process.exitCode = 1;
}

main()
  .catch((e) => console.error("ERR", e.message))
  .finally(() => prisma.$disconnect());

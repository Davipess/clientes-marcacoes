import "dotenv/config";
import { prisma } from "../lib/db";

const BASE = "http://localhost:3000";
const ORIGIN = { Origin: BASE };

let passed = 0;
let failed = 0;
function assert(cond: boolean, label: string) {
  if (cond) {
    passed++;
    console.log(`  OK ${label}`);
  } else {
    failed++;
    console.error(`  FALHOU: ${label}`);
  }
}

async function main() {
  for (let i = 0; i < 20; i++) {
    try {
      if ((await fetch(`${BASE}/entrar`)).ok) break;
    } catch { /* wait */ }
    await new Promise((r) => setTimeout(r, 1500));
  }

  console.log("[S1] Headers de segurança");
  const home = await fetch(`${BASE}/`);
  const h = home.headers;
  assert(h.get("x-frame-options") === "DENY", "X-Frame-Options: DENY");
  assert(h.get("x-content-type-options") === "nosniff", "X-Content-Type-Options: nosniff");
  assert(
    h.get("referrer-policy") === "strict-origin-when-cross-origin",
    "Referrer-Policy correta",
  );
  assert(
    (h.get("permissions-policy") ?? "").includes("camera=()"),
    "Permissions-Policy bloqueia câmara/mic",
  );

  console.log("[S2] Cookie de sessão (flags)");
  const login = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...ORIGIN },
    body: JSON.stringify({
      email: "gestor@salaoexemplo.pt",
      password: "NovaPass123456",
    }),
  });
  const setCookie = login.headers.get("set-cookie") ?? "";
  assert(setCookie.includes("HttpOnly"), "HttpOnly");
  assert(/samesite=lax/i.test(setCookie), "SameSite=Lax (case-insensitive)");
  const adminCookie = setCookie.split(";")[0];

  console.log("[S3] Isolamento staff -> admin APIs");
  const staffLogin = await prisma.user.findFirst({
    where: { role: "STAFF" },
    select: { email: true },
  });
  if (staffLogin) {
    // Staff accounts have passwords we do not know here; verify via a fresh
    // known staff account instead.
    const createRes = await fetch(`${BASE}/api/admin/equipa`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...ORIGIN, Cookie: adminCookie },
      body: JSON.stringify({
        displayName: "SecTest",
        email: "sectest@salaoexemplo.pt",
        password: "PassSecTest123",
      }),
    });
    assert(createRes.ok, "staff de teste criada");
    const staffLoginRes = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...ORIGIN },
      body: JSON.stringify({
        email: "sectest@salaoexemplo.pt",
        password: "PassSecTest123",
      }),
    });
    const staffCookie = (staffLoginRes.headers.get("set-cookie") ?? "").split(";")[0];
    for (const [method, path, body] of [
      ["GET", "/api/admin/clientes", undefined],
      ["GET", "/api/admin/equipa", undefined],
      ["POST", "/api/admin/servicos", "{}"],
      ["PATCH", "/api/admin/definicoes", "{}"],
      ["PUT", "/api/admin/branding", "{}"],
      ["PUT", "/api/admin/horarios", "{}"],
      ["PUT", "/api/admin/conteudo", "{}"],
      ["GET", "/api/admin/clientes/export", undefined],
      ["POST", "/api/admin/marcacoes", "{}"],
    ] as const) {
      const res = await fetch(`${BASE}${path}`, {
        method,
        headers: {
          ...(body ? { "Content-Type": "application/json" } : {}),
          ...ORIGIN,
          Cookie: staffCookie,
        },
        body,
      });
      assert([401, 403, 405].includes(res.status), `${method} ${path} -> ${res.status} (bloqueado)`);
    }

    // CSRF: no origin -> rejected.
    const noOrigin = await fetch(`${BASE}/api/marcacoes`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: "{}",
    });
    assert(noOrigin.status === 403, "mutation sem Origin rejeitada (CSRF)");

    // Cleanup test staff.
    const st = await prisma.staff.findFirst({
      where: { user: { email: "sectest@salaoexemplo.pt" } },
    });
    if (st) {
      await prisma.staff.delete({ where: { id: st.id } });
      await prisma.user.delete({ where: { id: st.userId } });
    }
  }

  console.log("[S4] Sem fugas de informação em erros");
  const errRes = await fetch(`${BASE}/api/marcacoes`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...ORIGIN },
    body: "not-json",
  });
  const errText = await errRes.text();
  assert(
    !errText.includes("prisma") && !errText.includes("at ") && errText.length < 300,
    "erro genérico, sem stack/paths",
  );

  console.log(`\n=== Segurança: ${passed} OK, ${failed} FALHARAM ===`);
  process.exitCode = failed > 0 ? 1 : 0;
}

main()
  .catch((e) => console.error("ERR", e.message))
  .finally(() => prisma.$disconnect());

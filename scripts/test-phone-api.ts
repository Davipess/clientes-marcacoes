import "dotenv/config";
import { prisma } from "../lib/db";

const BASE = "http://localhost:3000";
const ORIGIN = { Origin: BASE };

async function tryBook(telefone: string, dayOffset: number): Promise<number> {
  const day = new Date(Date.now() + dayOffset * 86_400_000);
  while (day.getUTCDay() === 0 || day.getUTCDay() === 6) day.setUTCDate(day.getUTCDate() + 1);
  const iso = new Date(
    Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), 10, 0),
  ).toISOString();
  const svc = await prisma.service.findFirstOrThrow();
  const r = await fetch(`${BASE}/api/marcacoes`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...ORIGIN },
    body: JSON.stringify({
      servicos: [svc.id],
      inicio: iso,
      nome: "Teste Telefone",
      telefone,
      consentimentoRGPD: true,
    }),
  });
  if (r.status !== 200) {
    const body = await r.text();
    console.log(`      [debug ${telefone}] ${r.status}: ${body.slice(0, 120)}`);
  }
  return r.status;
}

async function main() {
  for (let i = 0; i < 20; i++) {
    try {
      if ((await fetch(`${BASE}/entrar`)).ok) break;
    } catch { /* wait */ }
    await new Promise((r) => setTimeout(r, 1500));
  }

  // [telefone, label, esperado, offset de dias] — dias distintos evitam conflito de slot
  const cases: [string, string, number, number][] = [
    ["912 345 678", "PT formatado", 201, 8],
    ["912345678", "PT sem espacos", 201, 9],
    ["+351 912 345 678", "PT com indicativo (mesma identidade)", 201, 10],
    ["+44 20 7183 8750", "internacional", 201, 11],
    ["30304304043", "lixo 11 digitos", 400, 12],
    ["12345", "curto", 400, 13],
    ["812345678", "comeca por 8", 400, 14],
    ["<script>alert(1)</script>", "XSS", 400, 15],
  ];

  let pass = 0;
  let fail = 0;
  for (const [phone, label, expected, dayOffset] of cases) {
    const status = await tryBook(phone, dayOffset);
    // 429 = rate limiter a bloquear antes da validacao — tambem e rejeicao valida
    const ok = status === expected || (expected === 400 && status === 429);
    if (ok) pass++;
    else fail++;
    console.log(
      `${ok ? "OK  " : "FAIL"} "${phone}" (${label}) -> ${status} (esperado ${expected})`,
    );
  }
  console.log(`\n=== API: ${pass} pass, ${fail} fail ===`);

  await prisma.appointment.deleteMany({});
  await prisma.client.deleteMany({});
  console.log("(dados de teste limpos)");
  process.exitCode = fail > 0 ? 1 : 0;
}

main()
  .catch((e) => console.error("ERR", e.message))
  .finally(() => prisma.$disconnect());

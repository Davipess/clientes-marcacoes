import "dotenv/config";

const BASE = "http://localhost:3000";
const ORIGIN = { Origin: BASE };

async function main() {
  // Wait for dev server.
  for (let i = 0; i < 20; i++) {
    try {
      const r = await fetch(`${BASE}/entrar`);
      if (r.ok) break;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 1500));
  }

  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...ORIGIN },
    body: JSON.stringify({
      email: "gestor@salaoexemplo.pt",
      password: "NovaPass123456",
    }),
  });
  const cookie = (loginRes.headers.get("set-cookie") ?? "").split(";")[0];
  console.log("login:", loginRes.status);

  for (const path of ["/admin", "/admin/servicos", "/admin/clientes", "/admin/definicoes"]) {
    const res = await fetch(`${BASE}${path}`, { headers: { Cookie: cookie } });
    console.log(`${path}: ${res.status}`);
  }

  // 404 personalizada
  const notFound = await fetch(`${BASE}/pagina-inexistente`);
  const html = await notFound.text();
  console.log("404 status:", notFound.status, "| customizada:", html.includes("Esta página não existe"));

  // Definições: alterar e verificar reflexo no site público
  const settingsRes = await fetch(`${BASE}/api/admin/definicoes`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...ORIGIN, Cookie: cookie },
    body: JSON.stringify({
      name: "Salão Exemplo",
      address: "Rua Exemplo, 123, Lisboa",
      email: "geral@salaoexemplo.pt",
      openingHours: {
        mon: [{ open: "09:00", close: "18:00" }],
        tue: [{ open: "09:00", close: "18:00" }],
        wed: [{ open: "09:00", close: "18:00" }],
        thu: [{ open: "09:00", close: "18:00" }],
        fri: [{ open: "09:00", close: "19:00" }],
        sat: [{ open: "09:00", close: "13:00" }],
        sun: null,
      },
      bufferMinutes: 10,
      minLeadHours: 2,
      maxLeadDays: 60,
      cancellationWindowHours: 24,
      cancellationPolicyText: "Pode cancelar ou alterar gratuitamente até 24 horas antes.",
      maxActiveBookingsPerPhone: 3,
      maxBookingsPerPhonePerDay: 3,
      noShowFlagThreshold: 2,
      retentionMonths: 24,
    }),
  });
  console.log("PATCH definicoes:", settingsRes.status);

  const home = await fetch(`${BASE}/`);
  const homeHtml = await home.text();
  console.log(
    "site reflete definicoes:",
    homeHtml.includes("Salão Exemplo") && homeHtml.includes("09:00–18:00"),
  );
}

main().catch((e) => console.error("ERR", e.message));

import "dotenv/config";
import { prisma } from "../lib/db";

const BASE = "http://localhost:3000";
const ORIGIN = { Origin: BASE };

async function main() {
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

  const catRes = await fetch(`${BASE}/api/admin/categorias`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...ORIGIN, Cookie: cookie },
    body: JSON.stringify({ name: "Teste Categoria" }),
  });
  const cat = await catRes.json();
  let catId = cat.id as string | undefined;
  if (!catId) {
    // Already exists from a previous run — look it up.
    const existing = await prisma.serviceCategory.findFirst({
      where: { name: "Teste Categoria" },
    });
    catId = existing?.id;
    console.log("categoria existente reutilizada:", catId);
  } else {
    console.log("categoria:", catRes.status, catId);
  }

  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  );
  const form = new FormData();
  form.append("ficheiro", new File([png], "t.png", { type: "image/png" }));
  const imgRes = await fetch(`${BASE}/api/admin/imagens`, {
    method: "POST",
    headers: { ...ORIGIN, Cookie: cookie },
    body: form,
  });
  const imgText = await imgRes.text(); console.log("img raw:", imgRes.status, imgText.slice(0, 200)); const img = imgText ? JSON.parse(imgText) : {};
  console.log("imagem:", imgRes.status, img.url ?? img.error);

  const svcRes = await fetch(`${BASE}/api/admin/servicos`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...ORIGIN, Cookie: cookie },
    body: JSON.stringify({
      categoryId: catId!,
      name: "Servico Teste",
      description: "desc",
      durationMin: 30,
      price: 12.5,
      imageUrl: img.url,
    }),
  });
  const svc = await svcRes.json();
  console.log("servico:", svcRes.status, svc.id ?? svc.error);

  if (svc.id) {
    const created = await prisma.service.findUniqueOrThrow({
      where: { id: svc.id },
    });
    console.log("guardado com imageUrl:", created.imageUrl);
    await prisma.service.delete({ where: { id: svc.id } });
    await prisma.serviceCategory.deleteMany({ where: { name: "Teste Categoria" } });
    await prisma.image.deleteMany({});
    console.log("limpeza ok");
  }

  const noAuth = await fetch(`${BASE}/api/admin/servicos`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...ORIGIN },
    body: "{}",
  });
  console.log("sem sessao (esperado 401):", noAuth.status);
}

main()
  .catch((e) => console.error("ERR", e))
  .finally(() => prisma.$disconnect());

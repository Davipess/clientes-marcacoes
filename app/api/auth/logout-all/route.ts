import { getAuthUser, destroyAllSessions, isSameOrigin } from "@/lib/auth";
import { audit } from "@/lib/audit";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return Response.json({ error: "Pedido inválido" }, { status: 403 });
  }

  const user = await getAuthUser();
  if (!user) {
    return Response.json({ error: "Não autenticado" }, { status: 401 });
  }

  const count = await destroyAllSessions(user.id);

  if (user.businessId) {
    await audit(user.businessId, user.email, "auth.logout_all", `${count} sessões terminadas`);
  }

  return Response.json({ ok: true, destroyed: count });
}

import { destroySession, isSameOrigin } from "@/lib/auth";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return Response.json({ error: "Pedido inválido" }, { status: 403 });
  }
  await destroySession();

  // Browser form posts go back to the public site; fetch callers get JSON.
  const accept = request.headers.get("accept") ?? "";
  if (accept.includes("text/html")) {
    return Response.redirect(new URL("/", request.url), 303);
  }
  return Response.json({ ok: true });
}

import { queueDueReminders } from "@/lib/notifications";

export async function GET(request: Request) {
  // Verify cron secret to prevent unauthorized access
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const queued = await queueDueReminders();
  return Response.json({ ok: true, queued });
}

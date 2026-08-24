import { prisma } from "@/lib/db";

/**
 * Fire-and-forget audit logging for sensitive admin/staff actions.
 * Never throws — auditing must not break the main flow.
 */
export async function audit(
  businessId: string | null | undefined,
  actorEmail: string,
  action: string,
  detail?: string,
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        businessId: businessId ?? null,
        actorEmail,
        action,
        detail: detail?.slice(0, 500),
      },
      select: { id: true },
    });
  } catch {
    // Intentionally swallowed.
  }
}

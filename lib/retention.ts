import { prisma } from "@/lib/db";

/**
 * Minimizacao imediata: chamada quando uma marcacao e fechada (concluida,
 * falta ou cancelada). Apaga nome/telefone/notas SE o cliente nao tiver
 * outras marcacoes futuras ativas. Mantem phoneHash (anti-abuso), contador
 * de faltas, bloqueio manual e o historico anonimo da visita.
 */
export async function minimizeClientIfNoFuture(clientId: string): Promise<void> {
  const future = await prisma.appointment.count({
    where: {
      clientId,
      status: { in: ["PENDING", "CONFIRMED"] },
      startAt: { gt: new Date() },
    },
  });
  if (future > 0) return; // ainda tem marcacoes ativas, manter contacto

  await prisma.client.updateMany({
    where: { id: clientId, phoneHash: { not: { startsWith: "anon-" } } },
    data: {
      name: "Cliente (histórico)",
      phoneEnc: null,
      emailEnc: null,
      notes: null,
      marketingConsent: false,
    },
  });
}

/**
 * Minimizacao de dados: apaga nome + numero de telefone dos clientes que
 * nao tem marcacoes futuras e cuja ultima visita terminou ha mais de
 * `contactRetentionDays` dias. Mantem:
 *  - phoneHash (identidade pseudonima para anti-abuso da Fase 14)
 *  - noShowCount (contador de faltas, sobrevive aos registos)
 *  - blocked (bloqueio manual decidido pela gerencia)
 *  - historico de marcacoes (sem PII: servicos e datas)
 */
export async function minimizeStaleContacts(): Promise<number> {
  const settingsList = await prisma.businessSettings.findMany({
    select: { businessId: true, contactRetentionDays: true },
  });

  let minimized = 0;
  for (const settings of settingsList) {
    const cutoff = new Date(
      Date.now() - settings.contactRetentionDays * 86_400_000,
    );

    // Clientes sem marcacoes futuras ativas.
    const stale = await prisma.client.findMany({
      where: {
        businessId: settings.businessId,
        OR: [
          { phoneEnc: { not: null } },
          { name: { not: "Cliente (histórico)" } },
        ],
        appointments: {
          none: { status: { in: ["PENDING", "CONFIRMED"] }, startAt: { gt: new Date() } },
        },
      },
      select: {
        id: true,
        name: true,
        appointments: {
          where: { status: { in: ["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"] } },
          select: { endAt: true, cancelledAt: true },
          orderBy: { endAt: "desc" },
          take: 1,
        },
      },
    });

    for (const client of stale) {
      const last = client.appointments[0];
      if (!last) continue; // nunca visitou, manter contacto ate primeira visita
      // Data relevante de fim: cancelamento (se existir) ou fim da marcação.
      const endedAt = last.cancelledAt ?? last.endAt;
      if (endedAt.getTime() > cutoff.getTime()) continue; // ainda dentro do prazo

      await prisma.client.update({
        where: { id: client.id },
        data: {
          name: "Cliente (histórico)",
          phoneEnc: null,
          emailEnc: null,
          notes: null,
          marketingConsent: false,
        },
      });
      minimized++;
    }
  }
  return minimized;
}

/**
 * Data-retention sweep: deletes final-state appointments older
 * than the configurable retention period. Also cleans up loyalty data,
 * vouchers, waitlist entries, audit logs, and push subscriptions
 * for minimized clients.
 * Run periodically: `npm run retention` (cron / Netlify Scheduled Function).
 */
export async function runRetentionCleanup(): Promise<{
  deletedAppointments: number;
  deletedNotifications: number;
  deletedLoyalty: number;
  deletedVouchers: number;
  deletedWaitlist: number;
  deletedAuditLogs: number;
  deletedPushSubscriptions: number;
}> {
  const settingsList = await prisma.businessSettings.findMany({
    select: { businessId: true, retentionMonths: true },
  });

  let deletedAppointments = 0;
  let deletedNotifications = 0;
  let deletedLoyalty = 0;
  let deletedVouchers = 0;
  let deletedWaitlist = 0;
  let deletedAuditLogs = 0;
  let deletedPushSubscriptions = 0;

  for (const settings of settingsList) {
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - settings.retentionMonths);

    // 1. Delete old appointments
    const old = await prisma.appointment.findMany({
      where: {
        businessId: settings.businessId,
        status: { in: ["COMPLETED", "CANCELLED", "NO_SHOW"] },
        endAt: { lt: cutoff },
      },
      select: { id: true },
    });

    if (old.length > 0) {
      const ids = old.map((a) => a.id);

      const notif = await prisma.notificationLog.deleteMany({
        where: { appointmentId: { in: ids } },
      });
      deletedNotifications += notif.count;

      const res = await prisma.appointment.deleteMany({
        where: { id: { in: ids } },
      });
      deletedAppointments += res.count;
    }

    // 2. Clean up loyalty data for minimized clients (phoneEnc = null)
    const minimizedClients = await prisma.client.findMany({
      where: {
        businessId: settings.businessId,
        phoneEnc: null,
        name: "Cliente (histórico)",
      },
      select: { id: true, phoneHash: true },
    });

    for (const client of minimizedClients) {
      const loyaltyTx = await prisma.loyaltyTransaction.deleteMany({
        where: { clientId: client.id },
      });
      deletedLoyalty += loyaltyTx.count;

      await prisma.loyaltyCard.deleteMany({
        where: { clientId: client.id },
      });

      // Clean up vouchers for minimized clients
      const vouchers = await prisma.loyaltyVoucher.deleteMany({
        where: { clientId: client.id },
      });
      deletedVouchers += vouchers.count;

      // Clean up push subscriptions for minimized clients
      const pushSubs = await prisma.pushSubscription.deleteMany({
        where: { clientPhoneHash: client.phoneHash },
      });
      deletedPushSubscriptions += pushSubs.count;
    }

    // 3. Clean up old waitlist entries (older than retention period)
    const oldWaitlist = await prisma.waitlistEntry.deleteMany({
      where: {
        businessId: settings.businessId,
        createdAt: { lt: cutoff },
      },
    });
    deletedWaitlist += oldWaitlist.count;

    // 4. Clean up old audit logs (older than 12 months)
    const auditCutoff = new Date();
    auditCutoff.setMonth(auditCutoff.getMonth() - 12);
    const oldAudit = await prisma.auditLog.deleteMany({
      where: {
        businessId: settings.businessId,
        createdAt: { lt: auditCutoff },
      },
    });
    deletedAuditLogs += oldAudit.count;
  }

  return {
    deletedAppointments,
    deletedNotifications,
    deletedLoyalty,
    deletedVouchers,
    deletedWaitlist,
    deletedAuditLogs,
    deletedPushSubscriptions,
  };
}

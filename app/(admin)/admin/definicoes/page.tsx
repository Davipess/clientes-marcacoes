import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { SettingsForm } from "@/components/admin/settings-form";
import { PasswordChange } from "@/components/password-change";
import { SiteContentEditor } from "@/components/admin/site-content-editor";
import { parseSiteContent } from "@/lib/public-data";

export const metadata: Metadata = { title: "Definições — Administração" };

export default async function AdminDefinicoesPage() {
  const user = await getAuthUser();
  if (!user?.businessId) redirect("/entrar");

  const business = await prisma.business.findUniqueOrThrow({
    where: { id: user.businessId },
    include: { settings: true },
  });
  const ownStaffProfile = await prisma.staff.findFirst({
    where: { businessId: user.businessId, userId: user.id },
  });
  const staff = await prisma.staff.findMany({
    where: { businessId: user.businessId },
    select: {
      id: true,
      displayName: true,
      active: true,
      userId: true,
      user: { select: { email: true } },
    },
    orderBy: { displayName: "asc" },
  });

  const defaultHours: Record<string, { open: string; close: string }[] | null> = {
    mon: [{ open: "09:00", close: "18:00" }],
    tue: [{ open: "09:00", close: "18:00" }],
    wed: [{ open: "09:00", close: "18:00" }],
    thu: [{ open: "09:00", close: "18:00" }],
    fri: [{ open: "09:00", close: "18:00" }],
    sat: null,
    sun: null,
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="font-heading text-2xl font-semibold">Definições</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Tudo o que o site público mostra vem daqui — nada está fixo no código.
      </p>
      <SettingsForm
        business={{
          name: business.name,
          address: business.address ?? "",
          email: business.email ?? "",
          logoUrl: business.logoUrl,
          primaryColor: business.primaryColor,
          secondaryColor: business.secondaryColor,
        }}
        openingHours={
          (business.settings?.openingHours as Record<
            string,
            { open: string; close: string }[] | null
          > | null) ?? defaultHours
        }
        settings={{
          bufferMinutes: business.settings?.bufferMinutes ?? 10,
          minLeadHours: business.settings?.minLeadHours ?? 2,
          maxLeadDays: business.settings?.maxLeadDays ?? 60,
          cancellationWindowHours:
            business.settings?.cancellationWindowHours ?? 24,
          cancellationPolicyText:
            business.settings?.cancellationPolicyText ?? "",
          maxActiveBookingsPerPhone:
            business.settings?.maxActiveBookingsPerPhone ?? 3,
          maxBookingsPerPhonePerDay:
            business.settings?.maxBookingsPerPhonePerDay ?? 3,
          noShowFlagThreshold: business.settings?.noShowFlagThreshold ?? 2,
          retentionMonths: business.settings?.retentionMonths ?? 24,
        }}
        soloMode={{
          hasOwnProfile: Boolean(ownStaffProfile),
          staff: staff.map((s) => ({
            id: s.id,
            displayName: s.displayName,
            email: s.user?.email ?? null,
            active: s.active,
            isOwnProfile: s.userId === user.id,
          })),
        }}
      />

      <SiteContentEditor initial={parseSiteContent(business.settings?.siteContent)} />

      <section className="mt-8 rounded-2xl border border-border/70 bg-card p-5">
        <h2 className="font-heading text-lg font-semibold">Palavra-passe</h2>
        <p className="mb-4 mt-1 text-sm text-muted-foreground">
          Recomendação: use uma palavra-passe exclusiva desta aplicação.
        </p>
        <PasswordChange />
      </section>
    </div>
  );
}

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { SettingsForm } from "@/components/admin/settings-form";

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
  const staffCount = await prisma.staff.count({
    where: { businessId: user.businessId, active: true },
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
        }}
        soloMode={{
          hasOwnProfile: Boolean(ownStaffProfile),
          staffCount,
        }}
      />
    </div>
  );
}

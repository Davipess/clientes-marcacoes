import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { Role } from "@/lib/generated/prisma/client";
import { BlockManager } from "@/components/staff/block-manager";
import { PasswordChange } from "@/components/password-change";

export const metadata: Metadata = { title: "Bloquear horários" };

export default async function StaffHorarioPage() {
  const user = await getAuthUser();
  if (!user) redirect("/entrar");
  if (user.role === Role.ADMIN) redirect("/admin");
  if (user.role !== Role.STAFF) redirect("/");

  const staff = await prisma.staff.findFirst({
    where: { userId: user.id, active: true },
  });
  if (!staff) redirect("/entrar");

  const blocks = await prisma.availabilityException.findMany({
    where: { staffId: staff.id, endAt: { gte: new Date() } },
    orderBy: { startAt: "asc" },
    select: { id: true, startAt: true, endAt: true, reason: true },
  });

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-semibold">Bloquear horários</h1>
        <Link
          href="/staff"
          className="rounded-full border border-border bg-card px-4 py-2 text-sm transition-colors hover:border-primary/40"
        >
          ← Voltar à agenda
        </Link>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Os horários bloqueados deixam de estar disponíveis no site de imediato.
      </p>
      <section className="mb-8 rounded-2xl border border-border/70 bg-card p-5">
        <h2 className="font-heading text-lg font-semibold">Palavra-passe</h2>
        <PasswordChange />
      </section>
      <BlockManager
        blocks={blocks.map((b) => ({
          id: b.id,
          startAt: b.startAt.toISOString(),
          endAt: b.endAt.toISOString(),
          reason: b.reason ?? "",
        }))}
      />
    </div>
  );
}

import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getAuthUser } from "@/lib/auth";
import { Role } from "@/lib/generated/prisma/client";
import { StaffHeader } from "@/components/staff-header";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getAuthUser();

  // ADMIN may enter the staff area (solo mode: owner is the technician).
  if (!user || (user.role !== Role.STAFF && user.role !== Role.ADMIN)) {
    redirect(user ? "/" : "/entrar");
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <StaffHeader />
      <main className="mx-auto max-w-4xl px-4 py-8">{children}</main>
    </div>
  );
}

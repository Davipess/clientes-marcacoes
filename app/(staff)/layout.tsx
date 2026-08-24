import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getAuthUser } from "@/lib/auth";
import { Role } from "@/lib/generated/prisma/client";

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
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <span className="font-semibold">Área do colaborador</span>
          <form action="/api/auth/logout" method="post">
            <button
              type="submit"
              formAction="/api/auth/logout"
              className="text-sm text-neutral-500 hover:text-neutral-900"
            >
              Sair
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-8">{children}</main>
    </div>
  );
}

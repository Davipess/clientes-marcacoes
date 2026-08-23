import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth";
import { Role } from "@/lib/generated/prisma/client";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getAuthUser();

  if (!user) redirect("/entrar");
  if (user.role !== Role.ADMIN) {
    redirect(user.role === Role.STAFF ? "/staff" : "/");
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <span className="font-semibold">Painel de administração</span>
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
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}

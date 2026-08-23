import { getAuthUser } from "@/lib/auth";

export default async function AdminHomePage() {
  const user = await getAuthUser();
  return (
    <div>
      <h1 className="text-2xl font-semibold">Bem-vindo, {user?.name}</h1>
      <p className="mt-2 text-neutral-500">
        O painel de administração será construído na Fase 5.
      </p>
    </div>
  );
}

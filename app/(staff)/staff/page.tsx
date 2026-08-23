import { getAuthUser } from "@/lib/auth";

export default async function StaffHomePage() {
  const user = await getAuthUser();
  return (
    <div>
      <h1 className="text-2xl font-semibold">Olá, {user?.name}</h1>
      <p className="mt-2 text-neutral-500">
        A área do colaborador será construída na Fase 6.
      </p>
    </div>
  );
}

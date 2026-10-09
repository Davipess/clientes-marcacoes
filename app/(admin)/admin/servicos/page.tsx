import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { ServiceManager } from "@/components/admin/service-manager";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Serviços, Administração" };

export default async function AdminServicosPage() {
  const user = await getAuthUser();
  if (!user?.businessId) redirect("/entrar");

  const [categories, services] = await Promise.all([
    prisma.serviceCategory.findMany({
      where: { businessId: user.businessId, archived: false },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.service.findMany({
      where: { businessId: user.businessId, archived: false },
      orderBy: { name: "asc" },
      select: {
        id: true,
        categoryId: true,
        name: true,
        description: true,
        durationMin: true,
        price: true,
        imageUrl: true,
      },
    }),
  ]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="font-heading text-2xl font-semibold">Serviços</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Crie e edite os serviços do salão. As alterações aparecem de imediato no
        site público.
      </p>
      <ServiceManager
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        initialServices={services.map((s) => ({
          ...s,
          description: s.description ?? "",
          imageUrl: s.imageUrl ?? null,
          price: Number(s.price),
        }))}
      />
    </div>
  );
}

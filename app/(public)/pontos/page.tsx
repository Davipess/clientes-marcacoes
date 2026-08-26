import type { Metadata } from "next";
import { getPublicData } from "@/lib/public-data";
import { LoyaltyLookup } from "@/components/loyalty-lookup";

export const metadata: Metadata = { title: "Consultar Pontos" };

export default async function PontosPage() {
  const data = await getPublicData();
  const businessId = data?.business.id;

  if (!businessId) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-24 text-center">
        <h1 className="font-heading text-3xl font-semibold">Consultar Pontos</h1>
        <p className="mt-3 text-muted-foreground">
          Sistema de pontos não disponível de momento.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-10 sm:py-16">
      <h1 className="font-heading text-2xl font-semibold text-center">
        Programa de Fidelização
      </h1>
      <p className="mt-2 text-center text-sm text-muted-foreground">
        Consulte quantos pontos acumulou nas suas marcações.
      </p>
      <div className="mt-6">
        <LoyaltyLookup businessId={businessId} />
      </div>
    </div>
  );
}

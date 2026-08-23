import type { Metadata } from "next";
import { getPublicData } from "@/lib/public-data";
import { BookingWizard } from "@/components/booking/wizard";

export const metadata: Metadata = {
  title: "Marcar — Salão Exemplo",
  description: "Marque o seu serviço online em menos de um minuto.",
};

export default async function MarcarPage({
  searchParams,
}: PageProps<"/marcar">) {
  const [{ servico }, data] = await Promise.all([searchParams, getPublicData()]);

  if (!data || data.categories.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-24 text-center">
        <h1 className="font-heading text-3xl font-semibold">Marcações</h1>
        <p className="mt-3 text-muted-foreground">
          De momento não há serviços disponíveis para marcação.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:py-14">
      <BookingWizard
        categories={data.categories}
        staff={data.staff}
        timezone={data.business.timezone ?? "Europe/Lisbon"}
        cancellationPolicyText={
          data.cancellationPolicyText ||
          "Pode cancelar ou alterar a sua marcação gratuitamente até 24 horas antes."
        }
        initialServiceId={typeof servico === "string" ? servico : undefined}
      />
    </div>
  );
}

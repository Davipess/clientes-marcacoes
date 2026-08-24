import type { Metadata } from "next";
import { getPublicData } from "@/lib/public-data";

export const metadata: Metadata = {
  title: "Política de Privacidade",
};

export default async function PrivacidadePage() {
  const data = await getPublicData();
  const name = data?.business.name ?? "o salão";

  return (
    <div className="mx-auto max-w-2xl px-4 py-14">
      <h1 className="font-heading text-3xl font-semibold">Política de Privacidade</h1>
      <div className="mt-6 space-y-5 text-sm leading-relaxed text-muted-foreground">
        <section>
          <h2 className="font-medium text-foreground">Responsável pelo tratamento</h2>
          <p className="mt-1">
            {name}
            {data?.business.address ? `, ${data.business.address}` : ""}
            {data?.business.email ? ` (${data.business.email})` : ""}. Para
            qualquer questão relacionada com os seus dados pessoais, contacte-nos.
          </p>
        </section>
        <section>
          <h2 className="font-medium text-foreground">Dados recolhidos</h2>
          <p className="mt-1">
            Ao efetuar uma marcação, recolhemos o seu nome e telefone
            (necessários para gerir a marcação) e as notas que escreva, se
            quiser. O seu número de telefone é guardado de forma encriptada e
            é a única forma de identificação usada — sem contas nem palavras-passe.
          </p>
        </section>
        <section>
          <h2 className="font-medium text-foreground">Finalidade e conservação</h2>
          <p className="mt-1">
            Os dados são utilizados exclusivamente para gerir marcações,
            enviar confirmações e lembretes relacionados, e manter o histórico
            das suas visitas. Não vendemos nem partilhamos os seus dados com
            terceiros para fins comerciais.
          </p>
        </section>
        <section>
          <h2 className="font-medium text-foreground">Os seus direitos</h2>
          <p className="mt-1">
            Nos termos do RGPD, pode solicitar a qualquer momento o acesso,
            retificação ou eliminação dos seus dados, bem como retirar o
            consentimento para comunicações de marketing. Basta contactar-nos.
          </p>
        </section>
      </div>
    </div>
  );
}

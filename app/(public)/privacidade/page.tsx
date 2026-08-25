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
      <h1 className="font-heading text-3xl font-semibold">
        Política de Privacidade
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Última atualização:{" "}
        {new Date().toLocaleDateString("pt-PT", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })}
      </p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-muted-foreground">
        <section>
          <h2 className="font-medium text-foreground">1. Responsável pelo tratamento</h2>
          <p className="mt-1">
            {name}
            {data?.business.address ? `, com sede em ${data.business.address}` : ""}
            {data?.business.email ? ` (${data.business.email})` : ""}
            {data?.business.phone ? ` e telefone ${data.business.phone}` : ""}. Para
            qualquer questão relacionada com os seus dados pessoais, contacte-nos
            por qualquer destes meios.
          </p>
        </section>

        <section>
          <h2 className="font-medium text-foreground">2. Que dados recolhemos</h2>
          <p className="mt-1">Ao efetuar uma marcação recolhemos:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              <strong className="text-foreground">Nome</strong> — para identificar
              a sua marcação no dia da visita;
            </li>
            <li>
              <strong className="text-foreground">Número de telefone</strong> —
              para gerir e confirmar a sua marcação. É o único identificador do
              sistema: não usamos contas, palavras-passe nem emails;
            </li>
            <li>
              <strong className="text-foreground">Notas</strong> — apenas se as
              escrever você mesmo (ex.: alergias, preferências);
            </li>
            <li>
              <strong className="text-foreground">Histórico de marcações</strong>{" "}
              — datas e serviços realizados.
            </li>
          </ul>
          <p className="mt-2">
            <strong className="text-foreground">Não recolhemos</strong> emails,
            moradas, dados de pagamento nem quaisquer outros dados para além
            dos acima indicados. Não utilizamos cookies de publicidade nem
            ferramentas de rastreio de terceiros.
          </p>
        </section>

        <section>
          <h2 className="font-medium text-foreground">
            3. Finalidades e base legal
          </h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              <strong className="text-foreground">Gerir a sua marcação</strong>{" "}
              (criar, confirmar, alterar, cancelar) — base legal: execução de
              contrato (art. .º 6.º/1/b RGPD);
            </li>
            <li>
              <strong className="text-foreground">Prevenir abusos</strong>{" "}
              (limites de marcações por número de telefone e registo de faltas
              de comparecimento) — base legal: interesse legítimo na proteção
              do negócio (art. 6.º/1/f RGPD). Este tratamento não envolve
              decisões individuais automatizadas com efeitos jurídicos: qualquer
              bloqueio é sempre decidido por uma pessoa;
            </li>
            <li>
              <strong className="text-foreground">Cumprir obrigações legais</strong>{" "}
              (ex.: faturação, se aplicável) — base legal: obrigação legal
              (art. 6.º/1/c RGPD);
            </li>
            <li>
              <strong className="text-foreground">Novidades e promoções</strong>{" "}
              — apenas se marcar essa opção, e pode retirar o consentimento
              quando quiser (art. 6.º/1/a RGPD).
            </li>
          </ul>
        </section>

        <section>
          <h2 className="font-medium text-foreground">
            4. Durante quanto tempo guardamos os dados
          </h2>
          <p className="mt-1">
            Aplicamos um calendário rigoroso de eliminação — em 1 mês, uma
            marcação não deixa nenhum traço:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              <strong className="text-foreground">Marcação fechada pelo salão</strong>{" "}
              (concluída, falta registada ou cancelada) — o seu nome e telefone
              são <strong>apagados de imediato</strong>, se não tiver outras
              marcações futuras;
            </li>
            <li>
              <strong className="text-foreground">Marcação não fechada</strong> —
              se o salão não atualizar o estado, os seus dados são apagados de
              qualquer forma <strong>7 dias após a data da marcação</strong>;
            </li>
            <li>
              <strong className="text-foreground">1 mês depois</strong> — o
              histórico da marcação (serviços e datas) é{" "}
              <strong>eliminado por completo</strong>. Não resta nenhum traço
              que possa ser ligado a si;
            </li>
            <li>
              <strong className="text-foreground">Contador de faltas</strong> — um
              número associado a um código irreversível do seu telefone
              (pseudónimo), usado apenas para proteção contra abusos. Não
              permite recuperar o número nem contactar ninguém, e pode ser
              zerado a seu pedido.
            </li>
          </ul>
          <p className="mt-2">
            Pode pedir a eliminação antecipada de tudo a qualquer momento (ver
            secção 7).
          </p>
        </section>

        <section>
          <h2 className="font-medium text-foreground">5. Como protegemos os seus dados</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              Os números de telefone são guardados <strong>encriptados</strong>{" "}
              (AES-256) — quem aceder à base de dados não consegue lê-los sem a
              chave da aplicação;
            </li>
            <li>
              O acesso aos dados é restrito ao pessoal autorizado do salão
              (administração e, limitadamente, as técnicas para as suas próprias
              marcações);
            </li>
            <li>
              Todas as ações sensíveis na administração ficam registadas num
              registo de auditoria;
            </li>
            <li>
              Toda a comunicação é feita por HTTPS; os acessos ao painel são
              protegidos por palavra-passe e limites de tentativas;
            </li>
            <li>
              Nunca vendemos, alugamos ou partilhamos os seus dados com
              terceiros para fins comerciais ou de marketing.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="font-medium text-foreground">
            6. Com quem partilhamos os dados
          </h2>
          <p className="mt-1">
            Apenas com fornecedores estritamente necessários ao funcionamento do
            serviço (alojamento da aplicação e da base de dados), sob contrato
            de subcontratação conforme o RGPD, e apenas na medida do
            necessário. Não há qualquer outra transferência de dados.
          </p>
        </section>

        <section>
          <h2 className="font-medium text-foreground">7. Os seus direitos</h2>
          <p className="mt-1">
            Nos termos do RGPD, pode a qualquer momento:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>acessar os seus dados e obter uma cópia dos mesmos;</li>
            <li>retificar dados incorretos;</li>
            <li>
              solicitar a <strong>eliminação</strong> do seu número de telefone
              e dados associados — o pedido é executado de forma definitiva
              (anonimização irreversível), mantendo-se apenas um registo
              anónimo das marcações passadas, sem qualquer ligação a si;
            </li>
            <li>limitar ou opor-se ao tratamento;</li>
            <li>retirar o consentimento para comunicações de marketing;</li>
            <li>
              apresentar reclamação à{" "}
              <strong className="text-foreground">
                Comissão Nacional de Proteção de Dados (CNPD)
              </strong>
              , em www.cnpd.pt.
            </li>
          </ul>
          <p className="mt-2">
            Para exercer qualquer destes direitos, contacte-nos pelos meios na
            secção 1. Respondemos no prazo máximo de 30 dias.
          </p>
        </section>

        <section>
          <h2 className="font-medium text-foreground">8. Decisões automatizadas</h2>
          <p className="mt-1">
            O sistema aplica automaticamente limites técnicos ao número de
            marcações por telefone para prevenir abusos. Estas limitações não
            produzem efeitos jurídicos sobre si e podem sempre ser revistas e
            anuladas pelo responsável do tratamento, caso a caso, mediante
            contacto direto.
          </p>
        </section>

        <section>
          <h2 className="font-medium text-foreground">9. Alterações</h2>
          <p className="mt-1">
            Esta política pode ser atualizada; a data no topo indica a versão
            mais recente. Alterações relevantes serão comunicadas no site.
          </p>
        </section>
      </div>
    </div>
  );
}

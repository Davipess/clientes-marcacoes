import Link from "next/link";
import { getPublicData } from "@/lib/public-data";
import { PublicHeader } from "@/components/public-header";

const WEEKDAY_LABELS: Record<string, string> = {
  mon: "Segunda",
  tue: "Terça",
  wed: "Quarta",
  thu: "Quinta",
  fri: "Sexta",
  sat: "Sábado",
  sun: "Domingo",
};

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const data = await getPublicData();
  const name = data?.business.name ?? "Salão";

  return (
    <div
      className="flex min-h-screen flex-col"
      style={
        data
          ? ({
              "--primary": data.business.primaryColorHex,
              "--secondary": data.business.secondaryColorHex,
            } as React.CSSProperties)
          : undefined
      }
    >
      <PublicHeader name={name} logoUrl={data?.business.logoUrl} />

      <main className="flex-1">{children}</main>

      <footer className="border-t border-border/60 bg-card">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-3">
          <div>
            <p className="font-heading text-lg font-semibold">{name}</p>
            {data?.business.address && (
              <p className="mt-2 text-sm text-muted-foreground">{data.business.address}</p>
            )}
          </div>
          <div>
            <p className="text-sm font-medium">Horário</p>
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              {Object.entries(WEEKDAY_LABELS).map(([key, label]) => {
                const windows = data?.openingHours?.[key];
                const text = !windows
                  ? "Fechado"
                  : windows.map((w) => `${w.open}–${w.close}`).join(" | ");
                return (
                  <li key={key}>
                    {label}: <span className="tabular-nums">{text}</span>
                  </li>
                );
              })}
            </ul>
          </div>
          <div>
            <p className="text-sm font-medium">Contactos</p>
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              {data?.business.phone && <li>{data.business.phone}</li>}
              {data?.business.email && <li>{data.business.email}</li>}
            </ul>
            <Link href="/privacidade" className="mt-3 inline-block text-xs text-muted-foreground underline-offset-2 hover:underline">
              Política de Privacidade
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

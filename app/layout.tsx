import type { Metadata } from "next";
import { Geist, Geist_Mono, Playfair_Display } from "next/font/google";
import { prisma } from "@/lib/db";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const business = await prisma.business.findFirst({
    select: {
      name: true,
      address: true,
      logoUrl: true,
      settings: { select: { siteContent: true } },
    },
  });

  const name = business?.name ?? "Marcações Online";
  const content = (business?.settings?.siteContent ?? {}) as {
    heroSubtitle?: string;
  };
  const description =
    content.heroSubtitle ??
    `Marque o seu serviço em ${name} online, de forma rápida e simples.`;

  return {
    metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
    title: {
      default: `${name}, Marcações Online`,
      template: `%s, ${name}`,
    },
    description,
    icons: business?.logoUrl ? [{ rel: "icon", url: business.logoUrl }] : undefined,
    openGraph: {
      title: `${name}, Marcações Online`,
      description,
      locale: "pt_PT",
      type: "website",
    },
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-PT"
      data-scroll-behavior="smooth"
      className={`${geistSans.variable} ${geistMono.variable} ${playfair.variable} h-full antialiased`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `if("serviceWorker" in navigator){navigator.serviceWorker.register("/sw.js").catch(()=>{})}`,
          }}
        />
      </head>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}

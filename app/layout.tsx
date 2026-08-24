import type { Metadata } from "next";
import { Geist, Geist_Mono, Playfair_Display } from "next/font/google";
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

export const metadata: Metadata = {
  title: {
    default: "Salão Exemplo — Marcações Online",
    template: "%s — Salão Exemplo",
  },
  description:
    "Marque o seu serviço de nail art e beleza online, de forma rápida e simples. Escolha serviços, profissional e horário em menos de um minuto.",
  keywords: [
    "marcações online",
    "salão de beleza",
    "manicure",
    "pedicure",
    "nail art",
    "Lisboa",
  ],
  openGraph: {
    title: "Salão Exemplo — Marcações Online",
    description:
      "Marque o seu serviço de beleza online em menos de um minuto.",
    locale: "pt_PT",
    type: "website",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-PT"
      data-scroll-behavior="smooth"
      className={`${geistSans.variable} ${geistMono.variable} ${playfair.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}

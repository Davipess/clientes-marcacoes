import { prisma } from "@/lib/db";

export type PublicService = {
  id: string;
  name: string;
  description: string | null;
  durationMin: number;
  price: number; // euros
  imageUrl: string | null;
  categoryId: string;
};

export type PublicCategory = {
  id: string;
  name: string;
  services: PublicService[];
};

export type PublicStaff = {
  id: string;
  displayName: string;
  bio: string | null;
  photoUrl: string | null;
};

export async function getPublicData() {
  const business = await prisma.business.findFirst({
    include: {
      settings: true,
      serviceCategories: {
        where: { archived: false },
        orderBy: { sortOrder: "asc" },
        include: {
          services: {
            where: { archived: false },
            orderBy: { name: "asc" },
          },
        },
      },
      staff: {
        where: { active: true, user: {} },
        include: { user: { select: { name: true } } },
      },
    },
  });

  if (!business) return null;

  const categories: PublicCategory[] = business.serviceCategories.map((cat) => ({
    id: cat.id,
    name: cat.name,
    services: cat.services.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      durationMin: s.durationMin,
      price: Number(s.price),
      imageUrl: s.imageUrl,
      categoryId: cat.id,
    })),
  }));

  const staff: PublicStaff[] = business.staff.map((st) => ({
    id: st.id,
    displayName: st.displayName,
    bio: st.bio,
    photoUrl: st.photoUrl,
  }));

  return {
    business: {
      id: business.id,
      name: business.name,
      address: business.address,
      phone: business.phone,
      email: business.email,
      primaryColor: business.primaryColor,
      secondaryColor: business.secondaryColor,
      primaryColorHex: oklchOrHexToCss(business.primaryColor),
      secondaryColorHex: oklchOrHexToCss(business.secondaryColor),
      logoUrl: business.logoUrl,
      timezone: business.timezone,
      siteContent: parseSiteContent(business.settings?.siteContent),
    },
    openingHours: (business.settings?.openingHours ?? null) as Record<
      string,
      { open: string; close: string }[] | null
    > | null,
    cancellationPolicyText: business.settings?.cancellationPolicyText ?? "",
    categories,
    staff,
  };
}

export type SiteContent = {
  heroBadge: string;
  heroTitle: string;
  heroTitleHighlight: string;
  heroSubtitle: string;
  aboutTitle: string;
  about: { title: string; text: string }[];
  ctaTitle: string;
  ctaSubtitle: string;
};

const DEFAULT_CONTENT: SiteContent = {
  heroBadge: "Marcações online, sem chamadas",
  heroTitle: "As suas unhas,",
  heroTitleHighlight: "ao seu tempo.",
  heroSubtitle:
    "Escolha os seus serviços, o melhor horário e confirme em menos de um minuto. Simples, rápido e sem esperas.",
  aboutTitle: "Porque nos escolher",
  about: [
    {
      title: "Profissionalismo",
      text: "Técnicas atualizadas e produtos de qualidade, num ambiente acolhedor.",
    },
    {
      title: "À sua medida",
      text: "Combine vários serviços numa só visita, tudo no horário que lhe der jeito.",
    },
    {
      title: "Sem complicações",
      text: "Marcação online em segundos. Confirmação imediata no site.",
    },
  ],
  ctaTitle: "Pronta para mimar-se?",
  ctaSubtitle: "Reserve o seu momento. Pagamento efetuado no local.",
};

export function parseSiteContent(raw: unknown): SiteContent {
  if (!raw || typeof raw !== "object") return DEFAULT_CONTENT;
  const rawObj = raw as Record<string, unknown>;
  // Merge with defaults: any missing/invalid key falls back.
  const merged: SiteContent = { ...DEFAULT_CONTENT };
  for (const key of Object.keys(DEFAULT_CONTENT) as (keyof SiteContent)[]) {
    const value = rawObj[key];
    if (key === "about") {
      if (
        Array.isArray(value) &&
        value.every(
          (v) =>
            typeof v === "object" &&
            v !== null &&
            typeof (v as { title?: unknown }).title === "string" &&
            typeof (v as { text?: unknown }).text === "string",
        )
      ) {
        merged.about = value as { title: string; text: string }[];
      }
    } else if (typeof value === "string" && value.trim().length > 0) {
      // String fields, length-capped on the admin side.
      (merged as Record<string, unknown>)[key] = value;
    }
  }
  return merged;
}

/**
 * Business colors are stored as hex (#rrggbb, editable in the admin).
 * Passed straight through to inline CSS variables, the regex guard keeps
 * malformed values from ever reaching the DOM.
 */
function oklchOrHexToCss(value: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value : "#C2185B";
}

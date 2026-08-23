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
      timezone: business.timezone,
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

export type PublicData = NonNullable<Awaited<ReturnType<typeof getPublicData>>>;

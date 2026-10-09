import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { Role } from "@/lib/generated/prisma/client";
import SetupForm from "./form";

export default async function ConfiguracaoPage() {
  const authUser = await getAuthUser();
  if (authUser) {
    redirect(authUser.role === Role.ADMIN ? "/admin" : "/staff");
  }

  const adminExiste = await prisma.user.findFirst({
    where: { role: Role.ADMIN },
  });
  if (adminExiste) {
    // Bootstrap already done, this page must never expose account creation.
    redirect("/entrar");
  }

  return <SetupForm />;
}

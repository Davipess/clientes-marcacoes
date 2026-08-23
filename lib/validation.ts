import { z } from "zod";

export const passwordSchema = z
  .string()
  .min(12, "A palavra-passe deve ter pelo menos 12 caracteres")
  .max(128)
  .regex(/[A-Z]/, "Deve incluir uma letra maiúscula")
  .regex(/[a-z]/, "Deve incluir uma letra minúscula")
  .regex(/[0-9]/, "Deve incluir um dígito");

export const emailSchema = z.string().email("Email inválido").max(254);

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
});

export const setupSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: emailSchema,
  password: passwordSchema,
});

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z.object({
  token: z.string().min(20).max(200),
  password: passwordSchema,
});

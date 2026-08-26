import { z } from "zod";

export const passwordSchema = z
  .string()
  .min(12, "A palavra-passe deve ter pelo menos 12 caracteres")
  .max(128)
  .regex(/[A-Z]/, "Deve incluir uma letra maiúscula")
  .regex(/[a-z]/, "Deve incluir uma letra minúscula")
  .regex(/[0-9]/, "Deve incluir um dígito");

export const emailSchema = z.string().email("Email inválido").max(254);

/**
 * Telefone de contacto:
 *  - Formato livre em caracteres (espaços, parênteses, travessões, pontos)
 *  - Sem indicativo internacional → tem de ser número português válido
 *    (9 dígitos, a começar por 9 = telemóvel, ou 2 = fixo)
 *  - Com "+" → número internacional E.164 (8–15 dígitos no total)
 * Exemplos válidos: 912 345 678 · 912345678 · +351 912 345 678 · +44 20 7183 8750
 * Exemplos rejeitados: 30304304043 · 12345 · 9123456789012345678
 */
export const phoneSchema = z
  .string()
  .trim()
  .min(1, "O telefone é obrigatório")
  .max(20, "Telefone demasiado comprido")
  .regex(
    /^[+]?[\d\s()+.-]+$/,
    "O telefone só pode conter dígitos, espaços, parênteses e travessões",
  )
  .refine(
    (value) => {
      const digits = value.replace(/\D/g, "");
      // Nacional: Portugal = 9 dígitos, telemóvel (9) ou fixo (2).
      if (digits.length === 9 && /^[92]/.test(digits)) return true;
      // Com indicativo de Portugal escrito por extenso: 351 + 9 dígitos.
      if (digits.startsWith("351")) {
        const rest = digits.slice(3);
        return rest.length === 9 && /^[92]/.test(rest);
      }
      // Internacional com "+": E.164 exige 8–15 dígitos no total.
      if (value.startsWith("+")) {
        return digits.length >= 8 && digits.length <= 15;
      }
      return false;
    },
    {
      message:
        "Número inválido. Em Portugal use 9 dígitos (ex.: 912 345 678) ou indique o + e o indicativo do país (ex.: +44 20 7183 8750)",
    },
  );

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(8).max(128),
});

export const setupSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: emailSchema,
  password: passwordSchema,
});

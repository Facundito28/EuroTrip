import { z } from "zod";
export const passwordSchema = z
  .string()
  .min(12, "Usá al menos 12 caracteres.")
  .max(72, "Usá hasta 72 caracteres.")
  .refine(
    (value) => new TextEncoder().encode(value).length <= 72,
    "La contraseña no puede superar 72 bytes; usá menos símbolos o letras con tilde.",
  );

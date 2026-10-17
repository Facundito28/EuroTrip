import { createClient } from "@supabase/supabase-js";
import { createHmac } from "node:crypto";
import { z } from "zod";
import { passwordSchema } from "@/lib/password";
export const runtime = "nodejs";
const schema = z.object({
  email: z.email().max(320),
  code: z.string().regex(/^[a-f0-9]{32}$/),
  password: passwordSchema,
});
const reply = (message: string, status: number) =>
  Response.json(
    { message },
    { status, headers: { "Cache-Control": "no-store" } },
  );
export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key)
    return reply(
      "La recuperación no está configurada. Contactá al organizador.",
      503,
    );
  try {
    const text = await request.text();
    if (text.length > 4096) return reply("Solicitud demasiado grande.", 413);
    const input = schema.safeParse(JSON.parse(text));
    if (!input.success)
      return reply(
        "Revisá el correo, el código y la contraseña (entre 12 y 72 caracteres).",
        400,
      );
    const client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      "unknown";
    const fingerprint = createHmac("sha256", key).update(ip).digest("hex");
    const { data: userId, error } = await client.rpc("consume_recovery_code", {
      p_email: input.data.email.toLowerCase(),
      p_code: input.data.code,
      p_client: fingerprint,
    });
    if (error)
      return reply("No se pudo comprobar el código. Reintentá más tarde.", 503);
    if (!userId)
      return reply(
        "El código no es válido, ya fue usado o alcanzaste el límite de intentos. Esperá 15 minutos antes de volver a intentar.",
        400,
      );
    const { error: update } = await client.auth.admin.updateUserById(userId, {
      password: input.data.password,
    });
    if (update)
      return reply(
        "No se pudo cambiar la contraseña. Este código ya se consumió; reintentá con otro de tus códigos.",
        503,
      );
    return reply(
      "Contraseña actualizada. Ya podés ingresar con tu nueva contraseña.",
      200,
    );
  } catch {
    return reply("No se pudo procesar la solicitud. Reintentá más tarde.", 400);
  }
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { supabase } from "./supabase/server";
import { currencies, parseMoney, toEur, validateRate } from "./money";
import { passwordSchema } from "./password";
import { categories } from "./types";

export type ActionResult = {
  ok: boolean;
  message: string;
  invitationCode?: string;
  redirectTo?: string;
};
const uuid = z.uuid();
const text = (max: number) =>
  z.string().trim().min(1, "Completá los campos obligatorios.").max(max);
const date = z.iso.date();
const get = (f: FormData, k: string) => String(f.get(k) ?? "");
function dbError(error: { message: string; code?: string }) {
  if (error.code === "42501")
    return new Error("No tenés permiso para realizar esta operación.");
  if (error.code === "P0001") return new Error(error.message);
  if (error.code === "23503")
    return new Error(
      "El registro está vinculado a otro dato o el integrante no pertenece al viaje.",
    );
  if (error.code === "23514")
    return new Error(
      "Los datos no cumplen los límites permitidos. Revisá importes, fechas y cotización.",
    );
  if (error.code === "23505") return new Error("Este registro ya existe.");
  console.error("Supabase operation failed:", error.code ?? "unknown");
  return new Error(
    "No se pudo guardar. Revisá la conexión y que las migraciones estén aplicadas.",
  );
}
async function perform(
  operation: () => Promise<string>,
): Promise<ActionResult> {
  try {
    const message = await operation();
    revalidatePath("/");
    return { ok: true, message };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof z.ZodError
          ? (error.issues[0]?.message ?? "Revisá los campos.")
          : error instanceof Error
            ? error.message
            : "Ocurrió un error inesperado.",
    };
  }
}
async function session() {
  const client = await supabase();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user) throw new Error("Tu sesión venció. Volvé a ingresar.");
  return { client, user };
}
function monetary(f: FormData) {
  const currency = z.enum(currencies).parse(get(f, "currency"));
  const amount_minor = parseMoney(get(f, "amount"));
  if (!amount_minor) throw new Error("El importe debe ser mayor que cero.");
  const rate_to_eur = currency === "EUR" ? "1" : validateRate(get(f, "rate"));
  if (!toEur(amount_minor, rate_to_eur))
    throw new Error("El equivalente en EUR debe ser de al menos un centavo.");
  return {
    currency,
    amount_minor,
    rate_to_eur,
    rate_date: date.parse(get(f, "rate_date")),
  };
}
export async function login(f: FormData): Promise<ActionResult> {
  return perform(async () => {
    const email = z
      .email()
      .max(254)
      .parse(get(f, "email").trim().toLowerCase());
    const password = z
      .string()
      .min(1, "Ingresá tu contraseña.")
      .max(128)
      .parse(get(f, "password"));
    const client = await supabase();
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error)
      throw new Error("No pudimos ingresar. Revisá tu correo y contraseña.");
    return "Sesión iniciada.";
  });
}
export async function register(f: FormData): Promise<ActionResult> {
  return perform(async () => {
    const email = z
      .email()
      .max(254)
      .parse(get(f, "email").trim().toLowerCase());
    const password = passwordSchema.parse(get(f, "password"));
    if (password !== get(f, "password_confirm"))
      throw new Error("Las contraseñas no coinciden.");
    const client = await supabase();
    const { data, error } = await client.auth.signUp({ email, password });
    if (error)
      throw new Error(
        "No pudimos crear la cuenta. Si ya existe, ingresá con tu contraseña. Revisá también los requisitos y reintentá más tarde.",
      );
    if (!data.session)
      throw new Error(
        "No se pudo iniciar sesión. Revisá si ya tenés una cuenta o si el proyecto todavía exige confirmación por correo.",
      );
    return "Cuenta creada. Ahora podés crear tu viaje o ingresar con una invitación.";
  });
}
export async function joinTrip(f: FormData): Promise<ActionResult> {
  let tripId = "";
  const result = await perform(async () => {
    const { client } = await session();
    const code = z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-f0-9]{32}$/, "Pegá el código completo de tu invitación.")
      .parse(get(f, "code"));
    const { data, error } = await client.rpc("accept_invitation", {
      p_code: code,
    });
    if (error) throw dbError(error);
    tripId = uuid.parse(data);
    return "Ya formás parte del viaje.";
  });
  return result.ok ? { ...result, redirectTo: `/?trip=${tripId}` } : result;
}
export async function changePassword(f: FormData): Promise<ActionResult> {
  return perform(async () => {
    const { client, user } = await session();
    const password = passwordSchema.parse(get(f, "password"));
    if (password !== get(f, "password_confirm"))
      throw new Error("Las contraseñas no coinciden.");
    const { error: check } = await client.auth.signInWithPassword({
      email: user.email!,
      password: get(f, "current_password"),
    });
    if (check) throw new Error("La contraseña actual es incorrecta.");
    const { error } = await client.auth.updateUser({ password });
    if (error)
      throw new Error(
        "No se pudo actualizar la contraseña. Reintentá más tarde.",
      );
    return "Contraseña actualizada. Guardala en un gestor de contraseñas.";
  });
}
export async function logout() {
  const client = await supabase();
  await client.auth.signOut();
  redirect("/");
}
export async function createTrip(f: FormData) {
  return perform(async () => {
    const { client } = await session();
    const { error } = await client.rpc("create_trip", {
      p_name: text(100).parse(get(f, "name")),
      p_display_name: text(80).parse(get(f, "display_name")),
    });
    if (error) throw dbError(error);
    return "Tu viaje está listo. Invitá a tus amigos desde Equipo.";
  });
}
export async function saveExpense(f: FormData) {
  return perform(async () => {
    const { client } = await session();
    const money = monetary(f);
    const members = z
      .array(uuid)
      .min(1, "Elegí al menos un participante.")
      .max(4)
      .parse(f.getAll("members"));
    const { error } = await client.rpc("save_expense", {
      p_id: get(f, "id") ? uuid.parse(get(f, "id")) : null,
      p_request: uuid.parse(get(f, "request_id")),
      p_trip: uuid.parse(get(f, "trip_id")),
      p_description: text(160).parse(get(f, "description")),
      p_category: z.enum(categories).parse(get(f, "category")),
      p_amount: money.amount_minor,
      p_currency: money.currency,
      p_rate: money.rate_to_eur,
      p_rate_date: money.rate_date,
      p_date: date.parse(get(f, "occurred_on")),
      p_status: z
        .enum(["estimated", "reserved", "paid"])
        .parse(get(f, "status")),
      p_payer: uuid.parse(get(f, "payer_id")),
      p_members: members,
      p_notes: z.string().max(2000).parse(get(f, "notes")),
    });
    if (error) throw dbError(error);
    return "Gasto guardado y saldos actualizados.";
  });
}
export async function markPaid(f: FormData) {
  return perform(async () => {
    const { client } = await session();
    const { error } = await client.rpc("mark_expense_paid", {
      p_id: uuid.parse(get(f, "id")),
      p_trip: uuid.parse(get(f, "trip_id")),
    });
    if (error) throw dbError(error);
    return "Pago registrado sobre el mismo gasto, sin duplicarlo.";
  });
}
export async function deleteExpense(f: FormData) {
  return perform(async () => {
    const { client } = await session();
    const trip = uuid.parse(get(f, "trip_id")),
      id = uuid.parse(get(f, "id"));
    // Delete storage before ledger deletion so failed cleanup remains retryable.
    const { data: receipts, error: readError } = await client
      .from("receipts")
      .select("path")
      .eq("expense_id", id)
      .eq("trip_id", trip);
    if (readError) throw dbError(readError);
    if (receipts?.length) {
      const { error } = await client.storage
        .from("receipts")
        .remove(receipts.map((r) => r.path));
      if (error)
        throw new Error(
          "No se pudieron eliminar los comprobantes. Intentá nuevamente.",
        );
    }
    const { error } = await client.rpc("delete_expense", {
      p_id: id,
      p_trip: trip,
    });
    if (error) throw dbError(error);
    return "Gasto eliminado.";
  });
}
export async function saveSettlement(f: FormData) {
  return perform(async () => {
    const { client, user } = await session();
    const money = monetary(f);
    const from_id = uuid.parse(get(f, "from_id")),
      to_id = uuid.parse(get(f, "to_id"));
    if (from_id === to_id) throw new Error("Elegí dos integrantes diferentes.");
    const { error } = await client.from("settlements").insert({
      request_id: uuid.parse(get(f, "request_id")),
      trip_id: uuid.parse(get(f, "trip_id")),
      from_id,
      to_id,
      ...money,
      occurred_on: date.parse(get(f, "occurred_on")),
      notes: z.string().max(2000).parse(get(f, "notes")),
      created_by: user.id,
    });
    if (error) throw dbError(error);
    return "Transferencia registrada. No se suma a los consumos.";
  });
}
export async function deleteRecord(f: FormData) {
  return perform(async () => {
    const { client } = await session();
    const table = z
      .enum([
        "settlements",
        "itinerary_events",
        "scenarios",
        "scenario_items",
        "trip_invitations",
      ])
      .parse(get(f, "table"));
    const { data, error } = await client
      .from(table)
      .delete()
      .eq("id", uuid.parse(get(f, "id")))
      .eq("trip_id", uuid.parse(get(f, "trip_id")))
      .select("id");
    if (error) throw dbError(error);
    if (!data?.length)
      throw new Error("No tenés permiso o el registro ya fue eliminado.");
    return "Registro eliminado.";
  });
}
export async function saveTrip(f: FormData) {
  return perform(async () => {
    const { client } = await session();
    const starts_on = date.parse(get(f, "starts_on")),
      ends_on = date.parse(get(f, "ends_on"));
    if (ends_on < starts_on)
      throw new Error("La fecha final debe ser posterior al inicio.");
    const route_stops = z
      .array(text(100))
      .min(1)
      .max(30)
      .parse(
        get(f, "route_stops")
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
      );
    const { data, error } = await client
      .from("trips")
      .update({
        name: text(100).parse(get(f, "name")),
        budget_minor: parseMoney(get(f, "budget")),
        starts_on,
        ends_on,
        route_stops,
      })
      .eq("id", uuid.parse(get(f, "trip_id")))
      .select("id");
    if (error) throw dbError(error);
    if (!data?.length)
      throw new Error("Solo el organizador puede configurar el viaje.");
    return "Configuración guardada.";
  });
}
export async function inviteMember(f: FormData): Promise<ActionResult> {
  let code = "";
  const result = await perform(async () => {
    const { client } = await session();
    const { data, error } = await client.rpc("create_invitation", {
      p_trip: uuid.parse(get(f, "trip_id")),
      p_email: z.email().max(254).parse(get(f, "email").trim().toLowerCase()),
    });
    if (error) throw dbError(error);
    code = z
      .string()
      .regex(/^[a-f0-9]{32}$/)
      .parse(data);
    return "Invitación creada. Compartí el código de forma privada con tu amigo.";
  });
  return result.ok ? { ...result, invitationCode: code } : result;
}
export async function saveEvent(f: FormData) {
  return perform(async () => {
    const { client } = await session();
    const starts_on = date.parse(get(f, "starts_on")),
      ends_on = date.parse(get(f, "ends_on"));
    if (ends_on < starts_on)
      throw new Error("La fecha final debe ser posterior al inicio.");
    const record = {
      trip_id: uuid.parse(get(f, "trip_id")),
      title: text(160).parse(get(f, "title")),
      city: text(100).parse(get(f, "city")),
      starts_on,
      ends_on,
      kind: z.enum(["stay", "transport", "activity"]).parse(get(f, "kind")),
      expense_id: get(f, "expense_id")
        ? uuid.parse(get(f, "expense_id"))
        : null,
      notes: z.string().max(2000).parse(get(f, "notes")),
    };
    const query = get(f, "id")
      ? client
          .from("itinerary_events")
          .update(record)
          .eq("id", uuid.parse(get(f, "id")))
          .eq("trip_id", record.trip_id)
      : client.from("itinerary_events").insert(record);
    const { data, error } = await query.select("id");
    if (error) throw dbError(error);
    if (!data?.length) throw new Error("El evento ya no existe.");
    return "Itinerario actualizado.";
  });
}
export async function saveScenario(f: FormData) {
  return perform(async () => {
    const { client } = await session();
    const { error } = await client.from("scenarios").insert({
      trip_id: uuid.parse(get(f, "trip_id")),
      name: text(100).parse(get(f, "name")),
      notes: z.string().max(2000).parse(get(f, "notes")),
    });
    if (error) throw dbError(error);
    return "Escenario creado. Agregá precios reales o tus propias estimaciones.";
  });
}
export async function saveScenarioItem(f: FormData) {
  return perform(async () => {
    const { client } = await session();
    const confidence = z
      .enum(["estimated", "quoted", "confirmed"])
      .parse(get(f, "confidence"));
    const source = z.string().trim().max(1000).parse(get(f, "source"));
    if (confidence !== "estimated" && !source)
      throw new Error("Indicá la fuente de un precio cotizado o confirmado.");
    const { error } = await client.from("scenario_items").insert({
      trip_id: uuid.parse(get(f, "trip_id")),
      scenario_id: uuid.parse(get(f, "scenario_id")),
      description: text(160).parse(get(f, "description")),
      ...monetary(f),
      confidence,
      source,
    });
    if (error) throw dbError(error);
    return "Alternativa actualizada. No modifica los gastos del viaje.";
  });
}
export async function uploadReceipt(f: FormData) {
  return perform(async () => {
    const { client, user } = await session();
    const trip = uuid.parse(get(f, "trip_id")),
      expense = uuid.parse(get(f, "expense_id")),
      file = f.get("file");
    if (
      !(file instanceof File) ||
      file.size === 0 ||
      file.size > 5 * 1024 * 1024
    )
      throw new Error("Seleccioná un archivo de hasta 5 MB.");
    const extensions: Record<string, string> = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
      "application/pdf": "pdf",
    };
    const ext = extensions[file.type];
    if (!ext) throw new Error("Usá JPG, PNG, WebP o PDF.");
    const { data, error: lookup } = await client
      .from("expenses")
      .select("id")
      .eq("id", expense)
      .eq("trip_id", trip)
      .single();
    if (lookup || !data) throw new Error("No se encontró el gasto.");
    const path = `${trip}/${expense}/${crypto.randomUUID()}.${ext}`;
    const { error: upload } = await client.storage
      .from("receipts")
      .upload(path, file, { contentType: file.type, upsert: false });
    if (upload)
      throw new Error(
        "No se pudo subir el comprobante. Revisá el bucket privado y la conexión.",
      );
    const { error } = await client.from("receipts").insert({
      trip_id: trip,
      expense_id: expense,
      path,
      filename: file.name.slice(0, 200),
      created_by: user.id,
    });
    if (error) {
      await client.storage.from("receipts").remove([path]);
      throw dbError(error);
    }
    return "Comprobante guardado de forma privada.";
  });
}

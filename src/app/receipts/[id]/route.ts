import { configured, supabase } from "@/lib/supabase/server";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!configured())
    return new Response("Servicio sin configurar.", { status: 503 });
  const client = await supabase();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return new Response("Iniciá sesión.", { status: 401 });
  const { id } = await params;
  const { data, error } = await client
    .from("receipts")
    .select("path,filename")
    .eq("id", id)
    .single();
  if (error || !data)
    return new Response("Comprobante no encontrado.", { status: 404 });
  const { data: signed, error: signError } = await client.storage
    .from("receipts")
    .createSignedUrl(data.path, 60, { download: data.filename });
  if (signError || !signed)
    return new Response("No se pudo descargar.", { status: 503 });
  return new Response(null, {
    status: 303,
    headers: {
      Location: signed.signedUrl,
      "Cache-Control": "private, no-store",
    },
  });
}

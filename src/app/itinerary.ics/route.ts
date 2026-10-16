import { configured, supabase } from "@/lib/supabase/server";
import { loadHQ } from "@/lib/data";
import { itineraryIcs } from "@/lib/agenda";
export async function GET(request: Request) {
  const headers = { "Cache-Control": "private, no-store" };
  if (!configured())
    return new Response("Supabase no está configurado.", {
      status: 503,
      headers,
    });
  const client = await supabase();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return new Response("Iniciá sesión.", { status: 401, headers });
  try {
    const params = new URL(request.url).searchParams;
    const data = await loadHQ(user.id, params.get("trip") ?? undefined);
    if (!data || (params.get("trip") && params.get("trip") !== data.trip.id))
      return new Response("Viaje no encontrado.", { status: 404, headers });
    const events = params.has("event")
      ? data.events.filter((e) => e.id === params.get("event"))
      : data.events;
    if (params.has("event") && !events.length)
      return new Response("Evento no encontrado.", { status: 404, headers });
    return new Response(itineraryIcs(events), {
      headers: {
        ...headers,
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": 'attachment; filename="eurotrip-itinerario.ics"',
      },
    });
  } catch {
    return new Response("No se pudo exportar el calendario.", {
      status: 500,
      headers,
    });
  }
}

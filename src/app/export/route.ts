import { configured, supabase } from "@/lib/supabase/server";
import { loadHQ } from "@/lib/data";
import { expensesCsv } from "@/lib/csv";
export async function GET(request: Request) {
  if (!configured())
    return new Response("Supabase no está configurado.", { status: 503 });
  const client = await supabase();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return new Response("Iniciá sesión.", { status: 401 });
  try {
    const data = await loadHQ(
      user.id,
      new URL(request.url).searchParams.get("trip") ?? undefined,
    );
    if (!data) return new Response("Viaje no encontrado.", { status: 404 });
    return new Response(expensesCsv(data.expenses, data.members), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="eurotrip-gastos.csv"',
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return new Response("No se pudo exportar. Reintentá.", { status: 503 });
  }
}

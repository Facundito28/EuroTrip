import { supabase } from "./supabase/server";
import type { HQData, Trip } from "./types";
export async function loadHQ(
  userId: string,
  selectedTrip?: string,
): Promise<HQData | null> {
  const client = await supabase();
  const { data: trips, error } = await client
    .from("trips")
    .select("*")
    .order("created_at");
  if (error)
    throw new Error(
      "No se pudo leer el viaje. Revisá la conexión y las migraciones de Supabase.",
    );
  const trip = (trips?.find((t) => t.id === selectedTrip) ?? trips?.[0]) as
    Trip | undefined;
  if (!trip) return null;
  const { data, error: snapshotError } = await client.rpc("hq_snapshot", {
    p_trip: trip.id,
  });
  if (snapshotError || !data)
    throw new Error(
      "No se pudieron cargar los datos del viaje. Reintentá en unos segundos y comprobá la migración SQL.",
    );
  return { ...data, userId } as HQData;
}

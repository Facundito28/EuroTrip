import type { HQData } from "@/lib/types";
import { formatMoney, type Currency } from "@/lib/money";
const labels: Record<string, string> = {
  description: "Descripción",
  due_on: "Vencimiento",
  deleted_at: "Papelera",
  amount_minor: "Importe",
  status: "Estado",
  split_method: "Reparto",
  display_name: "Nombre",
  payer_id: "Pagador",
  rate_to_eur: "Cotización EUR",
  budget_minor: "Presupuesto",
  title: "Título",
  starts_on: "Inicio",
  ends_on: "Fin",
  location: "Lugar",
  start_time: "Hora de inicio",
  end_time: "Hora de fin",
  reparto: "Participantes",
  currency: "Moneda",
  occurred_on: "Fecha",
  rate_date: "Fecha cotización",
  notes: "Notas",
  name: "Nombre",
  route_stops: "Recorrido",
  usd_per_eur: "USD por EUR",
  display_rate_date: "Fecha TC de consulta",
  time_zone: "Zona horaria",
  metodo: "Tipo de reparto",
};
export function ActivityFeed({ data }: { data: HQData }) {
  const name = (id: unknown) =>
    data.members.find((m) => m.user_id === id)?.display_name ?? "Integrante";
  function value(key: string, v: unknown, row: Record<string, unknown>) {
    if (key === "deleted_at") return v == null ? "Activo" : "En papelera";
    if (v == null) return "—";
    if (key === "payer_id") return name(v);
    if (key === "amount_minor" || key === "budget_minor")
      return formatMoney(
        Number(v),
        (row.currency ?? row.moneda ?? "EUR") as Currency,
      );
    if (key === "split_method" || key === "metodo")
      return (
        (
          {
            equal: "Partes iguales",
            amount: "Importes",
            percent: "Porcentajes",
          } as Record<string, string>
        )[String(v)] ?? "Reparto"
      );
    if (key === "status")
      return (
        (
          {
            paid: "Pagado",
            reserved: "Reservado",
            estimated: "Estimado",
          } as Record<string, string>
        )[String(v)] ?? "Estado"
      );
    if (key === "reparto" && Array.isArray(v))
      return v
        .map(
          (s) =>
            `${name(s.member_id)}: ${row.metodo === "percent" ? `${Number(s.weight) / 100}%` : row.metodo === "amount" ? formatMoney(Number(s.weight), (row.moneda ?? "EUR") as Currency) : "parte igual"}`,
        )
        .join(" · ");
    return Array.isArray(v) ? v.join(" → ") : String(v);
  }
  const actions: Record<string, string> = {
    INSERT: "creó",
    UPDATE: "modificó",
    DELETE: "eliminó",
  };
  const entities: Record<string, string> = {
    expenses: "gasto",
    expense_payments: "pago",
    settlements: "transferencia",
    itinerary_events: "evento",
    trip_members: "nombre",
    trips: "configuración",
    expense_shares: "reparto",
  };
  return (
    <section className="panel">
      <h2>Actividad reciente</h2>
      <p>
        Últimos 100 cambios del grupo desde que se habilitó el historial.
        Horarios de Argentina.
      </p>
      {(data.activity ?? []).length ? (
        <div className="activity-list">
          {data.activity!.map((a) => {
            const row = a.after_data ?? a.before_data ?? {};
            const changed = Object.keys(row).filter(
              (k) =>
                labels[k] &&
                (!a.before_data ||
                  !a.after_data ||
                  JSON.stringify(a.before_data[k]) !==
                    JSON.stringify(a.after_data[k])),
            );
            return (
              <article key={a.id}>
                <p>
                  <strong>{name(a.actor_id)}</strong> {actions[a.action]}{" "}
                  {entities[a.entity] ?? "registro"}: <b>{a.label}</b>
                </p>
                <small>
                  {new Intl.DateTimeFormat("es-AR", {
                    dateStyle: "short",
                    timeStyle: "short",
                    timeZone: "America/Argentina/Buenos_Aires",
                  }).format(new Date(a.created_at))}
                </small>
                {changed.length > 0 && (
                  <details>
                    <summary>
                      {a.action === "UPDATE" ? "Ver cambios" : "Ver detalle"}
                    </summary>
                    {changed.map((k) => (
                      <p key={k}>
                        <b>{labels[k]}:</b>{" "}
                        {a.before_data && a.after_data ? (
                          <>
                            {value(k, a.before_data[k], a.before_data)} →{" "}
                            {value(k, a.after_data[k], a.after_data)}
                          </>
                        ) : (
                          value(k, row[k], row)
                        )}
                      </p>
                    ))}
                  </details>
                )}
              </article>
            );
          })}
        </div>
      ) : (
        <p className="notice">
          Los próximos movimientos aparecerán acá. No inventamos cambios
          anteriores.
        </p>
      )}
    </section>
  );
}

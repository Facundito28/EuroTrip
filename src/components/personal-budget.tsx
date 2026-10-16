"use client";
import { useState } from "react";
import { personalTotals, totals } from "@/lib/finance";
import { decimalAmount, formatMoney, toEur } from "@/lib/money";
import { savePersonalBudget, saveDisplayRate } from "@/lib/actions";
import type { HQData } from "@/lib/types";
import { ActionForm, HiddenTrip } from "./action-form";

export function PersonalBudget({ data }: { data: HQData }) {
  const [currency, setCurrency] = useState<"EUR" | "USD">("EUR");
  const rate = data.trip.usd_per_eur;
  const personal = data.personal_budget_minor;
  const mine = personalTotals(
    data.userId,
    data.expenses,
    data.shares,
    personal ?? 0,
  );
  const group = totals(data.expenses, data.trip.budget_minor);
  function money(amount: number) {
    if (currency === "EUR") return formatMoney(amount);
    if (!rate) return "Falta cotización";
    try {
      const converted = toEur(Math.abs(amount), rate);
      return formatMoney(amount < 0 ? -converted : converted, "USD");
    } catch {
      return "Fuera de rango";
    }
  }
  return (
    <section className="panel personal-budget">
      <div className="panel-heading">
        <div>
          <h2>Mi presupuesto</h2>
          <p>Tu parte del viaje, independientemente de quién pagó.</p>
        </div>
        <label>
          Ver totales en
          <select
            aria-label="Moneda de los totales"
            value={currency}
            onChange={(e) => setCurrency(e.target.value as "EUR" | "USD")}
          >
            <option>EUR</option>
            <option>USD</option>
          </select>
        </label>
      </div>
      <div className="personal-totals">
        {[
          ["Mi límite", personal == null ? null : personal],
          ["Mis consumos", mine.paid],
          ["Mis reservas", mine.reserved],
          ["Me queda", personal == null ? null : mine.available],
        ].map(([label, amount]) => (
          <div key={String(label)}>
            <span>{label}</span>
            <strong>
              {amount == null ? "Por definir" : money(Number(amount))}
            </strong>
          </div>
        ))}
      </div>
      <p className="field-help">
        Las estimaciones ({money(mine.estimated)}) se muestran aparte. Las
        devoluciones entre amigos no son consumos. Tu límite es privado y no
        modifica el presupuesto grupal.
      </p>
      <details>
        <summary>Ver totales del grupo en {currency}</summary>
        <div className="personal-totals">
          {[
            ["Presupuesto", data.trip.budget_minor],
            ["Pagado", group.paid],
            ["Reservado", group.reserved],
            ["Disponible", group.available],
          ].map(([label, amount]) => (
            <div key={String(label)}>
              <span>{label}</span>
              <strong>{money(Number(amount))}</strong>
            </div>
          ))}
        </div>
      </details>
      <p className="field-help">
        {rate
          ? `Cotización manual de consulta: 1 EUR = ${rate} USD · ${data.trip.display_rate_date}.`
          : "Sin cotización USD/EUR: el organizador puede definirla abajo."}{" "}
        El equivalente en USD es orientativo: parte de los importes EUR
        registrados. Cada gasto conserva su importe original y su propia
        cotización histórica.
      </p>
      <details>
        <summary>Editar mi límite personal</summary>
        <ActionForm action={savePersonalBudget} label="Guardar mi presupuesto">
          <HiddenTrip id={data.trip.id} />
          <label>
            Mi presupuesto personal · EUR
            <input
              name="personal_budget"
              inputMode="decimal"
              required
              defaultValue={personal == null ? "" : decimalAmount(personal)}
              placeholder="Tu límite para todo el viaje"
            />
          </label>
        </ActionForm>
      </details>
      {data.trip.owner_id === data.userId && (
        <details>
          <summary>Configurar cotización USD/EUR</summary>
          <ActionForm action={saveDisplayRate} label="Guardar cotización">
            <HiddenTrip id={data.trip.id} />
            <label>
              Dólares por 1 euro
              <input
                name="usd_per_eur"
                inputMode="decimal"
                required
                defaultValue={rate ?? ""}
                placeholder="Ingresá la cotización acordada"
              />
            </label>
            <label>
              Fecha de la cotización
              <input
                name="display_rate_date"
                type="date"
                required
                defaultValue={
                  data.trip.display_rate_date ??
                  new Date().toISOString().slice(0, 10)
                }
              />
            </label>
            <p className="field-help">
              Solo cambia la vista de totales en USD. No recalcula gastos,
              deudas ni pagos anteriores.
            </p>
          </ActionForm>
        </details>
      )}
    </section>
  );
}

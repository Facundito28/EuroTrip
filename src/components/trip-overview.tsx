"use client";
import { useState, useSyncExternalStore } from "react";
import type { HQData, Expense, PersonalExpense } from "@/lib/types";
import { dailyConsumption, balances, remainingOriginal } from "@/lib/finance";
import { formatMoney } from "@/lib/money";
import { restoreExpense } from "@/lib/actions";
import { ActionForm, HiddenTrip } from "./action-form";
const subscribe = () => () => {};
function localDay() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function dateLabel(day: string) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(day + "T12:00:00Z"));
}
export function TripOverview({
  data,
  onOpen,
}: {
  data: HQData;
  onOpen: (expense: Expense | PersonalExpense, personal: boolean) => void;
}) {
  const today = useSyncExternalStore(subscribe, localDay, () => "");
  const [chosen, setChosen] = useState("");
  const day = chosen || today;
  const mine = dailyConsumption(
    data.userId,
    day,
    data.expenses,
    data.shares,
    data.payments ?? [],
    data.personal_expenses ?? [],
  );
  const net =
    balances(
      data.members,
      data.expenses,
      data.shares,
      data.settlements,
      data.payments,
    )[data.userId] ?? 0;
  const due = [
    ...data.expenses
      .filter(
        (e) => e.due_on && e.status !== "estimated" && remainingOriginal(e) > 0,
      )
      .map((e) => ({ expense: e, personal: false })),
    ...(data.personal_expenses ?? [])
      .filter((e) => e.due_on && e.status === "reserved")
      .map((e) => ({ expense: e, personal: true })),
  ].sort((a, b) => a.expense.due_on!.localeCompare(b.expense.due_on!));
  return (
    <>
      <section className="panel day-overview">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">SOLO TU PARTE</span>
            <h2>Tu día, de un vistazo</h2>
            <p>Consumos según la fecha de pago. Las devoluciones no suman.</p>
          </div>
          <label>
            Ver día
            <input
              type="date"
              value={day}
              onChange={(e) => setChosen(e.target.value)}
            />
          </label>
        </div>
        <div className="personal-totals">
          <div>
            <span>Consumos del día</span>
            <strong>{formatMoney(mine.total)}</strong>
            <small>
              Tu parte compartida {formatMoney(mine.shared)} · privados{" "}
              {formatMoney(mine.personal)}
            </small>
          </div>
          <div>
            <span>
              {net < 0
                ? "Debés al grupo"
                : net > 0
                  ? "El grupo te debe"
                  : "Cuentas entre amigos"}
            </span>
            <strong>{net === 0 ? "Al día" : formatMoney(Math.abs(net))}</strong>
            <small>Saldo neto de todo el viaje</small>
          </div>
        </div>
      </section>
      <section className="panel due-panel">
        <div className="panel-heading">
          <div>
            <h2>Próximos pagos</h2>
            <p>
              Reservas compartidas y tus reservas privadas con fecha límite.
            </p>
          </div>
          <span className="pill">{due.length} pendientes</span>
        </div>
        {due.length ? (
          <ul className="due-list">
            {due.slice(0, 5).map(({ expense: e, personal }) => (
              <li key={e.id}>
                <div>
                  <span
                    className={`pill ${day && e.due_on! < today ? "due-late" : ""}`}
                  >
                    {today && e.due_on! < today ? "Vencido · " : ""}
                    {dateLabel(e.due_on!)}
                  </span>
                  <h3>{e.description}</h3>
                  <small>
                    {personal
                      ? "Privado · solo vos"
                      : "Compartido · total pendiente del grupo"}
                  </small>
                </div>
                <div>
                  <strong>
                    {formatMoney(
                      personal
                        ? e.amount_minor
                        : remainingOriginal(e as Expense),
                      e.currency,
                    )}
                  </strong>
                  <button
                    className="text-button"
                    onClick={() => onOpen(e, personal)}
                  >
                    Ver reserva
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty-hint">
            Sin vencimientos cargados. Agregá una fecha límite en «Más detalles»
            al crear o editar una reserva.
          </p>
        )}
        {due.length > 5 && (
          <details>
            <summary>Ver los {due.length - 5} restantes</summary>
            <ul className="due-list">
              {due.slice(5).map(({ expense: e, personal }) => (
                <li key={e.id}>
                  <span>
                    {dateLabel(e.due_on!)} · {e.description}
                  </span>
                  <button
                    className="text-button"
                    onClick={() => onOpen(e, personal)}
                  >
                    Ver reserva
                  </button>
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>
    </>
  );
}
export function TrashPanel({
  data,
  personal = false,
}: {
  data: HQData;
  personal?: boolean;
}) {
  const rows = personal ? (data.personal_trash ?? []) : (data.trash ?? []);
  if (!rows.length) return null;
  return (
    <details className="trash-panel">
      <summary>
        Papelera {personal ? "privada" : "del grupo"} · {rows.length}{" "}
        {rows.length === 1 ? "gasto" : "gastos"}
      </summary>
      <p className="field-help">
        Los gastos de la papelera no suman a los totales. Restaurarlos recupera
        también sus pagos y comprobantes.{" "}
        {personal
          ? "Solo vos podés verlos."
          : "Cualquier integrante puede restaurar un gasto compartido."}
      </p>
      <ul className="due-list">
        {rows.map((e) => (
          <li key={e.id}>
            <div>
              <h3>{e.description}</h3>
              <small>{formatMoney(e.amount_minor, e.currency)}</small>
            </div>
            <ActionForm
              action={restoreExpense}
              label="Restaurar"
              className="inline-action"
            >
              <HiddenTrip id={data.trip.id} />
              <input type="hidden" name="id" value={e.id} />
              <input
                type="hidden"
                name="private"
                value={personal ? "yes" : "no"}
              />
            </ActionForm>
          </li>
        ))}
      </ul>
    </details>
  );
}

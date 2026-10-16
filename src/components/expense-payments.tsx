"use client";
import { useState } from "react";
import type { Expense, HQData } from "@/lib/types";
import { decimalAmount, formatMoney } from "@/lib/money";
import { paidAmount, remainingOriginal, remainingAmount } from "@/lib/finance";
import { addExpensePayment, deleteExpensePayment } from "@/lib/actions";
import { ActionForm, HiddenTrip } from "./action-form";
export function ExpensePayments({
  data,
  expense: e,
}: {
  data: HQData;
  expense: Expense;
}) {
  const [request, setRequest] = useState(() => crypto.randomUUID());
  const payments = (data.payments ?? []).filter((p) => p.expense_id === e.id);
  const remaining = remainingOriginal(e);
  return (
    <section className="expense-payments">
      <h4>Pagos y cuotas</h4>
      <p>
        Pagado: <b>{formatMoney(paidAmount(e))}</b> · Pendiente:{" "}
        <b>{formatMoney(remaining, e.currency)}</b> (
        {formatMoney(remainingAmount(e))} al TC de reserva).
      </p>
      {payments.map((p) => (
        <div key={p.id} className="payment-row">
          <p>
            {p.occurred_on} ·{" "}
            {data.members.find((m) => m.user_id === p.payer_id)?.display_name}
            <br />
            {formatMoney(p.amount_minor, e.currency)} ·{" "}
            {formatMoney(p.eur_minor)} · TC {p.rate_to_eur} del {p.rate_date}
            {p.notes && (
              <>
                <br />
                {p.notes}
              </>
            )}
          </p>
          {(p.created_by === data.userId ||
            data.trip.owner_id === data.userId) && (
            <ActionForm
              action={deleteExpensePayment}
              label="Anular pago"
              confirm="¿Anular este pago? Volverá al saldo pendiente; el historial conservará la anulación."
              className="inline-action"
            >
              <HiddenTrip id={data.trip.id} />
              <input type="hidden" name="payment_id" value={p.id} />
            </ActionForm>
          )}
        </div>
      ))}
      {remaining > 0 && e.status !== "estimated" && (
        <details>
          <summary>Registrar anticipo o cuota</summary>
          <ActionForm
            key={`${request}-${remaining}`}
            action={addExpensePayment}
            label="Registrar pago"
            onSuccess={() => setRequest(crypto.randomUUID())}
          >
            <HiddenTrip id={data.trip.id} />
            <input type="hidden" name="expense_id" value={e.id} />
            <input type="hidden" name="request_id" value={request} />
            <label>
              Importe del pago · {e.currency}
              <input
                name="amount"
                inputMode="decimal"
                required
                defaultValue={decimalAmount(remaining)}
              />
            </label>
            <label>
              Quién pagó esta cuota
              <select name="payer_id" defaultValue={data.userId}>
                {data.members.map((m) => (
                  <option key={m.user_id} value={m.user_id}>
                    {m.display_name}
                  </option>
                ))}
              </select>
            </label>
            <div className="form-grid">
              <label>
                EUR por 1 {e.currency} de este pago
                <input
                  name="rate"
                  inputMode="decimal"
                  required
                  readOnly={e.currency === "EUR"}
                  defaultValue={e.currency === "EUR" ? "1" : ""}
                />
              </label>
              <label>
                Fecha de cotización del pago
                <input
                  name="rate_date"
                  type="date"
                  required
                  defaultValue={new Date().toISOString().slice(0, 10)}
                />
              </label>
            </div>
            <label>
              Fecha del pago
              <input
                name="occurred_on"
                type="date"
                required
                defaultValue={new Date().toISOString().slice(0, 10)}
              />
            </label>
            <label>
              Nota de la cuota
              <input
                name="notes"
                maxLength={2000}
                placeholder="Seña, segunda cuota, saldo…"
              />
            </label>
            <p className="field-help">
              Registrá dinero efectivamente pagado en {e.currency}. Si pagaste
              en otra moneda, indicá el importe cancelado en {e.currency} y su
              equivalente EUR con el TC efectivo. No se agrega otro gasto.
            </p>
          </ActionForm>
        </details>
      )}
    </section>
  );
}

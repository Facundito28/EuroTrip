"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { HQData, PersonalExpense, Expense } from "@/lib/types";
import { categories } from "@/lib/types";
import { formatMoney } from "@/lib/money";
import { savePersonalExpense, deletePersonalExpense } from "@/lib/actions";
import { ActionForm, HiddenTrip } from "./action-form";
import { TrashPanel } from "./trip-overview";
import { MoneyFields, ExpenseForm } from "./forms";
export function PersonalExpenseForm({
  data,
  expense,
  preset,
  done,
}: {
  data: HQData;
  expense?: PersonalExpense;
  preset?: string;
  done: () => void;
}) {
  const [request] = useState(() => crypto.randomUUID());
  return (
    <>
      <p className="notice">
        Solo vos podés ver este gasto. No genera deudas ni modifica el
        presupuesto grupal.
      </p>
      <ActionForm
        action={savePersonalExpense}
        label={expense ? "Guardar gasto personal" : "Guardar solo para mí"}
        onSuccess={done}
      >
        <HiddenTrip id={data.trip.id} />
        <input name="id" type="hidden" value={expense?.id ?? ""} />
        <input name="request_id" type="hidden" value={request} />
        <MoneyFields expense={expense} />
        <label>
          Descripción
          <input
            name="description"
            maxLength={160}
            required
            defaultValue={expense?.description ?? preset ?? ""}
            placeholder="Mi hamburguesa, ropa, un regalo…"
          />
        </label>
        <div className="form-grid">
          <label>
            Categoría
            <select
              name="category"
              defaultValue={expense?.category ?? preset ?? "Comida"}
            >
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label>
            Estado
            <select name="status" defaultValue={expense?.status ?? "paid"}>
              <option value="paid">Pagado</option>
              <option value="reserved">Reservado</option>
              <option value="estimated">Estimado</option>
            </select>
          </label>
        </div>
        <label>
          Fecha de mi gasto
          <input
            type="date"
            name="occurred_on"
            required
            defaultValue={
              expense?.occurred_on ?? new Date().toISOString().slice(0, 10)
            }
          />
        </label>
        <details className="form-options">
          <summary>Más detalles · vencimiento y notas</summary>
          <label>
            Fecha límite de pago (opcional)
            <input
              name="due_on"
              type="date"
              defaultValue={expense?.due_on ?? ""}
            />
          </label>
          <label>
            Notas privadas
            <textarea
              name="notes"
              maxLength={2000}
              defaultValue={expense?.notes}
            />
          </label>
        </details>
      </ActionForm>
    </>
  );
}
export function ExpenseEntry({
  data,
  expense,
  repeat,
  preset,
  done,
}: {
  data: HQData;
  expense?: Expense;
  repeat?: boolean;
  preset?: string;
  done: () => void;
}) {
  const [scope, setScope] = useState("shared");
  return (
    <>
      {!expense && (
        <label>
          ¿Para quién es este gasto?
          <select value={scope} onChange={(e) => setScope(e.target.value)}>
            <option value="shared">Compartido · visible para el grupo</option>
            <option value="personal">Solo para mí · privado</option>
          </select>
        </label>
      )}
      {scope === "personal" ? (
        <PersonalExpenseForm data={data} preset={preset} done={done} />
      ) : (
        <>
          <p className="field-help">
            Este gasto es visible para el grupo, incluso si participa una sola
            persona. Para una compra privada elegí «Solo para mí».
          </p>
          <ExpenseForm
            data={data}
            expense={expense}
            repeat={repeat}
            preset={preset}
            done={done}
          />
        </>
      )}
    </>
  );
}
export function PrivateExpenses({
  data,
  onAdd,
  onEdit,
}: {
  data: HQData;
  onAdd: () => void;
  onEdit: (e: PersonalExpense) => void;
}) {
  const router = useRouter();
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h2>Mis gastos privados</h2>
          <p>
            Solo vos los ves. Suman a tu presupuesto personal, sin repartirlos.
          </p>
        </div>
        <button className="button primary" onClick={onAdd}>
          Agregar gasto personal
        </button>
      </div>
      {(data.personal_expenses ?? []).length ? (
        <div className="private-expense-list">
          {data.personal_expenses!.map((e) => (
            <article key={e.id}>
              <div>
                <h3>{e.description}</h3>
                <p>
                  {e.category} · {e.occurred_on} ·{" "}
                  {
                    {
                      paid: "Pagado",
                      reserved: "Reservado",
                      estimated: "Estimado",
                    }[e.status]
                  }
                </p>
                <strong>{formatMoney(e.amount_minor, e.currency)}</strong>
                <small> · {formatMoney(e.eur_minor)}</small>
                {e.notes && <p className="preserve">{e.notes}</p>}
              </div>
              <div className="row-actions">
                <button
                  className="button secondary small"
                  onClick={() => onEdit(e)}
                >
                  Editar gasto personal
                </button>
                <ActionForm
                  action={deletePersonalExpense}
                  label="Eliminar gasto personal"
                  className="inline-action"
                  confirm="¿Eliminar tu gasto personal?"
                  onSuccess={() => router.refresh()}
                >
                  <HiddenTrip id={data.trip.id} />
                  <input type="hidden" name="id" value={e.id} />
                </ActionForm>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="notice">
          Tus compras individuales van acá: una hamburguesa, ropa o un recuerdo.
          No aparecen en Gastos compartidos ni en Actividad.
        </p>
      )}
      <TrashPanel data={data} personal />
    </section>
  );
}

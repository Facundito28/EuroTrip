"use client";
import { useState } from "react";
import {
  saveExpense,
  saveSettlement,
  saveEvent,
  saveScenario,
  saveScenarioItem,
  saveTrip,
  inviteMember,
} from "@/lib/actions";
import { currencies, decimalAmount, formatMoney } from "@/lib/money";
import {
  categories,
  type HQData,
  type Expense,
  type Event,
  type Scenario,
} from "@/lib/types";
import { eventZones } from "@/lib/agenda";
import { ReceiptUploader } from "./receipt-uploader";
import { ActionForm, HiddenTrip } from "./action-form";
const today = () => new Date().toISOString().slice(0, 10);
export function MoneyFields({
  expense,
  reviewRate = false,
}: {
  reviewRate?: boolean;
  expense?: Pick<
    Expense,
    "amount_minor" | "currency" | "rate_to_eur" | "rate_date"
  >;
}) {
  const [currency, setCurrency] = useState<string>(expense?.currency ?? "EUR");
  return (
    <>
      <div className="form-grid">
        <label>
          Importe original
          <input
            name="amount"
            inputMode="decimal"
            placeholder="0,00"
            required
            defaultValue={expense ? decimalAmount(expense.amount_minor) : ""}
          />
        </label>
        <label>
          Moneda
          <select
            name="currency"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
          >
            {currencies.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
      </div>
      {currency === "EUR" ? (
        <>
          <input type="hidden" name="rate" value="1" />
          <input
            type="hidden"
            name="rate_date"
            value={expense?.rate_date ?? today()}
          />
        </>
      ) : (
        <>
          <div className="form-grid">
            <label>
              EUR por 1 {currency}
              <input
                key={currency}
                name="rate"
                inputMode="decimal"
                required
                readOnly={currency === "EUR"}
                defaultValue={
                  currency === "EUR"
                    ? "1"
                    : !reviewRate && expense?.currency === currency
                      ? String(expense.rate_to_eur)
                      : ""
                }
                placeholder="Ingresá la cotización"
              />
            </label>
            <label>
              Fecha de la cotización
              <input
                type="date"
                name="rate_date"
                required
                defaultValue={expense?.rate_date ?? today()}
              />
            </label>
          </div>
          <p className="field-help">
            Cotización manual: por ejemplo, indicá cuántos EUR equivale una
            unidad de la moneda elegida. Se conserva con esta operación.
          </p>
        </>
      )}
    </>
  );
}
export function ExpenseForm({
  data,
  expense,
  repeat = false,
  preset,
  done,
}: {
  data: HQData;
  repeat?: boolean;
  preset?: string;
  expense?: Expense;
  done: () => void;
}) {
  const [description, setDescription] = useState(
    expense?.description ?? preset ?? "",
  );
  const [category, setCategory] = useState(
    expense?.category ?? preset ?? "Comida",
  );
  const [method, setMethod] = useState(expense?.split_method ?? "equal");
  const [requestId] = useState(() => crypto.randomUUID());
  const selected = expense
    ? data.shares
        .filter((s) => s.expense_id === expense.id)
        .map((s) => s.member_id)
    : data.members.map((m) => m.user_id);
  return (
    <ActionForm
      action={saveExpense}
      label={expense && !repeat ? "Guardar cambios" : "Guardar gasto"}
      onSuccess={done}
    >
      <HiddenTrip id={data.trip.id} />
      <input type="hidden" name="request_id" value={requestId} />
      <input
        type="hidden"
        name="id"
        value={!repeat ? (expense?.id ?? "") : ""}
      />
      {!expense && (
        <div className="quick-expenses">
          {["Comida", "Transporte", "Alojamiento", "Actividades"].map((c) => (
            <button
              type="button"
              className="button secondary small"
              key={c}
              onClick={() => {
                setCategory(c);
                setDescription(c);
              }}
            >
              {c}
            </button>
          ))}
        </div>
      )}
      {expense && !repeat && (expense.paid_original_minor ?? 0) > 0 && (
        <p className="field-help">
          Este gasto tiene pagos registrados. Podés editar descripción, reparto
          y total, pero no cambiar su moneda, cotización base ni pagador
          original. Los pagos se corrigen desde sus detalles.
        </p>
      )}
      {repeat && (
        <p className="notice">
          Nueva compra basada en otra. Revisá importe, participantes y
          cotización. No se copian pagos ni comprobantes.
        </p>
      )}
      <label>
        Descripción
        <input
          name="description"
          required
          maxLength={160}
          placeholder="¿En qué gastaron?"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </label>
      <div className="form-grid">
        <label>
          Categoría
          <select
            name="category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label>
          Estado
          <select
            name="status"
            defaultValue={repeat ? "paid" : (expense?.status ?? "paid")}
          >
            <option value="paid">Pagado</option>
            <option value="reserved">Reservado · pendiente de pago</option>
            <option value="estimated">Estimado · sin compromiso</option>
          </select>
        </label>
      </div>
      <MoneyFields
        expense={
          expense
            ? { ...expense, rate_date: repeat ? today() : expense.rate_date }
            : undefined
        }
        reviewRate={repeat}
      />
      <div className="form-grid">
        <label>
          Fecha del gasto / reserva
          <input
            type="date"
            name="occurred_on"
            required
            defaultValue={repeat ? today() : (expense?.occurred_on ?? today())}
          />
        </label>
        <label>
          Quién pagó / pagará
          <select
            name="payer_id"
            defaultValue={expense?.payer_id ?? data.userId}
          >
            {data.members.map((m) => (
              <option key={m.user_id} value={m.user_id}>
                {m.display_name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label>
        Cómo dividir
        <select
          name="split_method"
          value={method}
          onChange={(e) => setMethod(e.target.value as typeof method)}
        >
          <option value="equal">Partes iguales</option>
          <option value="amount">Importes exactos</option>
          <option value="percent">Porcentajes</option>
        </select>
      </label>
      <div className="field-label">
        {method === "equal"
          ? "Dividir en partes iguales entre"
          : "Participantes del gasto"}
      </div>
      <div className="member-checks">
        {data.members.map((m) => (
          <label key={m.user_id}>
            <input
              type="checkbox"
              name="members"
              value={m.user_id}
              defaultChecked={selected.includes(m.user_id)}
            />
            <span className="avatar tiny">
              {m.display_name.slice(0, 1).toUpperCase()}
            </span>
            {m.display_name}
          </label>
        ))}
      </div>
      {method !== "equal" && (
        <>
          <p className="field-help">
            {method === "amount"
              ? "Los importes deben sumar el total original en la moneda del gasto."
              : "Los porcentajes deben sumar 100%. Admiten dos decimales."}{" "}
            Solo se toman los integrantes seleccionados arriba.
          </p>
          <div className="form-grid">
            {data.members.map((m) => (
              <label key={m.user_id}>
                {m.display_name} ·{" "}
                {method === "percent" ? "%" : "importe original"}
                <input
                  key={method}
                  name={"share_" + m.user_id}
                  inputMode="decimal"
                  defaultValue={
                    expense?.split_method === method
                      ? decimalAmount(
                          data.shares.find(
                            (s) =>
                              s.expense_id === expense.id &&
                              s.member_id === m.user_id,
                          )?.weight ?? 0,
                        )
                      : "0"
                  }
                />
              </label>
            ))}
          </div>
        </>
      )}
      <p className="field-help">
        Los centavos se distribuyen conservando el total exacto. Solo los pagos
        generan deudas; una reserva permite registrar anticipos desde sus
        detalles.
      </p>
      <label>
        Notas
        <textarea
          name="notes"
          maxLength={2000}
          defaultValue={expense?.notes}
          placeholder="Detalles, referencia de reserva…"
        />
      </label>
    </ActionForm>
  );
}
export function SettlementForm({
  data,
  done,
}: {
  data: HQData;
  done: () => void;
}) {
  const [requestId] = useState(() => crypto.randomUUID());
  return (
    <ActionForm
      action={saveSettlement}
      label="Registrar transferencia"
      onSuccess={done}
    >
      <HiddenTrip id={data.trip.id} />
      <input type="hidden" name="request_id" value={requestId} />
      <div className="notice">
        Registrá dinero que ya se transfirió entre amigos. No es un nuevo gasto
        ni una instrucción bancaria.
      </div>
      <div className="form-grid">
        <label>
          Quién envió
          <select name="from_id" defaultValue={data.userId}>
            {data.members.map((m) => (
              <option key={m.user_id} value={m.user_id}>
                {m.display_name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Quién recibió
          <select
            name="to_id"
            defaultValue={
              data.members.find((m) => m.user_id !== data.userId)?.user_id
            }
          >
            {data.members.map((m) => (
              <option key={m.user_id} value={m.user_id}>
                {m.display_name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <MoneyFields />
      <label>
        Fecha de transferencia
        <input type="date" name="occurred_on" required defaultValue={today()} />
      </label>
      <label>
        Referencia / notas
        <textarea name="notes" maxLength={2000} />
      </label>
    </ActionForm>
  );
}
export function EventForm({
  data,
  event,
  done,
}: {
  data: HQData;
  event?: Event;
  done: () => void;
}) {
  return (
    <ActionForm
      action={saveEvent}
      label="Guardar en itinerario"
      onSuccess={done}
    >
      <HiddenTrip id={data.trip.id} />
      <input type="hidden" name="id" value={event?.id ?? ""} />
      <label>
        Título
        <input
          name="title"
          required
          maxLength={160}
          defaultValue={event?.title}
          placeholder="Hotel, tren, museo…"
        />
      </label>
      <div className="form-grid">
        <label>
          Ciudad / destino
          <input
            name="city"
            required
            maxLength={100}
            list="cities"
            defaultValue={event?.city}
          />
          <datalist id="cities">
            {[...new Set(data.trip.route_stops)].map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </label>
        <label>
          Tipo
          <select name="kind" defaultValue={event?.kind ?? "stay"}>
            <option value="stay">Alojamiento</option>
            <option value="transport">Transporte</option>
            <option value="activity">Actividad</option>
          </select>
        </label>
      </div>
      <div className="form-grid">
        <label>
          Desde
          <input
            name="starts_on"
            type="date"
            required
            defaultValue={event?.starts_on ?? data.trip.starts_on}
          />
        </label>
        <label>
          Hasta
          <input
            name="ends_on"
            type="date"
            required
            defaultValue={event?.ends_on ?? data.trip.starts_on}
          />
        </label>
      </div>
      <label>
        Lugar o dirección
        <input
          name="location"
          maxLength={300}
          defaultValue={event?.location}
          placeholder="Museo, hotel, estación o dirección exacta"
        />
      </label>
      <div className="form-grid">
        <label>
          Hora de inicio
          <input
            name="start_time"
            type="time"
            defaultValue={event?.start_time?.slice(0, 5)}
          />
        </label>
        <label>
          Hora de fin
          <input
            name="end_time"
            type="time"
            defaultValue={event?.end_time?.slice(0, 5)}
          />
        </label>
      </div>
      <label>
        Zona horaria del destino
        <select
          name="time_zone"
          defaultValue={event?.time_zone ?? "Europe/Madrid"}
        >
          {eventZones.map((zone) => (
            <option key={zone} value={zone}>
              {zone.replace("Europe/", "")}
            </option>
          ))}
        </select>
      </label>
      <p className="field-help">
        Dejá ambas horas vacías para todo el día. Para una visita con turno,
        indicá las horas locales y la zona del destino.
      </p>
      <label>
        Vincular gasto / reserva
        <select name="expense_id" defaultValue={event?.expense_id ?? ""}>
          <option value="">Sin gasto vinculado</option>
          {data.expenses.map((e) => (
            <option key={e.id} value={e.id}>
              {e.description} · {formatMoney(e.eur_minor)}
            </option>
          ))}
        </select>
      </label>
      <p className="field-help">
        Vincular un gasto no lo duplica. Su estado de pago y sus comprobantes se
        administran en Gastos.
      </p>
      <label>
        Reserva, dirección y notas
        <textarea name="notes" maxLength={2000} defaultValue={event?.notes} />
      </label>
    </ActionForm>
  );
}
export function ScenarioForm({
  data,
  done,
}: {
  data: HQData;
  done: () => void;
}) {
  return (
    <ActionForm action={saveScenario} label="Crear escenario" onSuccess={done}>
      <HiddenTrip id={data.trip.id} />
      <label>
        Nombre de la alternativa
        <input
          name="name"
          required
          maxLength={100}
          placeholder="¿Qué alternativa quieren comparar?"
        />
      </label>
      <label>
        Alcance y notas
        <textarea
          name="notes"
          maxLength={2000}
          placeholder="Compará los mismos conceptos en cada escenario."
        />
      </label>
    </ActionForm>
  );
}
export function ScenarioItemForm({
  data,
  scenario,
  done,
}: {
  data: HQData;
  scenario: Scenario;
  done: () => void;
}) {
  return (
    <ActionForm
      action={saveScenarioItem}
      label="Agregar precio"
      onSuccess={done}
    >
      <HiddenTrip id={data.trip.id} />
      <input type="hidden" name="scenario_id" value={scenario.id} />
      <label>
        Concepto
        <input name="description" required maxLength={160} />
      </label>
      <MoneyFields />
      <label>
        Calidad del precio
        <select name="confidence">
          <option value="estimated">Estimado por el grupo</option>
          <option value="quoted">Cotizado por un proveedor</option>
          <option value="confirmed">Confirmado</option>
        </select>
      </label>
      <label>
        Fuente / referencia de la cotización
        <textarea
          name="source"
          maxLength={1000}
          placeholder="Obligatoria para precios cotizados o confirmados."
        />
      </label>
      <p className="field-help">
        El importe corresponde al concepto completo para el grupo, sin
        multiplicarlo por viajeros. Este precio no se agrega al presupuesto
        consumido.
      </p>
    </ActionForm>
  );
}
export function SettingsForm({ data }: { data: HQData }) {
  return (
    <ActionForm action={saveTrip} label="Guardar configuración">
      <HiddenTrip id={data.trip.id} />
      <label>
        Nombre del viaje
        <input
          name="name"
          required
          maxLength={100}
          defaultValue={data.trip.name}
        />
      </label>
      <label>
        Presupuesto total del grupo · EUR
        <input
          name="budget"
          inputMode="decimal"
          defaultValue={decimalAmount(data.trip.budget_minor)}
          required
        />
      </label>
      <p className="field-help">
        Se divide entre los cuatro viajeros previstos. El presupuesto de cada
        gasto se distribuye solo entre sus participantes.
      </p>
      <div className="form-grid">
        <label>
          Inicio
          <input
            type="date"
            name="starts_on"
            defaultValue={data.trip.starts_on}
            required
          />
        </label>
        <label>
          Fin
          <input
            type="date"
            name="ends_on"
            defaultValue={data.trip.ends_on}
            required
          />
        </label>
      </div>
      <label>
        Recorrido · una parada por línea
        <textarea
          rows={9}
          name="route_stops"
          required
          defaultValue={data.trip.route_stops.join("\n")}
        />
      </label>
    </ActionForm>
  );
}
export function InviteForm({ data }: { data: HQData }) {
  const [code, setCode] = useState(""),
    [copied, setCopied] = useState(false);
  const full = data.members.length + data.invitations.length >= 4;
  return (
    <>
      {code && (
        <div className="invitation-result" role="status">
          <strong>Invitación lista para compartir</strong>
          <p>
            Copiá el código y compartilo en privado con ese amigo. Vence en 7
            días.
          </p>
          <label>
            Código privado de invitación
            <input
              readOnly
              value={code}
              onFocus={(event) => event.target.select()}
            />
          </label>
          <button
            type="button"
            className="button secondary"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(code);
                setCopied(true);
              } catch {
                setCopied(false);
              }
            }}
          >
            {copied ? "Código copiado" : "Copiar código"}
          </button>
          <p className="field-help">
            Se muestra solo ahora. Si lo perdés, revocá la invitación y generá
            otra.
          </p>
        </div>
      )}
      {full ? (
        <div className="notice">
          Los cuatro lugares están ocupados o reservados. Revocá una invitación
          pendiente para liberar su lugar.
        </div>
      ) : (
        <ActionForm
          action={inviteMember}
          label="Generar invitación"
          onSuccess={(result) => {
            setCode(result.invitationCode ?? "");
            setCopied(false);
          }}
        >
          <HiddenTrip id={data.trip.id} />
          <label>
            Correo del integrante
            <input
              name="email"
              type="email"
              required
              placeholder="amigo@ejemplo.com"
            />
          </label>
          <p className="field-help">
            No se envían correos. Tu amigo crea su cuenta con ese correo y pega
            el código que le compartís.
          </p>
        </ActionForm>
      )}
    </>
  );
}
export function ReceiptForm({
  data,
  expense,
  done,
}: {
  data: HQData;
  expense: Expense;
  done: () => void;
}) {
  return (
    <ReceiptUploader
      trip={data.trip.id}
      expense={expense.id}
      description={expense.description}
      done={done}
    />
  );
}

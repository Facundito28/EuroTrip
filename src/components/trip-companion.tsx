"use client";
import { useState, useSyncExternalStore } from "react";
import type {
  HQData,
  TripTask,
  TripBooking,
  Event,
  Expense,
  PersonalExpense,
} from "@/lib/types";
import {
  saveTripTask,
  changeTripTask,
  saveTripBooking,
  deleteTripBooking,
} from "@/lib/actions";
import { ActionForm, HiddenTrip } from "./action-form";
import { TripMap } from "./trip-map";
import { TripOverview } from "./trip-overview";
import { formatMoney } from "@/lib/money";
import { eventZones, mapUrl } from "@/lib/agenda";
import { staysForNight, timedPlans } from "@/lib/companion";
const subscribe = () => () => {};
const labelKind = {
  stay: "Alojamiento",
  transport: "Transporte",
  activity: "Actividad",
};
export function TripChecklist({ data }: { data: HQData }) {
  const [edit, setEdit] = useState<TripTask | null>(null),
    [adding, setAdding] = useState(false),
    [filter, setFilter] = useState("pending");
  const tasks = data.tasks ?? [],
    completed = tasks.filter((t) => t.done).length;
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h2>Checklist del viaje</h2>
          <p>
            {completed} de {tasks.length} tareas completas · compartida con el
            grupo
          </p>
        </div>
        <button
          className="button primary"
          onClick={() => {
            setEdit(null);
            setAdding(true);
          }}
        >
          Agregar tarea
        </button>
      </div>
      <progress
        className="task-progress"
        max={tasks.length || 1}
        value={completed}
        aria-label="Progreso de la checklist"
      />
      {(adding || edit) && (
        <div className="companion-editor">
          <h3>{edit ? "Editar tarea" : "Nueva tarea"}</h3>
          <ActionForm
            key={edit?.id ?? "new"}
            action={saveTripTask}
            label="Guardar tarea"
            onSuccess={() => {
              setEdit(null);
              setAdding(false);
            }}
          >
            <HiddenTrip id={data.trip.id} />
            <input type="hidden" name="id" value={edit?.id ?? ""} />
            <label>
              Tarea
              <input
                name="title"
                required
                maxLength={160}
                defaultValue={edit?.title}
                placeholder="Hacer check-in del vuelo…"
              />
            </label>
            <div className="form-grid">
              <label>
                Categoría de tarea
                <select
                  name="category"
                  defaultValue={edit?.category ?? "Reservas"}
                >
                  {["Documentación", "Equipaje", "Reservas", "Otros"].map(
                    (c) => (
                      <option key={c}>{c}</option>
                    ),
                  )}
                </select>
              </label>
              <label>
                Responsable
                <select
                  name="assignee_id"
                  defaultValue={edit?.assignee_id ?? ""}
                >
                  <option value="">Sin asignar</option>
                  {data.members.map((m) => (
                    <option key={m.user_id} value={m.user_id}>
                      {m.display_name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              Vencimiento de tarea
              <input
                type="date"
                name="due_on"
                defaultValue={edit?.due_on ?? ""}
              />
            </label>
            <label>
              Notas de tarea
              <textarea
                name="notes"
                maxLength={2000}
                defaultValue={edit?.notes}
              />
            </label>
          </ActionForm>
          <button
            className="text-button"
            onClick={() => {
              setEdit(null);
              setAdding(false);
            }}
          >
            Cancelar edición
          </button>
        </div>
      )}
      <label>
        Mostrar tareas
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="pending">Pendientes</option>
          <option value="mine">Mis pendientes</option>
          <option value="all">Todas</option>
          <option value="done">Completas</option>
        </select>
      </label>
      <ul className="companion-list">
        {tasks
          .filter(
            (t) =>
              filter === "all" ||
              (filter === "done" && t.done) ||
              (!t.done &&
                (filter === "pending" ||
                  (filter === "mine" && t.assignee_id === data.userId))),
          )
          .map((t) => (
            <li key={t.id}>
              <div>
                <h3 className={t.done ? "task-done" : ""}>{t.title}</h3>
                <p>
                  {t.category} ·{" "}
                  {data.members.find((m) => m.user_id === t.assignee_id)
                    ?.display_name ?? "Sin asignar"}
                  {t.due_on && ` · Límite ${t.due_on}`}
                </p>
                {t.notes && <p className="preserve">{t.notes}</p>}
              </div>
              <div className="row-actions">
                <ActionForm
                  action={changeTripTask}
                  label={t.done ? "Volver a pendiente" : "Completar"}
                  className="inline-action"
                >
                  <HiddenTrip id={data.trip.id} />
                  <input type="hidden" name="id" value={t.id} />
                  <input
                    type="hidden"
                    name="done"
                    value={t.done ? "no" : "yes"}
                  />
                </ActionForm>
                <button
                  className="button secondary small"
                  onClick={() => {
                    setEdit(t);
                    setAdding(false);
                  }}
                >
                  Editar tarea
                </button>
                <ActionForm
                  action={changeTripTask}
                  label="Eliminar tarea"
                  className="inline-action"
                  confirm="¿Eliminar esta tarea de la checklist compartida?"
                >
                  <HiddenTrip id={data.trip.id} />
                  <input type="hidden" name="id" value={t.id} />
                  <input type="hidden" name="operation" value="delete" />
                </ActionForm>
              </div>
            </li>
          ))}
      </ul>
      {!tasks.length && (
        <p className="notice">
          Todavía no hay tareas. Agreguen lo que realmente necesitan preparar;
          no cargamos listas ficticias.
        </p>
      )}
    </section>
  );
}
export function TripBookings({ data }: { data: HQData }) {
  const [edit, setEdit] = useState<TripBooking | null>(null),
    [adding, setAdding] = useState(false),
    [search, setSearch] = useState("");
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h2>Reservas a mano</h2>
          <p>
            Referencias, direcciones y comprobantes compartidos con el grupo.
          </p>
        </div>
        <button
          className="button primary"
          onClick={() => {
            setEdit(null);
            setAdding(true);
          }}
        >
          Agregar reserva
        </button>
      </div>
      {(adding || edit) && (
        <div className="companion-editor">
          <h3>{edit ? "Editar reserva" : "Nueva reserva"}</h3>
          <ActionForm
            key={edit?.id ?? "new"}
            action={saveTripBooking}
            label="Guardar reserva"
            onSuccess={() => {
              setAdding(false);
              setEdit(null);
            }}
          >
            <HiddenTrip id={data.trip.id} />
            <input type="hidden" name="id" value={edit?.id ?? ""} />
            <label>
              Nombre de la reserva
              <input
                name="title"
                required
                maxLength={160}
                defaultValue={edit?.title}
                placeholder="Vuelo a Londres, hotel en París…"
              />
            </label>
            <div className="form-grid">
              <label>
                Tipo de reserva
                <select name="kind" defaultValue={edit?.kind ?? "stay"}>
                  {Object.entries(labelKind).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Ciudad de la reserva
                <input name="city" maxLength={100} defaultValue={edit?.city} />
              </label>
              <label>
                Inicio de reserva
                <input
                  type="date"
                  name="starts_on"
                  required
                  defaultValue={edit?.starts_on ?? data.trip.starts_on}
                />
              </label>
              <label>
                Fin de reserva
                <input
                  type="date"
                  name="ends_on"
                  required
                  defaultValue={edit?.ends_on ?? data.trip.starts_on}
                />
              </label>
            </div>
            <label>
              Dirección o punto de encuentro
              <input
                name="location"
                maxLength={300}
                defaultValue={edit?.location}
              />
            </label>
            <label>
              Número o código de reserva
              <input
                name="reference"
                maxLength={160}
                autoComplete="off"
                defaultValue={edit?.reference}
              />
            </label>
            <label>
              Enlace de la reserva
              <input
                type="url"
                name="url"
                placeholder="https://…"
                maxLength={2000}
                defaultValue={edit?.url}
              />
            </label>
            <label>
              Gasto ya registrado
              <select name="expense_id" defaultValue={edit?.expense_id ?? ""}>
                <option value="">Sin vincular</option>
                {data.expenses.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.description} · {formatMoney(e.amount_minor, e.currency)}
                  </option>
                ))}
              </select>
            </label>
            <p className="field-help">
              Vincular no crea ni modifica gastos. Los pagos se registran en
              Gastos. Los comprobantes se adjuntan al gasto vinculado.
            </p>
            <label>
              Notas de la reserva
              <textarea
                name="notes"
                maxLength={2000}
                defaultValue={edit?.notes}
              />
            </label>
          </ActionForm>
          <button
            className="text-button"
            onClick={() => {
              setEdit(null);
              setAdding(false);
            }}
          >
            Cancelar edición
          </button>
        </div>
      )}
      <label>
        Buscar reservas
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Ciudad, referencia o nombre…"
        />
      </label>
      <ul className="companion-list">
        {(data.bookings ?? [])
          .filter((b) =>
            `${b.title} ${b.city} ${b.reference}`
              .toLocaleLowerCase("es")
              .includes(search.toLocaleLowerCase("es")),
          )
          .map((b) => (
            <li key={b.id}>
              <div>
                <span className="pill">{labelKind[b.kind]}</span>
                <h3>{b.title}</h3>
                <p>
                  {b.city} · {b.starts_on} → {b.ends_on}
                </p>
                {b.reference && (
                  <p>
                    Referencia:{" "}
                    <strong className="preserve">{b.reference}</strong>
                  </p>
                )}
                {b.location && <p>{b.location}</p>}
                {b.notes && <p className="preserve">{b.notes}</p>}
                <div className="row-actions">
                  {b.location && (
                    <a
                      className="button secondary small"
                      href={mapUrl(`${b.location}, ${b.city}`)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Abrir dirección
                    </a>
                  )}
                  {b.url && (
                    <a
                      className="button secondary small"
                      href={b.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Abrir reserva
                    </a>
                  )}
                  {data.receipts
                    .filter((r) => r.expense_id === b.expense_id)
                    .map((r) => (
                      <a
                        className="button secondary small"
                        key={r.id}
                        href={`/receipts/${r.id}`}
                      >
                        {r.filename}
                      </a>
                    ))}
                </div>
                {b.expense_id && (
                  <small>
                    {data.expenses.find((e) => e.id === b.expense_id)
                      ?.description ?? "Gasto vinculado en papelera"}
                  </small>
                )}
              </div>
              <div className="row-actions">
                <button
                  className="button secondary small"
                  onClick={() => {
                    setEdit(b);
                    setAdding(false);
                  }}
                >
                  Editar reserva
                </button>
                <ActionForm
                  action={deleteTripBooking}
                  label="Eliminar reserva"
                  className="inline-action"
                  confirm="¿Eliminar esta reserva? El gasto vinculado se conserva."
                >
                  <HiddenTrip id={data.trip.id} />
                  <input type="hidden" name="id" value={b.id} />
                </ActionForm>
              </div>
            </li>
          ))}
      </ul>
      {!(data.bookings ?? []).length && (
        <p className="notice">
          Guardá los datos de sus reservas reales. Para programar horarios y
          exportar al calendario, usá Itinerario. Una reserva aquí no agrega un
          evento automáticamente.
        </p>
      )}
    </section>
  );
}
export function TripToday({
  data,
  onExpense,
  onEvent,
  onNavigate,
  onOpenCost,
}: {
  data: HQData;
  onExpense: () => void;
  onOpenCost: (expense: Expense | PersonalExpense, personal: boolean) => void;
  onEvent: (e: Event) => void;
  onNavigate: (tab: "itinerary" | "bookings" | "checklist") => void;
}) {
  const [zone, setZone] = useState("Europe/Madrid"),
    [chosen, setChosen] = useState("");
  const today = useSyncExternalStore(
    subscribe,
    () =>
      new Intl.DateTimeFormat("en-CA", {
        timeZone: zone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date()),
    () => "",
  );
  const day = chosen || today;
  const events = data.events
    .filter((e) => e.starts_on <= day && e.ends_on >= day)
    .sort((a, b) =>
      `${a.starts_on} ${a.start_time ?? "00:00"}`.localeCompare(
        `${b.starts_on} ${b.start_time ?? "00:00"}`,
      ),
    );
  const stays = staysForNight(data.bookings ?? [], day);
  const now = useSyncExternalStore(
    subscribe,
    () => new Date().toISOString().replace(/[-:]/g, "").slice(0, 13) + "00Z",
    () => "",
  );
  const next = timedPlans(data.events, day, now)[0];
  const eventStays = events.filter(
    (e) => e.kind === "stay" && (e.ends_on > day || e.starts_on === e.ends_on),
  );
  const pending = (data.tasks ?? []).filter(
    (t) => !t.done && (!t.assignee_id || t.assignee_id === data.userId),
  );
  const [map, setMap] = useState(false);
  return (
    <div className="companion-view">
      <section className="panel today-hero">
        <span className="eyebrow">EL VIAJE, A MANO</span>
        <h2>Hoy en Europa</h2>
        <p>
          Planes y alojamiento según la fecha que elijas. Los horarios de cada
          plan corresponden a su destino.
        </p>
        <div className="form-grid">
          <label>
            Día del viaje
            <input
              type="date"
              value={day}
              onChange={(e) => setChosen(e.target.value)}
            />
          </label>
          <label>
            Zona para la fecha actual
            <select value={zone} onChange={(e) => setZone(e.target.value)}>
              {eventZones.map((z) => (
                <option key={z}>{z}</option>
              ))}
            </select>
          </label>
        </div>
        {day && day < data.trip.starts_on && (
          <p className="notice">
            Todavía falta para salir. Elegí una fecha del viaje para revisar sus
            planes.
          </p>
        )}
        <div className="today-shortcuts">
          <button className="button primary" onClick={onExpense}>
            Cargar gasto
          </button>
          <button
            className="button secondary"
            onClick={() => onNavigate("itinerary")}
          >
            Ver planes
          </button>
          <button
            className="button secondary"
            onClick={() => onNavigate("bookings")}
          >
            Reservas del grupo
          </button>
          <button
            className="button secondary"
            onClick={() => setMap(!map)}
            aria-expanded={map}
          >
            Mapa del día
          </button>
        </div>
      </section>
      {map && (
        <section className="panel">
          <h2>Mapa del día</h2>
          <TripMap
            initialQuery={stays[0]?.location || events[0]?.location || ""}
          />
        </section>
      )}
      {next && (
        <section className="panel">
          <span className="eyebrow">PRÓXIMO PLAN CON HORARIO</span>
          <h2>{next.title}</h2>
          <p>
            {next.start_time?.slice(0, 5)} · {next.city} · {next.time_zone}
          </p>
          <button className="button secondary" onClick={() => onEvent(next)}>
            Ver próximo plan
          </button>
        </section>
      )}
      <div className="dashboard-columns">
        <section className="panel">
          <h2>Dónde dormimos</h2>
          {stays.map((b) => (
            <article className="today-item" key={b.id}>
              <h3>{b.title}</h3>
              <p>
                {b.city} · {b.location || "Dirección por completar"}
              </p>
              {b.reference && <p>Reserva: {b.reference}</p>}
              <button
                className="text-button"
                onClick={() => onNavigate("bookings")}
              >
                Ver reserva y comprobantes
              </button>
            </article>
          ))}
          {!stays.length &&
            eventStays.map((e) => (
              <article className="today-item" key={e.id}>
                <h3>{e.title}</h3>
                <p>
                  {e.city} · {e.location}
                </p>
                <button className="text-button" onClick={() => onEvent(e)}>
                  Ver alojamiento del itinerario
                </button>
              </article>
            ))}
          {!stays.length && !eventStays.length && (
            <p className="notice">
              Sin alojamiento cargado para esta noche. El día de salida de una
              reserva no cuenta como otra noche.
            </p>
          )}
        </section>
        <section className="panel">
          <h2>Planes del día</h2>
          {events
            .filter((e) => e.kind !== "stay")
            .map((e) => (
              <button
                className="today-plan"
                key={e.id}
                onClick={() => onEvent(e)}
              >
                <span className="pill">
                  {e.start_time?.slice(0, 5) ?? "Todo el día"}
                </span>
                <span>
                  <strong>{e.title}</strong>
                  <small>
                    {e.city} · {e.time_zone}
                  </small>
                </span>
              </button>
            ))}
          {!events.some((e) => e.kind !== "stay") && (
            <p className="notice">
              Día libre por ahora. Agregá sus planes en Itinerario.
            </p>
          )}
        </section>
      </div>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Por resolver</h2>
            <p>{pending.length} tareas pendientes tuyas o sin asignar.</p>
          </div>
          <button
            className="button secondary"
            onClick={() => onNavigate("checklist")}
          >
            Abrir checklist
          </button>
        </div>
        {pending.slice(0, 3).map((t) => (
          <p key={t.id}>
            {t.title}
            {t.due_on ? ` · ${t.due_on}` : ""}
          </p>
        ))}
      </section>
      <TripOverview data={data} selectedDay={day} onOpen={onOpenCost} />
      <p className="field-help">
        Los datos privados requieren conexión. Esta etapa no descarga reservas
        ni documentos al dispositivo.
      </p>
    </div>
  );
}

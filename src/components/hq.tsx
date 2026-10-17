"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  LayoutDashboard,
  Wallet,
  ArrowLeftRight,
  CalendarDays,
  GitCompareArrows,
  Users,
  Settings2,
  Compass,
  Plus,
  ArrowUpRight,
  ArrowRight,
  Download,
  Check,
  MapPin,
  ArrowDownLeft,
  CreditCard,
  ReceiptText,
  Pencil,
  X,
  Paperclip,
  ChevronRight,
  LogOut,
  Menu,
  CircleHelp,
  Plane,
  RefreshCw,
  History,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  balances,
  suggestedTransfers,
  totals,
  paidAmount,
  remainingAmount,
  remainingOriginal,
} from "@/lib/finance";
import { formatMoney, splitEqual } from "@/lib/money";
import {
  categories,
  type HQData,
  type Expense,
  type Event,
  type Scenario,
  type PersonalExpense,
} from "@/lib/types";
import { deleteExpense, deleteRecord, logout, markPaid } from "@/lib/actions";
import { ActionForm, HiddenTrip } from "./action-form";
import {
  SettlementForm,
  EventForm,
  ScenarioForm,
  ScenarioItemForm,
  SettingsForm,
  InviteForm,
  ReceiptForm,
} from "./forms";
import { ChangePasswordForm, JoinForm } from "./password-forms";
import { TripCalendar } from "./calendar";
import {
  ExpenseEntry,
  PersonalExpenseForm,
  PrivateExpenses,
} from "./private-expenses";
import { ExpensePayments } from "./expense-payments";
import { ActivityFeed } from "./activity";
import { useSwipeMenu } from "./use-swipe-menu";
import { MemberName } from "./member-name";
import { TripMap } from "./trip-map";
import { googleCalendarUrl } from "@/lib/agenda";
import { TripOverview, TrashPanel } from "./trip-overview";
import { RecoveryCodes } from "./recovery";
import { PersonalBudget } from "./personal-budget";
import { InstallButton } from "./pwa";
const tabs = [
  ["dashboard", "Vue d’ensemble", LayoutDashboard],
  ["expenses", "Gastos", Wallet],
  ["personal", "Mis gastos", Wallet],
  ["balances", "Saldos", ArrowLeftRight],
  ["itinerary", "Itinerario", CalendarDays],
  ["scenarios", "Escenarios", GitCompareArrows],
  ["team", "Equipo", Users],
  ["activity", "Actividad", History],
  ["settings", "Configuración", Settings2],
] as const;
type Tab = (typeof tabs)[number][0];
type Modal =
  | { kind: "personal"; expense?: PersonalExpense }
  | { kind: "expense"; expense?: Expense; repeat?: boolean; preset?: string }
  | { kind: "event"; event?: Event }
  | { kind: "settlement" }
  | { kind: "scenario" }
  | { kind: "item"; scenario: Scenario }
  | { kind: "receipt"; expense: Expense };
const statusNames = {
  paid: "Pagado",
  reserved: "Reservado",
  estimated: "Estimado",
};
const dateLabel = (date: string) =>
  new Intl.DateTimeFormat("es-AR", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
function Empty({
  icon,
  title,
  children,
  action,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">{icon}</span>
      <h3>{title}</h3>
      <p>{children}</p>
      {action}
    </div>
  );
}
function ModalWindow({
  title,
  children,
  close,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    el?.showModal();
    return () => el?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      onCancel={close}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="modal-head">
        <div>
          <span className="eyebrow">TRAVEL HQ</span>
          <h2>{title}</h2>
        </div>
        <button
          className="icon-button"
          aria-label="Cerrar ventana"
          onClick={close}
        >
          <X />
        </button>
      </div>
      {children}
    </dialog>
  );
}
function DeleteButton({
  id,
  trip,
  table,
  label = "Eliminar",
}: {
  id: string;
  trip: string;
  table: string;
  label?: string;
}) {
  return (
    <ActionForm
      action={deleteRecord}
      label={label}
      className="inline-action danger-action"
      confirm="¿Eliminar este registro? Esta acción no se puede deshacer."
    >
      <HiddenTrip id={trip} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="table" value={table} />
    </ActionForm>
  );
}
export function HQ({ data }: { data: HQData }) {
  const [tab, setTab] = useState<Tab>("dashboard"),
    [modal, setModal] = useState<Modal | null>(null),
    [menu, setMenu] = useState(false),
    [search, setSearch] = useState(""),
    [status, setStatus] = useState("all"),
    [online, setOnline] = useState(true);
  const router = useRouter();
  const swipe = useSwipeMenu(menu, !modal, setMenu);
  useEffect(() => {
    const refresh = () => {
      if (navigator.onLine && document.visibilityState === "visible")
        router.refresh();
    };
    const interval = window.setInterval(refresh, 45000);
    window.addEventListener("focus", refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
    };
  }, [router]);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  const financial = totals(data.expenses, data.trip.budget_minor),
    net = balances(
      data.members,
      data.expenses,
      data.shares,
      data.settlements,
      data.payments,
    ),
    transfers = suggestedTransfers(net);
  const name = (id: string) =>
    data.members.find((m) => m.user_id === id)?.display_name ?? "Integrante";
  const owner = data.trip.owner_id === data.userId;
  const budgetParts = splitEqual(data.trip.budget_minor, ["1", "2", "3", "4"]);
  const me = data.members.find((m) => m.user_id === data.userId);
  const filtered = data.expenses.filter(
    (e) =>
      (status === "all" || e.status === status) &&
      `${e.description} ${e.category} ${name(e.payer_id)}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const navigate = (next: Tab) => {
    setTab(next);
    setMenu(false);
  };
  const addExpense = (
    <button
      className="button primary"
      onClick={() => setModal({ kind: "expense" })}
    >
      <Plus size={18} />
      Cargar gasto
    </button>
  );
  const close = () => setModal(null);
  const days =
    Math.round(
      (Date.parse(data.trip.ends_on) - Date.parse(data.trip.starts_on)) /
        86400000,
    ) + 1;
  const totalCategory = categories.map((category) => ({
    category,
    total: data.expenses
      .filter((e) => e.category === category)
      .reduce((sum, e) => sum + paidAmount(e), 0),
  }));
  const progress = data.trip.budget_minor
    ? Math.min(
        100,
        ((financial.paid + financial.reserved) / data.trip.budget_minor) * 100,
      )
    : 0;
  const modalTitle = modal
    ? {
        expense:
          modal.kind === "expense" && modal.expense && !modal.repeat
            ? "Editar gasto"
            : "Nuevo gasto",
        personal: "Mi gasto privado",
        settlement: "Registrar transferencia",
        event:
          modal.kind === "event" && modal.event
            ? "Editar evento"
            : "Agregar al itinerario",
        scenario: "Nuevo escenario",
        item: "Agregar precio",
        receipt: "Subir comprobante",
      }[modal.kind]
    : "";
  return (
    <div className="app-shell" {...swipe}>
      {!menu && !modal && (
        <div className="menu-swipe-edge" aria-hidden="true" />
      )}
      <aside className={`sidebar ${menu ? "open" : ""}`}>
        <Link href="/" className="brand">
          <span className="brand-icon">
            <Compass />
          </span>
          <span>
            EUROTRIP <b>2027</b>
            <small>TRAVEL HQ</small>
          </span>
        </Link>
        <div className="workspace-tag">
          <span className="status-dot" />
          EUROPA · 4 VIAJEROS
          <ChevronRight size={14} />
        </div>
        <span className="nav-label">TU VIAJE, EN ORDEN</span>
        <nav aria-label="Navegación principal">
          {tabs.map(([id, label, Icon]) => (
            <button
              key={id}
              aria-label={id === "dashboard" ? "Resumen" : label}
              className={tab === id ? "active" : ""}
              aria-current={tab === id ? "page" : undefined}
              onClick={() => navigate(id)}
            >
              <Icon size={19} />
              {id === "dashboard" ? "Resumen" : label}
              {id === "expenses" && data.expenses.length > 0 && (
                <span className="nav-count">{data.expenses.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="trip-mini">
            <Plane size={20} />
            <div>
              Próxima parada: Europa
              <small>
                {dateLabel(data.trip.starts_on)} —{" "}
                {dateLabel(data.trip.ends_on)} 2027
              </small>
            </div>
          </div>
          <button className="profile" onClick={() => navigate("team")}>
            <span className="avatar">
              {me?.display_name.slice(0, 1).toUpperCase()}
            </span>
            <span>
              {me?.display_name}
              <small>{owner ? "Organizador" : "Viajero"}</small>
            </span>
            <ChevronRight size={16} />
          </button>
          <form action={logout}>
            <button className="button ghost small">
              <LogOut size={15} />
              Cerrar sesión
            </button>
          </form>
        </div>
      </aside>
      {menu && (
        <button
          className="menu-overlay"
          aria-label="Cerrar menú"
          onClick={() => setMenu(false)}
        />
      )}
      <div className="main-area">
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            aria-label="Abrir menú"
            onClick={() => setMenu(!menu)}
          >
            <Menu />
          </button>
          <div className="breadcrumb">
            Travel HQ <ChevronRight size={13} />
            <strong>
              {tab === "dashboard"
                ? "Resumen"
                : tabs.find((t) => t[0] === tab)?.[1]}
            </strong>
          </div>
          <div className="topbar-right">
            <span className={`live-label ${online ? "" : "offline"}`}>
              <span className="status-dot" />
              {online ? "Conectado" : "Sin conexión"}
            </span>
            <button
              className="icon-button"
              title="Actualizar datos"
              aria-label="Actualizar datos"
              onClick={() => router.refresh()}
            >
              <RefreshCw size={17} />
            </button>
            <div className="avatar-stack">
              {data.members.map((m) => (
                <span
                  className="avatar tiny"
                  title={m.display_name}
                  key={m.user_id}
                >
                  {m.display_name.slice(0, 1).toUpperCase()}
                </span>
              ))}
            </div>
          </div>
        </header>
        {!online && (
          <div role="status" className="offline-banner">
            Sin conexión. Los datos visibles pueden estar desactualizados.
            Conectate para guardar cambios.
          </div>
        )}
        <main className="page-content">
          <div className="page-heading">
            <div>
              <span className="eyebrow">
                EUROTRIP 2027 / {dateLabel(data.trip.starts_on).toUpperCase()} —{" "}
                {dateLabel(data.trip.ends_on).toUpperCase()}
              </span>
              <h1>
                {
                  {
                    dashboard: "Tu viaje, bajo control.",
                    expenses: "Cada gasto, en su lugar.",
                    personal: "Tus compras, solo para vos.",
                    balances: "Cuentas claras. Siempre.",
                    itinerary: "El plan es Europa.",
                    scenarios: "Elegir también es planear.",
                    team: "El mejor equipo de viaje.",
                    settings: "A tu manera.",
                    activity: "Lo que pasó en el viaje.",
                  }[tab]
                }
              </h1>
              <p>
                {
                  {
                    dashboard:
                      "Menos cuentas pendientes. Más momentos por vivir.",
                    expenses: "Gastos visibles para el grupo y sus repartos.",
                    personal:
                      "Gastos privados, sin deudas ni cambios en el presupuesto grupal.",
                    balances:
                      "Quién puso cuánto, quién debe y cómo ponerse al día.",
                    itinerary:
                      "Todas las paradas, reservas y actividades en un mismo lugar.",
                    scenarios:
                      "Compará alternativas con precios que vos registrás.",
                    team: "Un viaje privado, compartido entre cuatro.",
                    settings: "Presupuesto, fechas y recorrido de tu grupo.",
                    activity: "Quién registró o modificó cada movimiento.",
                  }[tab]
                }
              </p>
            </div>
            <div className="heading-actions">
              {tab === "expenses" && (
                <a
                  className="button secondary"
                  href={`/export?trip=${data.trip.id}`}
                >
                  <Download size={16} />
                  CSV
                </a>
              )}
              {["dashboard", "expenses"].includes(tab) && addExpense}
              {tab === "balances" && (
                <button
                  className="button primary"
                  onClick={() => setModal({ kind: "settlement" })}
                >
                  <Plus size={17} />
                  Transferencia
                </button>
              )}
              {tab === "itinerary" && (
                <button
                  className="button primary"
                  onClick={() => setModal({ kind: "event" })}
                >
                  <Plus size={17} />
                  Agregar evento
                </button>
              )}
              {tab === "scenarios" && (
                <button
                  className="button primary"
                  onClick={() => setModal({ kind: "scenario" })}
                >
                  <Plus size={17} />
                  Nuevo escenario
                </button>
              )}
            </div>
          </div>
          {tab === "dashboard" && (
            <>
              <section className="overview-grid">
                <div className="budget-card">
                  <div className="card-eyebrow">
                    <span>PRESUPUESTO DEL VIAJE</span>
                    <Wallet size={18} />
                  </div>
                  <div className="budget-value">
                    {data.trip.budget_minor
                      ? formatMoney(data.trip.budget_minor)
                      : "Por definir"}
                    <span>EUR · TOTAL DEL GRUPO</span>
                  </div>
                  <div className="budget-track">
                    <span style={{ width: `${progress}%` }} />
                  </div>
                  <div className="budget-foot">
                    <span>
                      {data.trip.budget_minor
                        ? `${progress.toFixed(1)}% pagado o comprometido`
                        : "Definí cuánto quieren invertir"}
                    </span>
                    <button
                      onClick={() => navigate("settings")}
                      aria-label="Configurar presupuesto"
                    >
                      <ArrowUpRight size={18} />
                    </button>
                  </div>
                </div>
                <div className="stat-card">
                  <span className="stat-icon teal">
                    <CreditCard size={19} />
                  </span>
                  <span className="stat-label">Gastos reales</span>
                  <strong>{formatMoney(financial.paid)}</strong>
                  <small>Solo pagos efectuados</small>
                </div>
                <div className="stat-card">
                  <span className="stat-icon amber">
                    <ReceiptText size={19} />
                  </span>
                  <span className="stat-label">Comprometido</span>
                  <strong>{formatMoney(financial.reserved)}</strong>
                  <small>Reservas pendientes de pago</small>
                </div>
                <div className="stat-card">
                  <span className="stat-icon purple">
                    <ArrowUpRight size={19} />
                  </span>
                  <span className="stat-label">Disponible</span>
                  <strong className={financial.available < 0 ? "negative" : ""}>
                    {data.trip.budget_minor
                      ? formatMoney(financial.available)
                      : "Sin presupuesto"}
                  </strong>
                  <small>Presupuesto − pagos − reservas</small>
                </div>
              </section>
              <section className="panel">
                <h2>Cargar en pocos toques</h2>
                <div className="quick-expenses">
                  {["Comida", "Transporte", "Alojamiento", "Actividades"].map(
                    (c) => (
                      <button
                        key={c}
                        className="button secondary small"
                        onClick={() => setModal({ kind: "expense", preset: c })}
                      >
                        <Plus size={16} />
                        {c}
                      </button>
                    ),
                  )}
                </div>
              </section>
              <TripOverview
                data={data}
                onOpen={(expense, personal) =>
                  setModal(
                    personal
                      ? {
                          kind: "personal",
                          expense: expense as PersonalExpense,
                        }
                      : { kind: "expense", expense: expense as Expense },
                  )
                }
              />
              <PersonalBudget
                data={data}
                onAddPersonal={() => setModal({ kind: "personal" })}
                onViewPersonal={() => navigate("personal")}
              />
              <div className="dashboard-columns">
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Una mirada al presupuesto</h2>
                      <p>Estimaciones separadas de tus compromisos</p>
                    </div>
                    <span className="pill">EUR</span>
                  </div>
                  <div className="budget-breakdown">
                    <div
                      className="budget-ring"
                      style={
                        { "--progress": `${progress}%` } as React.CSSProperties
                      }
                    >
                      <div>
                        <span>POR VIAJERO</span>
                        <strong>
                          {data.trip.budget_minor
                            ? formatMoney(budgetParts["1"])
                            : "—"}
                        </strong>
                        <small>
                          {data.trip.budget_minor % 4
                            ? "± 0,01 EUR por redondeo"
                            : "4 viajeros previstos"}
                        </small>
                      </div>
                    </div>
                    <div className="budget-legend">
                      <div>
                        <span className="legend-dot teal-bg" />
                        Pagado<strong>{formatMoney(financial.paid)}</strong>
                      </div>
                      <div>
                        <span className="legend-dot amber-bg" />
                        Reservado
                        <strong>{formatMoney(financial.reserved)}</strong>
                      </div>
                      <div>
                        <span className="legend-dot purple-bg" />
                        Estimado
                        <strong>{formatMoney(financial.estimated)}</strong>
                      </div>
                      <div className="legend-total">
                        Proyección total
                        <strong>{formatMoney(financial.projected)}</strong>
                      </div>
                      <p className="field-help">
                        La proyección incluye estimaciones; el saldo disponible
                        no las descuenta.
                      </p>
                    </div>
                  </div>
                </section>
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <h2>¿En qué estamos gastando?</h2>
                      <p>Consumos pagados por categoría</p>
                    </div>
                  </div>
                  {financial.paid > 0 ? (
                    <div className="category-bars">
                      {totalCategory
                        .filter((c) => c.total)
                        .map((c, index) => (
                          <div key={c.category}>
                            <div>
                              <span>{c.category}</span>
                              <strong>{formatMoney(c.total)}</strong>
                            </div>
                            <div className="category-track">
                              <span
                                className={`bar-${index % 4}`}
                                style={{
                                  width: `${(c.total / financial.paid) * 100}%`,
                                }}
                              />
                            </div>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <Empty
                      icon={<Wallet />}
                      title="El primer gasto marca el inicio"
                    >
                      Tus categorías aparecerán cuando registres un pago.
                    </Empty>
                  )}
                </section>
              </div>
              <div className="dashboard-columns lower">
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Últimos movimientos</h2>
                      <p>El pulso de tu viaje</p>
                    </div>
                    <button
                      className="text-button"
                      onClick={() => navigate("expenses")}
                    >
                      Ver todos <ArrowRight size={14} />
                    </button>
                  </div>
                  {data.expenses.length ? (
                    <div className="movement-list">
                      {data.expenses.slice(0, 5).map((e) => (
                        <button
                          className="movement"
                          key={e.id}
                          onClick={() =>
                            setModal({ kind: "expense", expense: e })
                          }
                        >
                          <span className="movement-icon">
                            <ReceiptText size={19} />
                          </span>
                          <span className="movement-description">
                            <strong>{e.description}</strong>
                            <small>
                              {name(e.payer_id)} · {dateLabel(e.occurred_on)}
                            </small>
                          </span>
                          <span className="movement-amount">
                            <strong>
                              {formatMoney(
                                e.status === "estimated"
                                  ? e.eur_minor
                                  : paidAmount(e) + remainingAmount(e),
                              )}
                            </strong>
                            <span className={`badge ${e.status}`}>
                              {e.status === "reserved" && paidAmount(e) > 0
                                ? "Pago parcial"
                                : statusNames[e.status]}
                            </span>
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <Empty
                      icon={<ReceiptText />}
                      title="Todavía no hay movimientos"
                      action={
                        <button
                          className="text-button"
                          onClick={() => setModal({ kind: "expense" })}
                        >
                          Cargar el primer gasto <ArrowRight size={15} />
                        </button>
                      }
                    >
                      Los gastos reales del grupo van a aparecer acá.
                    </Empty>
                  )}
                </section>
                <section className="route-card">
                  <div className="panel-heading">
                    <div>
                      <span className="eyebrow">EL VIAJE QUE SE VIENE</span>
                      <h2>{days} días para recordar.</h2>
                    </div>
                    <Plane size={25} />
                  </div>
                  <p>Un recorrido compartido. Muchas historias por delante.</p>
                  <div className="route-mini">
                    {data.trip.route_stops.slice(0, 5).map((city, i) => (
                      <span key={`${city}-${i}`}>
                        <i />
                        {city}
                      </span>
                    ))}
                    {data.trip.route_stops.length > 5 && (
                      <small>
                        + {data.trip.route_stops.length - 5} paradas
                      </small>
                    )}
                  </div>
                  <button
                    className="button secondary"
                    onClick={() => navigate("itinerary")}
                  >
                    Explorar itinerario <ArrowUpRight size={16} />
                  </button>
                </section>
              </div>
            </>
          )}
          {tab === "expenses" && (
            <section className="panel">
              <TrashPanel data={data} />
              <div className="table-toolbar">
                <label className="search-field">
                  <span className="sr-only">Buscar gastos</span>
                  <input
                    placeholder="Buscar gasto, categoría o viajero…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </label>
                <label>
                  <span className="sr-only">Filtrar por estado</span>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                  >
                    <option value="all">Todos los estados</option>
                    <option value="paid">Pagados</option>
                    <option value="reserved">Reservados</option>
                    <option value="estimated">Estimados</option>
                  </select>
                </label>
              </div>
              {filtered.length ? (
                <div className="expense-list">
                  {filtered.map((e) => (
                    <article className="expense-row" key={e.id}>
                      <div className="expense-summary">
                        <span className="movement-icon">
                          <ReceiptText size={19} />
                        </span>
                        <div>
                          <h3>{e.description}</h3>
                          <p>
                            {e.category} · {dateLabel(e.occurred_on)} ·{" "}
                            {name(e.payer_id)}
                          </p>
                          <small>
                            Entre{" "}
                            {data.shares
                              .filter((s) => s.expense_id === e.id)
                              .map((s) => name(s.member_id))
                              .join(", ")}
                          </small>
                        </div>
                        <div className="expense-amount">
                          <strong>
                            {formatMoney(
                              e.status === "estimated"
                                ? e.eur_minor
                                : paidAmount(e) + remainingAmount(e),
                            )}
                          </strong>
                          <small>
                            {formatMoney(e.amount_minor, e.currency)}
                          </small>
                          {paidAmount(e) > 0 && (
                            <small>
                              Pagado {formatMoney(paidAmount(e))} · Pendiente{" "}
                              {formatMoney(remainingOriginal(e), e.currency)}
                            </small>
                          )}
                          <span className={`badge ${e.status}`}>
                            {e.status === "reserved" && paidAmount(e) > 0
                              ? "Pago parcial"
                              : statusNames[e.status]}
                          </span>
                        </div>
                      </div>
                      <details>
                        <summary>
                          Detalles, acciones y comprobantes{" "}
                          <ChevronRight size={14} />
                        </summary>
                        <div className="expense-details">
                          <p>
                            1 {e.currency} = {e.rate_to_eur} EUR · Cotización
                            guardada del {dateLabel(e.rate_date)}
                          </p>
                          <p className="preserve">
                            {e.notes || "Sin notas adicionales."}
                          </p>
                          <ExpensePayments data={data} expense={e} />
                          <p className="field-help">
                            Reparto del total al TC de reserva. Las deudas se
                            calculan sobre los pagos efectivos, con sus propias
                            cotizaciones.
                          </p>
                          <div className="share-detail">
                            {data.shares
                              .filter((s) => s.expense_id === e.id)
                              .map((s) => (
                                <span key={s.member_id}>
                                  {name(s.member_id)}{" "}
                                  <strong>{formatMoney(s.amount_minor)}</strong>
                                </span>
                              ))}
                          </div>
                          <div className="row-actions">
                            <button
                              className="button secondary small"
                              onClick={() =>
                                setModal({ kind: "expense", expense: e })
                              }
                            >
                              <Pencil size={14} />
                              Editar
                            </button>
                            <button
                              className="button secondary small"
                              onClick={() =>
                                setModal({
                                  kind: "expense",
                                  expense: e,
                                  repeat: true,
                                })
                              }
                            >
                              Repetir gasto
                            </button>
                            {e.status !== "paid" && (
                              <ActionForm
                                action={markPaid}
                                label="Marcar pagado"
                                className="inline-action"
                                confirm="¿Registrar como pagado con el importe y la cotización guardados? Si cambiaron, editá el gasto primero."
                              >
                                <HiddenTrip id={data.trip.id} />
                                <input type="hidden" name="id" value={e.id} />
                              </ActionForm>
                            )}
                            <button
                              className="button secondary small"
                              onClick={() =>
                                setModal({ kind: "receipt", expense: e })
                              }
                            >
                              <Paperclip size={14} />
                              Comprobante
                            </button>
                            <ActionForm
                              action={deleteExpense}
                              label="Eliminar"
                              className="inline-action danger-action"
                              confirm="¿Enviar este gasto a la papelera? Deja de sumar a los saldos. Podés restaurarlo con sus pagos y comprobantes."
                            >
                              <HiddenTrip id={data.trip.id} />
                              <input type="hidden" name="id" value={e.id} />
                            </ActionForm>
                          </div>
                          {data.receipts
                            .filter((r) => r.expense_id === e.id)
                            .map((r) => (
                              <a
                                className="receipt-link"
                                href={`/receipts/${r.id}`}
                                key={r.id}
                              >
                                <Download size={14} />
                                {r.filename}
                              </a>
                            ))}
                        </div>
                      </details>
                    </article>
                  ))}
                </div>
              ) : (
                <Empty
                  icon={<Wallet />}
                  title={
                    data.expenses.length
                      ? "No hay coincidencias"
                      : "Sin gastos todavía"
                  }
                  action={data.expenses.length ? undefined : addExpense}
                >
                  {data.expenses.length
                    ? "Probá otro filtro o término de búsqueda."
                    : "Registrá un pago, una reserva o una estimación. Siempre vas a poder distinguirlos."}
                </Empty>
              )}
              <div className="table-footer">
                {filtered.length} movimientos · Las transferencias internas se
                muestran en Saldos.
              </div>
            </section>
          )}
          {tab === "balances" && (
            <>
              <div className="balance-grid">
                {data.members.map((m) => (
                  <section className="panel balance-card" key={m.user_id}>
                    <span className="avatar">
                      {m.display_name.slice(0, 1).toUpperCase()}
                    </span>
                    <h3>
                      {m.display_name}
                      {m.user_id === data.userId ? " (vos)" : ""}
                    </h3>
                    <strong
                      className={`balance-value ${(net[m.user_id] ?? 0) < 0 ? "negative" : "positive"}`}
                    >
                      {formatMoney(Math.abs(net[m.user_id] ?? 0))}
                    </strong>
                    <p>
                      {net[m.user_id] > 0
                        ? "Tiene que recibir"
                        : net[m.user_id] < 0
                          ? "Tiene que devolver"
                          : "Al día con el grupo"}
                    </p>
                  </section>
                ))}
              </div>
              <div className="dashboard-columns">
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Para quedar a mano</h2>
                      <p>Una propuesta para saldar los balances en EUR</p>
                    </div>
                    <ArrowLeftRight size={20} />
                  </div>
                  {transfers.length ? (
                    <div className="transfer-list">
                      {transfers.map((t, i) => (
                        <div className="transfer" key={i}>
                          <span>
                            {name(t.from)} <ArrowRight size={14} /> {name(t.to)}
                          </span>
                          <strong>{formatMoney(t.amount)}</strong>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <Empty icon={<Check />} title="Todo en equilibrio">
                      Cuando haya deudas por pagos compartidos, verás las
                      transferencias sugeridas.
                    </Empty>
                  )}
                  <p className="panel-note">
                    Las sugerencias no ejecutan ni registran pagos. Registrá una
                    transferencia solo después de realizarla.
                  </p>
                </section>
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Transferencias registradas</h2>
                      <p>No se cuentan como consumos del viaje</p>
                    </div>
                  </div>
                  {data.settlements.length ? (
                    <div className="transfer-list">
                      {data.settlements.map((s) => (
                        <div className="settlement-row" key={s.id}>
                          <div>
                            <strong>
                              {name(s.from_id)} → {name(s.to_id)}
                            </strong>
                            <p>
                              {dateLabel(s.occurred_on)} ·{" "}
                              {formatMoney(s.amount_minor, s.currency)} ·{" "}
                              {s.rate_to_eur} EUR/{s.currency}
                            </p>
                            {s.notes && <p>{s.notes}</p>}
                          </div>
                          <strong>{formatMoney(s.eur_minor)}</strong>
                          <DeleteButton
                            id={s.id}
                            trip={data.trip.id}
                            table="settlements"
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <Empty
                      icon={<ArrowDownLeft />}
                      title="Todavía no hubo transferencias"
                    >
                      Podés registrar devoluciones en cualquiera de las cuatro
                      monedas.
                    </Empty>
                  )}
                </section>
              </div>
            </>
          )}
          {tab === "itinerary" && (
            <>
              <section className="panel route-overview">
                <div className="panel-heading">
                  <div>
                    <h2>El recorrido</h2>
                    <p>
                      {dateLabel(data.trip.starts_on)} —{" "}
                      {dateLabel(data.trip.ends_on)} · {days} días
                    </p>
                  </div>
                  <button
                    className="text-button"
                    onClick={() => navigate("settings")}
                  >
                    Editar ruta <Pencil size={14} />
                  </button>
                </div>
                <div className="route-stops">
                  {data.trip.route_stops.map((city, i) => (
                    <div key={i}>
                      <span>{String(i + 1).padStart(2, "0")}</span>
                      <strong>{city}</strong>
                      {i < data.trip.route_stops.length - 1 && (
                        <ArrowRight size={15} />
                      )}
                    </div>
                  ))}
                </div>
                <p className="field-help">
                  El orden es editable. Las fechas de cada parada se agregan al
                  crear eventos; no asignamos reservas ni fechas inventadas.
                </p>
              </section>
              <TripMap initialQuery={data.trip.route_stops[0] ?? ""} />
              <TripCalendar
                trip={data.trip}
                events={data.events}
                onEvent={(event) => setModal({ kind: "event", event })}
              />
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <h2>Agenda del viaje</h2>
                    <p>Alojamientos, transportes y actividades</p>
                    <a
                      className="button secondary small"
                      href={`/itinerary.ics?trip=${data.trip.id}`}
                    >
                      Descargar agenda (.ics)
                    </a>
                    <p className="field-help">
                      Importala en Apple Calendar, Google Calendar u Outlook. Es
                      una copia: no se sincroniza automáticamente.
                    </p>
                  </div>
                </div>
                {data.events.length ? (
                  <div className="timeline">
                    {data.events.map((e) => {
                      const expense = data.expenses.find(
                        (x) => x.id === e.expense_id,
                      );
                      return (
                        <article className="timeline-event" key={e.id}>
                          <div className="timeline-date">
                            <strong>{dateLabel(e.starts_on)}</strong>
                            <small>
                              {e.starts_on !== e.ends_on
                                ? `hasta ${dateLabel(e.ends_on)}`
                                : "Todo el día"}
                            </small>
                          </div>
                          <div className="timeline-content">
                            <span className="eyebrow">
                              {
                                {
                                  stay: "ALOJAMIENTO",
                                  transport: "TRANSPORTE",
                                  activity: "ACTIVIDAD",
                                }[e.kind]
                              }
                            </span>
                            <h3>{e.title}</h3>
                            <p>
                              <MapPin size={14} />
                              {e.city}
                              {e.location ? ` · ${e.location}` : ""}
                            </p>
                            {e.start_time && (
                              <p>
                                {e.start_time.slice(0, 5)} —{" "}
                                {e.end_time?.slice(0, 5)} · {e.time_zone}
                              </p>
                            )}
                            <details className="event-map">
                              <summary>Ver lugar en el mapa</summary>
                              <TripMap
                                key={e.location + e.city + e.title}
                                initialQuery={[
                                  e.location || e.title,
                                  e.city,
                                ].join(", ")}
                              />
                            </details>
                            <div className="row-actions">
                              <a
                                className="button secondary small"
                                href={googleCalendarUrl(e)}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                Agregar a Google Calendar
                              </a>
                              <a
                                className="button secondary small"
                                href={`/itinerary.ics?trip=${data.trip.id}&event=${e.id}`}
                              >
                                Guardar en calendario (.ics)
                              </a>
                            </div>
                            {e.notes && <p className="preserve">{e.notes}</p>}
                            {expense && (
                              <button
                                className="linked-expense"
                                onClick={() => navigate("expenses")}
                              >
                                <ReceiptText size={14} />
                                {expense.description} ·{" "}
                                {formatMoney(expense.eur_minor)}
                                <span className={`badge ${expense.status}`}>
                                  {statusNames[expense.status]}
                                </span>
                              </button>
                            )}
                            <div className="row-actions">
                              <button
                                className="button secondary small"
                                onClick={() =>
                                  setModal({ kind: "event", event: e })
                                }
                              >
                                <Pencil size={14} />
                                Editar
                              </button>
                              <DeleteButton
                                id={e.id}
                                trip={data.trip.id}
                                table="itinerary_events"
                              />
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <Empty
                    icon={<CalendarDays />}
                    title="El calendario está por escribirse"
                    action={
                      <button
                        className="button secondary"
                        onClick={() => setModal({ kind: "event" })}
                      >
                        <Plus size={16} />
                        Crear primer evento
                      </button>
                    }
                  >
                    Agregá fechas y vinculá tus reservas sin duplicar sus
                    importes.
                  </Empty>
                )}
              </section>
            </>
          )}
          {tab === "scenarios" && (
            <>
              <div className="notice scenario-notice">
                <CircleHelp size={20} />
                Compará alternativas con el mismo alcance. Cada total incluye
                únicamente los precios cargados, no es un costo completo del
                viaje ni modifica tus gastos.
              </div>
              {data.scenarios.length ? (
                <div className="scenario-grid">
                  {data.scenarios.map((s, index) => {
                    const items = data.items.filter(
                      (i) => i.scenario_id === s.id,
                    );
                    const total = items.reduce(
                      (sum, i) => sum + i.eur_minor,
                      0,
                    );
                    const baseline = data.items
                      .filter((i) => i.scenario_id === data.scenarios[0].id)
                      .reduce((sum, i) => sum + i.eur_minor, 0);
                    return (
                      <section className="panel scenario-card" key={s.id}>
                        <div className="scenario-top">
                          <span className="eyebrow">
                            ALTERNATIVA {String(index + 1).padStart(2, "0")}
                          </span>
                          <GitCompareArrows size={20} />
                        </div>
                        <h2>{s.name}</h2>
                        <p>{s.notes || "Sin notas de alcance."}</p>
                        <div className="scenario-total">
                          {items.length ? formatMoney(total) : "Sin precios"}
                          <small>{items.length} conceptos registrados</small>
                        </div>
                        {index > 0 &&
                          items.length > 0 &&
                          data.items.some(
                            (i) => i.scenario_id === data.scenarios[0].id,
                          ) && (
                            <p className="scenario-delta">
                              {total >= baseline ? "+" : "−"}
                              {formatMoney(Math.abs(total - baseline))} vs.{" "}
                              {data.scenarios[0].name}
                            </p>
                          )}
                        <div className="confidence-summary">
                          {(["confirmed", "quoted", "estimated"] as const).map(
                            (c) => (
                              <span key={c}>
                                <i
                                  className={`legend-dot ${c === "confirmed" ? "teal-bg" : c === "quoted" ? "amber-bg" : "purple-bg"}`}
                                />
                                {
                                  {
                                    confirmed: "Confirmado",
                                    quoted: "Cotizado",
                                    estimated: "Estimado",
                                  }[c]
                                }
                                <strong>
                                  {formatMoney(
                                    items
                                      .filter((i) => i.confidence === c)
                                      .reduce((sum, i) => sum + i.eur_minor, 0),
                                  )}
                                </strong>
                              </span>
                            ),
                          )}
                        </div>
                        <div className="scenario-items">
                          {items.map((i) => (
                            <div key={i.id}>
                              <div>
                                <strong>{i.description}</strong>
                                <small>
                                  {formatMoney(i.amount_minor, i.currency)} ·{" "}
                                  {dateLabel(i.rate_date)} · {i.rate_to_eur}{" "}
                                  EUR/{i.currency}
                                </small>
                                <small>
                                  {i.source || "Estimación del grupo"}
                                </small>
                              </div>
                              <span>{formatMoney(i.eur_minor)}</span>
                              <DeleteButton
                                id={i.id}
                                trip={data.trip.id}
                                table="scenario_items"
                                label="Quitar"
                              />
                            </div>
                          ))}
                        </div>
                        <button
                          className="button secondary"
                          onClick={() =>
                            setModal({ kind: "item", scenario: s })
                          }
                        >
                          <Plus size={16} />
                          Agregar precio
                        </button>
                        <DeleteButton
                          id={s.id}
                          trip={data.trip.id}
                          table="scenarios"
                          label="Eliminar escenario"
                        />
                      </section>
                    );
                  })}
                </div>
              ) : (
                <section className="panel">
                  <Empty
                    icon={<GitCompareArrows />}
                    title="Una decisión, varias posibilidades"
                    action={
                      <button
                        className="button primary"
                        onClick={() => setModal({ kind: "scenario" })}
                      >
                        <Plus size={16} />
                        Crear escenario
                      </button>
                    }
                  >
                    Creá alternativas y agregá cotizaciones, precios confirmados
                    o estimaciones propias. Nunca completamos precios por vos.
                  </Empty>
                </section>
              )}
            </>
          )}
          {tab === "personal" && (
            <PrivateExpenses
              data={data}
              onAdd={() => setModal({ kind: "personal" })}
              onEdit={(expense) => setModal({ kind: "personal", expense })}
            />
          )}
          {tab === "activity" && <ActivityFeed data={data} />}
          {tab === "team" && (
            <div className="dashboard-columns">
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <h2>Los compañeros de ruta</h2>
                    <p>{data.members.length} de 4 lugares ocupados</p>
                  </div>
                  <Users size={20} />
                </div>
                <div className="team-list">
                  {data.members.map((m) => (
                    <div key={m.user_id}>
                      <span className="avatar">
                        {m.display_name.slice(0, 1).toUpperCase()}
                      </span>
                      <div className="member-info">
                        <strong>{m.display_name}</strong>
                        <small>{m.email}</small>
                        {(owner || m.user_id === data.userId) && (
                          <MemberName
                            member={m}
                            self={m.user_id === data.userId}
                          />
                        )}
                      </div>
                      <span className="pill">
                        {m.user_id === data.trip.owner_id
                          ? "Organizador"
                          : "Viajero"}
                      </span>
                    </div>
                  ))}
                </div>
                {owner && data.invitations.length > 0 && (
                  <div className="pending-invites">
                    <h3>Invitaciones pendientes</h3>
                    {data.invitations.map((i) => (
                      <div key={i.id}>
                        <span>
                          {i.email}
                          <small className="muted">
                            {" "}
                            · Vence {dateLabel(i.expires_at.slice(0, 10))}
                          </small>
                        </span>
                        <DeleteButton
                          id={i.id}
                          trip={data.trip.id}
                          table="trip_invitations"
                          label="Revocar"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </section>
              <section className="panel form-panel">
                <div className="panel-heading">
                  <div>
                    <h2>Invitar al viaje</h2>
                    <p>Acceso privado con contraseña e invitación</p>
                  </div>
                </div>
                <p>
                  <Link href="/guia" className="button secondary">
                    Guía para compartir con mis amigos
                  </Link>
                </p>
                {owner ? (
                  <InviteForm data={data} />
                ) : (
                  <div className="notice">
                    El organizador administra las invitaciones. Solo los
                    integrantes autorizados pueden acceder a este viaje.
                  </div>
                )}
              </section>
            </div>
          )}
          {tab === "settings" && (
            <div className="dashboard-columns">
              <section className="panel form-panel">
                <div className="panel-heading">
                  <div>
                    <h2>Datos del viaje</h2>
                    <p>La moneda principal es EUR</p>
                  </div>
                  <Settings2 size={20} />
                </div>
                {owner ? (
                  <SettingsForm data={data} />
                ) : (
                  <p>
                    Solo el organizador puede editar el presupuesto, las fechas
                    y el recorrido.
                  </p>
                )}
              </section>
              <div className="settings-stack">
                <section className="panel">
                  <h2>Tu contraseña</h2>
                  <p>
                    Podés cambiarla confirmando la actual. Guardala: no enviamos
                    enlaces de recuperación por correo.
                  </p>
                  <ChangePasswordForm />
                </section>
                <RecoveryCodes />
                <section className="panel">
                  <h2>Tu app, siempre a mano</h2>
                  <p>
                    Instalá Travel HQ desde tu navegador. En iPhone o iPad:
                    Safari → Compartir → Agregar a inicio.
                  </p>
                  <InstallButton />
                </section>
                <section className="panel">
                  <h2>Datos que son tuyos</h2>
                  <p>
                    Exportá tus gastos con importe original, cotización, estado
                    y equivalente en EUR.
                  </p>
                  <a
                    className="button secondary"
                    href={`/export?trip=${data.trip.id}`}
                  >
                    <Download size={16} />
                    Descargar CSV
                  </a>
                </section>
                <section className="panel">
                  <h2>Cómo calculamos</h2>
                  <p>
                    El dinero se guarda en centavos. Las conversiones se
                    redondean una sola vez por operación. El reparto conserva
                    exactamente el total.
                  </p>
                  <p>
                    Los saldos usan únicamente gastos pagados y transferencias
                    efectivas. Estimaciones y reservas se mantienen separadas.
                    La app requiere conexión para guardar cambios.
                  </p>
                </section>
              </div>
            </div>
          )}
          {tab === "team" && (
            <section className="panel">
              <details>
                <summary>Unirme a otro viaje con una invitación</summary>
                <JoinForm />
              </details>
            </section>
          )}
          <footer className="page-footer">
            <span>
              <Compass size={13} /> EUROTRIP 2027 · TRAVEL HQ
            </span>
            <span>Hecho para viajar juntos.</span>
          </footer>
        </main>
      </div>
      {tab === "expenses" && !modal && (
        <button
          className="mobile-add"
          aria-label="Cargar gasto rápido"
          onClick={() => setModal({ kind: "expense" })}
        >
          <Plus size={26} />
        </button>
      )}
      {modal && (
        <ModalWindow title={modalTitle} close={close}>
          {modal.kind === "expense" ? (
            <ExpenseEntry
              key={modal.expense?.id ?? "new"}
              data={data}
              expense={modal.expense}
              repeat={modal.repeat}
              preset={modal.preset}
              done={close}
            />
          ) : modal.kind === "personal" ? (
            <PersonalExpenseForm
              key={modal.expense?.id ?? "private-new"}
              data={data}
              expense={modal.expense}
              done={close}
            />
          ) : modal.kind === "settlement" ? (
            <SettlementForm data={data} done={close} />
          ) : modal.kind === "event" ? (
            <EventForm data={data} event={modal.event} done={close} />
          ) : modal.kind === "scenario" ? (
            <ScenarioForm data={data} done={close} />
          ) : modal.kind === "item" ? (
            <ScenarioItemForm
              data={data}
              scenario={modal.scenario}
              done={close}
            />
          ) : (
            <ReceiptForm data={data} expense={modal.expense} done={close} />
          )}
        </ModalWindow>
      )}
    </div>
  );
}

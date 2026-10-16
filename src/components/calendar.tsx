"use client";
import { useState } from "react";
import { ChevronLeft, ChevronRight, MapPin } from "lucide-react";
import type { Event, Trip } from "@/lib/types";
const iso = (date: Date) => date.toISOString().slice(0, 10);
export function TripCalendar({
  trip,
  events,
  onEvent,
}: {
  trip: Trip;
  events: Event[];
  onEvent: (event: Event) => void;
}) {
  const [month, setMonth] = useState(trip.starts_on.slice(0, 7)),
    [selected, setSelected] = useState(trip.starts_on);
  const first = new Date(`${month}-01T12:00:00Z`);
  const offset = (first.getUTCDay() + 6) % 7;
  const length = new Date(
    Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0, 12),
  ).getUTCDate();
  const cells = Array.from(
    { length: Math.ceil((offset + length) / 7) * 7 },
    (_, i) =>
      i >= offset && i < offset + length
        ? `${month}-${String(i - offset + 1).padStart(2, "0")}`
        : null,
  );
  const label = new Intl.DateTimeFormat("es-AR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(first);
  const dayLabel = (day: string) =>
    new Intl.DateTimeFormat("es-AR", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(`${day}T12:00:00Z`));
  const eventsOn = (day: string) =>
    events.filter((e) => e.starts_on <= day && e.ends_on >= day);
  function move(delta: number) {
    setMonth(
      iso(
        new Date(
          Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + delta, 1, 12),
        ),
      ).slice(0, 7),
    );
  }
  return (
    <section className="panel calendar-panel">
      <div className="panel-heading">
        <div>
          <h2>Calendario del viaje</h2>
          <p>Elegí un día para ver sus planes</p>
        </div>
        <div className="calendar-nav">
          <button
            className="icon-button"
            aria-label="Mes anterior"
            disabled={month <= trip.starts_on.slice(0, 7)}
            onClick={() => move(-1)}
          >
            <ChevronLeft size={18} />
          </button>
          <strong aria-live="polite">{label}</strong>
          <button
            className="icon-button"
            aria-label="Mes siguiente"
            disabled={month >= trip.ends_on.slice(0, 7)}
            onClick={() => move(1)}
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
      <table className="calendar-table">
        <caption className="sr-only">{label}</caption>
        <thead>
          <tr>
            {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((d) => (
              <th key={d} scope="col">
                {d}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: cells.length / 7 }, (_, row) => (
            <tr key={row}>
              {cells.slice(row * 7, row * 7 + 7).map((day, col) => (
                <td key={col}>
                  {day && (
                    <button
                      className={`${day >= trip.starts_on && day <= trip.ends_on ? "travel-day" : ""} ${selected === day ? "selected" : ""}`}
                      onClick={() => setSelected(day)}
                      aria-pressed={selected === day}
                      aria-label={`${dayLabel(day)}, ${eventsOn(day).length} eventos`}
                    >
                      <span>{Number(day.slice(-2))}</span>
                      {eventsOn(day).length > 0 && (
                        <small>
                          {eventsOn(day).length}{" "}
                          {eventsOn(day).length === 1 ? "plan" : "planes"}
                        </small>
                      )}
                    </button>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="calendar-key">
        <span className="legend-dot teal-bg" />
        Fechas del viaje
      </div>
      <div className="calendar-agenda">
        <h3>{dayLabel(selected)}</h3>
        {eventsOn(selected).length ? (
          eventsOn(selected).map((e) => (
            <button key={e.id} onClick={() => onEvent(e)}>
              <span>
                <strong>{e.title}</strong>
                <small>
                  <MapPin size={12} />
                  {e.city}
                </small>
              </span>
              <ChevronRight size={15} />
            </button>
          ))
        ) : (
          <p>No hay eventos registrados para este día.</p>
        )}
      </div>
    </section>
  );
}

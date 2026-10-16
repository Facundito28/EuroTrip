import type { Event } from "./types";
export const eventZones = [
  "Europe/Madrid",
  "Europe/Lisbon",
  "Europe/London",
  "Europe/Amsterdam",
  "Europe/Brussels",
  "Europe/Paris",
] as const;
const compact = (date: Date) =>
  date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
function nextDay(day: string) {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10).replaceAll("-", "");
}
/** Resolve local wall time using the event's destination zone, never the device zone. */
export function eventUtc(day: string, time: string, zone: string) {
  const local = `${day}T${time.slice(0, 5)}:00`;
  const target = Date.parse(local + "Z");
  let value = target;
  const fmt = new Intl.DateTimeFormat("sv-SE", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  for (let i = 0; i < 4; i++) {
    const parts = Object.fromEntries(
      fmt.formatToParts(new Date(value)).map((p) => [p.type, p.value]),
    );
    const rendered = `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`;
    if (rendered === local) return compact(new Date(value));
    value += target - Date.parse(rendered + "Z");
  }
  throw new Error(
    "Ese horario no existe en la zona elegida. Revisá el cambio de hora.",
  );
}
export function eventDates(event: Event) {
  if (event.start_time && event.end_time)
    return {
      start: eventUtc(
        event.starts_on,
        event.start_time,
        event.time_zone ?? "Europe/Madrid",
      ),
      end: eventUtc(
        event.ends_on,
        event.end_time,
        event.time_zone ?? "Europe/Madrid",
      ),
      allDay: false,
    };
  return {
    start: event.starts_on.replaceAll("-", ""),
    end: nextDay(event.ends_on),
    allDay: true,
  };
}
export function googleCalendarUrl(event: Event) {
  const dates = eventDates(event);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${dates.start}/${dates.end}`,
    location: [event.location, event.city].filter(Boolean).join(", "),
    details: event.notes,
    ctz: event.time_zone ?? "Europe/Madrid",
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}
export function mapUrl(query: string) {
  return `https://maps.google.com/maps?${new URLSearchParams({ q: query, output: "embed" })}`;
}
const escapeText = (value: string) =>
  value
    .replaceAll("\\", "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replaceAll(";", "\\;")
    .replaceAll(",", "\\,");
// Fold by UTF-8 octets (RFC 5545), preserving whole Unicode code points.
function fold(line: string) {
  let out = "",
    size = 0;
  for (const char of line) {
    const bytes = new TextEncoder().encode(char).length;
    if (size + bytes > 75) {
      out += "\r\n ";
      size = 1;
    }
    out += char;
    size += bytes;
  }
  return out;
}
export function itineraryIcs(events: Event[], now = new Date()) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//EuroTrip 2027//Travel HQ//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];
  for (const event of events) {
    const d = eventDates(event);
    lines.push(
      "BEGIN:VEVENT",
      `UID:${event.id}@eurotrip-travel-hq`,
      `DTSTAMP:${compact(now)}`,
      `DTSTART${d.allDay ? ";VALUE=DATE" : ""}:${d.start}`,
      `DTEND${d.allDay ? ";VALUE=DATE" : ""}:${d.end}`,
      `SUMMARY:${escapeText(event.title)}`,
      `LOCATION:${escapeText([event.location, event.city].filter(Boolean).join(", "))}`,
      `DESCRIPTION:${escapeText(event.notes)}`,
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}

import { expect, it } from "vitest";
import {
  eventDates,
  eventUtc,
  googleCalendarUrl,
  itineraryIcs,
  mapUrl,
} from "../src/lib/agenda";
import type { Event } from "../src/lib/types";
const event = {
  id: "11111111-1111-4111-8111-111111111111",
  title: "Museo; visita",
  city: "Madrid",
  location: "Paseo del Prado",
  starts_on: "2027-04-22",
  ends_on: "2027-04-22",
  time_zone: "Europe/Madrid",
  notes: "Entrada comprada\nLlevar documento",
  kind: "activity",
} as Event;
it("exports inclusive day ranges with exclusive ICS end", () => {
  expect(eventDates(event)).toEqual({
    start: "20270422",
    end: "20270423",
    allDay: true,
  });
  expect(
    eventDates({ ...event, starts_on: "2027-04-30", ends_on: "2027-05-02" })
      .end,
  ).toBe("20270503");
});
it("uses local destination summer time, independent of device zone", () => {
  expect(eventUtc("2027-04-22", "10:00", "Europe/Madrid")).toBe(
    "20270422T080000Z",
  );
  expect(eventUtc("2027-04-22", "10:00", "Europe/London")).toBe(
    "20270422T090000Z",
  );
  expect(eventUtc("2027-01-22", "10:00", "Europe/Madrid")).toBe(
    "20270122T090000Z",
  );
  expect(() => eventUtc("2027-03-28", "02:30", "Europe/Madrid")).toThrow();
});
it("creates timed Google Calendar and ICS events with exact UTC hours", () => {
  const timed = { ...event, start_time: "10:00:00", end_time: "12:00:00" };
  const url = new URL(googleCalendarUrl(timed));
  expect(url.searchParams.get("dates")).toBe(
    "20270422T080000Z/20270422T100000Z",
  );
  const ics = itineraryIcs([timed]);
  expect(ics).toContain("DTSTART:20270422T080000Z\r\n");
  expect(ics).toContain("SUMMARY:Museo\\; visita");
  expect(ics).toContain("Entrada comprada\\nLlevar documento");
});
it("escapes newlines to avoid calendar property injection and folds UTF8 safely", () => {
  const ics = itineraryIcs([
    { ...event, title: "A\nATTENDEE:intruder", notes: "ñ".repeat(150) },
  ]);
  expect(ics).not.toContain("\r\nATTENDEE:");
  for (const line of ics.split("\r\n"))
    expect(Buffer.byteLength(line)).toBeLessThanOrEqual(75);
  expect(ics.replaceAll("\r\n ", "")).toContain("ñ".repeat(150));
});
it("encodes map queries into a fixed HTTPS provider URL", () => {
  const url = new URL(mapUrl("Madrid & <museo>"));
  expect(url.origin).toBe("https://maps.google.com");
  expect(url.searchParams.get("q")).toBe("Madrid & <museo>");
  expect(url.searchParams.get("output")).toBe("embed");
});

import { eventUtc } from "./agenda";
import type { Event, TripBooking } from "./types";
export function staysForNight(bookings: TripBooking[], day: string) {
  return bookings.filter(
    (b) =>
      b.kind === "stay" &&
      b.starts_on <= day &&
      (b.ends_on > day || (b.starts_on === b.ends_on && b.ends_on === day)),
  );
}
export function timedPlans(events: Event[], day: string, now: string) {
  return events
    .filter(
      (e) =>
        e.kind !== "stay" &&
        e.starts_on <= day &&
        e.ends_on >= day &&
        e.start_time,
    )
    .map((e) => ({
      event: e,
      start: eventUtc(
        e.starts_on,
        e.start_time!,
        e.time_zone ?? "Europe/Madrid",
      ),
    }))
    .filter((e) => e.start >= now)
    .sort((a, b) => a.start.localeCompare(b.start))
    .map((e) => e.event);
}

import { expect, it } from "vitest";
import { staysForNight, timedPlans } from "../src/lib/companion";
import type { TripBooking, Event } from "../src/lib/types";
it("does not count checkout as an additional hotel night", () => {
  const b = {
    kind: "stay",
    starts_on: "2027-04-22",
    ends_on: "2027-04-24",
  } as TripBooking;
  expect(staysForNight([b], "2027-04-23")).toHaveLength(1);
  expect(staysForNight([b], "2027-04-24")).toHaveLength(0);
});
it("orders upcoming timed plans by their actual destination zone and omits past/all-day entries", () => {
  const e = {
    starts_on: "2027-04-22",
    ends_on: "2027-04-22",
    kind: "activity",
    start_time: "10:00",
    time_zone: "Europe/Madrid",
  } as Event;
  const london = {
    ...e,
    id: "london",
    start_time: "09:30",
    time_zone: "Europe/London",
  };
  expect(
    timedPlans(
      [{ ...e, id: "madrid" }, london, { ...e, start_time: null }],
      "2027-04-22",
      "20270422T070000Z",
    ).map((e) => e.id),
  ).toEqual(["madrid", "london"]);
  expect(
    timedPlans([e, london], "2027-04-22", "20270422T081000Z").map((e) => e.id),
  ).toEqual(["london"]);
});

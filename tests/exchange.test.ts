import { expect, it } from "vitest";
import { parseEuropeanRates, parsePesoRate } from "../src/lib/exchange";
import { reciprocalRate, divideRates } from "../src/lib/money";
import { swipeMenuDirection } from "../src/lib/swipe";
const fixture = {
  base: "EUR",
  date: "2026-10-16",
  rates: { USD: 1.1, GBP: 0.85, CZK: 25 },
};
it("keeps rate directions explicit and rounds decimal reciprocals correctly", () => {
  const r = parseEuropeanRates(fixture);
  expect(r.perEur.USD).toBe("1.1");
  expect(r.toEur.USD).toBe("0.90909091");
  expect(r.toEur.CZK).toBe("0.04000000");
  expect(reciprocalRate("0.8")).toBe("1.25000000");
  expect(divideRates("0.9", "1500")).toBe("0.00060000");
});
it("rejects missing, zero, negative, malformed or wrong-base provider rates", () => {
  for (const data of [
    {},
    { ...fixture, base: "USD" },
    { ...fixture, rates: { USD: 0, GBP: 1, CZK: 25 } },
    { ...fixture, date: "not a date" },
  ])
    expect(() => parseEuropeanRates(data)).toThrow();
});
it("requires the chosen peso market and uses sale with both source dates", () => {
  const r = parsePesoRate(
    {
      moneda: "USD",
      casa: "blue",
      venta: 1500,
      fechaActualizacion: "2026-10-17T12:00:00Z",
    },
    "blue",
    parseEuropeanRates(fixture),
  );
  expect(r.rate).toBe("0.00060606");
  expect(r.source).toContain("Blue venta (2026-10-17)");
  expect(r.source).toContain("2026-10-16");
  expect(() =>
    parsePesoRate(
      {
        moneda: "USD",
        casa: "oficial",
        venta: 1500,
        fechaActualizacion: "2026-10-17T12:00:00Z",
      },
      "blue",
      parseEuropeanRates(fixture),
    ),
  ).toThrow();
});
it("recognizes horizontal edge menu swipes without hijacking vertical scroll or content", () => {
  expect(swipeMenuDirection({ x: 30, y: 100 }, { x: 140, y: 110 }, false)).toBe(
    "open",
  );
  expect(swipeMenuDirection({ x: 180, y: 100 }, { x: 40, y: 110 }, true)).toBe(
    "close",
  );
  expect(
    swipeMenuDirection({ x: 140, y: 100 }, { x: 260, y: 110 }, false),
  ).toBeNull();
  expect(
    swipeMenuDirection({ x: 30, y: 100 }, { x: 40, y: 240 }, false),
  ).toBeNull();
  expect(
    swipeMenuDirection({ x: 30, y: 100 }, { x: 45, y: 105 }, false),
  ).toBeNull();
});

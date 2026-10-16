import { describe, expect, it } from "vitest";
import { parseMoney, splitEqual, toEur, validateRate } from "../src/lib/money";
describe("integer money", () => {
  it("parses decimals without binary rounding", () => {
    expect(parseMoney("10,01")).toBe(1001);
    expect(parseMoney("0.29")).toBe(29);
    expect(parseMoney("10")).toBe(1000);
  });
  it.each(["1.234", "-5", "1e4", "1,000.20", "NaN", "", "10000000001"])(
    "rejects ambiguous or excessive amounts: %s",
    (value) => expect(() => parseMoney(value)).toThrow(),
  );
  it("converts all supported currencies with manual historical rates", () => {
    expect(toEur(10000, "1")).toBe(10000);
    expect(toEur(10000, "0.92345678")).toBe(9235);
    expect(toEur(10000, "1.17")).toBe(11700);
    expect(toEur(1000000, "0.0007")).toBe(700);
  });
  it("rounds halves up once, as PostgreSQL does", () => {
    expect(toEur(1, "0.5")).toBe(1);
    expect(toEur(3, "0.5")).toBe(2);
    expect(toEur(1001, "0.92345678")).toBe(924);
  });
  it("rejects zero, invalid, excessive precision and overflow rates", () => {
    for (const r of ["0", "-1", "1.123456789", "1e-3"])
      expect(() => validateRate(r)).toThrow();
    expect(() => toEur(1_000_000_000_000, "100")).toThrow();
  });
  it("distributes remainders deterministically and conserves cents", () => {
    expect(splitEqual(1001, ["d", "b", "c", "a"])).toEqual({
      a: 251,
      b: 250,
      c: 250,
      d: 250,
    });
    expect(splitEqual(1, ["b", "a"])).toEqual({ a: 1, b: 0 });
  });
  it("conserves money for many amounts and participant counts", () => {
    for (let n = 1; n <= 4; n++)
      for (let amount = 0; amount < 10000; amount += 13) {
        const shares = Object.values(
          splitEqual(
            amount,
            Array.from({ length: n }, (_, i) => String(i)),
          ),
        );
        expect(shares.reduce((a, b) => a + b, 0)).toBe(amount);
        expect(Math.max(...shares) - Math.min(...shares)).toBeLessThanOrEqual(
          1,
        );
      }
  });
  it("rejects an empty or duplicate participant set", () => {
    expect(() => splitEqual(100, [])).toThrow();
    expect(() => splitEqual(100, ["a", "a"])).toThrow();
  });
});
it("allocates unequal amounts and percentages with deterministic largest remainders", async () => {
  const { splitWeighted } = await import("../src/lib/money");
  expect(splitWeighted(10001, { a: 50, b: 30, c: 20 })).toEqual({
    a: 5001,
    b: 3000,
    c: 2000,
  });
  expect(splitWeighted(2, { b: 1, a: 1, c: 1 })).toEqual({ a: 1, b: 1, c: 0 });
  expect(splitWeighted(100, { a: 0, b: 100 })).toEqual({ a: 0, b: 100 });
  for (let n = 1; n < 10000; n += 113) {
    const r = splitWeighted(n, { a: 3333, b: 3333, c: 3334 });
    expect(Object.values(r).reduce((a, b) => a + b, 0)).toBe(n);
  }
  expect(() => splitWeighted(100, { a: 0 })).toThrow();
  expect(() => splitWeighted(100, { a: -1, b: 2 })).toThrow();
});

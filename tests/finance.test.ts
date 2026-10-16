import { expect, it } from "vitest";
import { balances, suggestedTransfers, totals } from "../src/lib/finance";
import { expensesCsv } from "../src/lib/csv";
import type { Expense, Member, Settlement } from "../src/lib/types";
const members = ["a", "b", "c", "d"].map((user_id) => ({
  user_id,
  display_name: user_id,
  email: `${user_id}@test.com`,
  trip_id: "trip",
})) as Member[];
const expense = (
  id: string,
  status: Expense["status"],
  eur_minor = 10000,
  payer_id = "a",
) =>
  ({
    id,
    status,
    eur_minor,
    payer_id,
    amount_minor: eur_minor,
    currency: "EUR",
    rate_to_eur: 1,
    rate_date: "2027-04-22",
    occurred_on: "2027-04-22",
    description: "Cena",
    category: "Comida",
    notes: "",
  }) as Expense;
it("keeps estimates, reservations and payments distinct", () => {
  expect(
    totals(
      [
        expense("1", "paid"),
        expense("2", "reserved", 20000),
        expense("3", "estimated", 30000),
      ],
      100000,
    ),
  ).toEqual({
    paid: 10000,
    reserved: 20000,
    estimated: 30000,
    available: 70000,
    projected: 60000,
  });
});
it("only paid expenses create debts and balances sum to zero", () => {
  const expenses = [
    expense("1", "paid"),
    expense("2", "reserved"),
    expense("3", "estimated"),
  ];
  const shares = expenses.flatMap((e) =>
    members.map((m) => ({
      expense_id: e.id,
      member_id: m.user_id,
      amount_minor: 2500,
    })),
  );
  const net = balances(members, expenses, shares, []);
  expect(net).toEqual({ a: 7500, b: -2500, c: -2500, d: -2500 });
  expect(Object.values(net).reduce((a, b) => a + b, 0)).toBe(0);
});
it("internal transfers settle debt without increasing consumed budget", () => {
  const expenses = [expense("1", "paid")];
  const shares = members.map((m) => ({
    expense_id: "1",
    member_id: m.user_id,
    amount_minor: 2500,
  }));
  const settlements = [
    { from_id: "b", to_id: "a", eur_minor: 2500 },
  ] as Settlement[];
  expect(balances(members, expenses, shares, settlements)).toEqual({
    a: 5000,
    b: 0,
    c: -2500,
    d: -2500,
  });
  expect(totals(expenses, 20000).paid).toBe(10000);
});
it("payers may pay for other participants without joining their split", () => {
  expect(
    balances(
      members,
      [expense("1", "paid", 1000, "a")],
      [{ expense_id: "1", member_id: "b", amount_minor: 1000 }],
      [],
    ),
  ).toEqual({ a: 1000, b: -1000, c: 0, d: 0 });
});
it("paying a reservation replaces its status rather than adding another expense", () => {
  const e = expense("1", "reserved");
  expect(totals([e], 20000).available).toBe(10000);
  e.status = "paid";
  expect(totals([e], 20000)).toEqual({
    paid: 10000,
    reserved: 0,
    estimated: 0,
    available: 10000,
    projected: 10000,
  });
});
it("suggestions exactly settle all balances", () => {
  const original = { a: 3301, b: -2340, c: 600, d: -1561 };
  const net: Record<string, number> = { ...original };
  const transfers = suggestedTransfers(net);
  expect(net).toEqual(original);
  for (const t of transfers) {
    net[t.from] += t.amount;
    net[t.to] -= t.amount;
  }
  expect(Object.values(net)).toEqual([0, 0, 0, 0]);
});
it("handles overpayment by reversing the creditor/debtor relationship", () => {
  const net = balances(members, [], [], [
    { from_id: "a", to_id: "b", eur_minor: 1000 },
  ] as Settlement[]);
  expect(suggestedTransfers(net)).toEqual([
    { from: "b", to: "a", amount: 1000 },
  ]);
});
it("CSV preserves original exchange metadata and protects against formulas", () => {
  const e = expense("1", "paid");
  e.description = ' =HYPERLINK("bad")';
  e.notes = 'Texto; con "comillas"\ny salto';
  const csv = expensesCsv([e], members);
  expect(csv.startsWith("\uFEFF")).toBe(true);
  expect(csv).toContain("' =HYPERLINK");
  expect(csv).toContain('""comillas""');
  expect(csv).toContain('"100.00";"EUR";"1";"2027-04-22";"100.00"');
});

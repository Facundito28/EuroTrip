import type { Expense, Member, Settlement, Share } from "./types";

export function totals(expenses: Expense[], budget: number) {
  const sum = (status: string) =>
    expenses
      .filter((e) => e.status === status)
      .reduce((s, e) => s + e.eur_minor, 0);
  const paid = sum("paid"),
    reserved = sum("reserved"),
    estimated = sum("estimated");
  return {
    paid,
    reserved,
    estimated,
    available: budget - paid - reserved,
    projected: paid + reserved + estimated,
  };
}
/** Positive balance: member must receive. Transfers reduce a debt, never spending. */
export function balances(
  members: Member[],
  expenses: Expense[],
  shares: Share[],
  settlements: Settlement[],
) {
  const result: Record<string, number> = Object.fromEntries(
    members.map((m) => [m.user_id, 0]),
  );
  const paid = new Set(
    expenses.filter((e) => e.status === "paid").map((e) => e.id),
  );
  for (const expense of expenses)
    if (expense.status === "paid")
      result[expense.payer_id] =
        (result[expense.payer_id] ?? 0) + expense.eur_minor;
  for (const share of shares)
    if (paid.has(share.expense_id))
      result[share.member_id] =
        (result[share.member_id] ?? 0) - share.amount_minor;
  for (const transfer of settlements) {
    result[transfer.from_id] =
      (result[transfer.from_id] ?? 0) + transfer.eur_minor;
    result[transfer.to_id] = (result[transfer.to_id] ?? 0) - transfer.eur_minor;
  }
  return result;
}
export function suggestedTransfers(net: Record<string, number>) {
  const debtors = Object.entries(net)
    .filter(([, n]) => n < 0)
    .map(([id, n]) => ({ id, amount: -n }))
    .sort((a, b) => b.amount - a.amount || a.id.localeCompare(b.id));
  const creditors = Object.entries(net)
    .filter(([, n]) => n > 0)
    .map(([id, n]) => ({ id, amount: n }))
    .sort((a, b) => b.amount - a.amount || a.id.localeCompare(b.id));
  const result: { from: string; to: string; amount: number }[] = [];
  let d = 0,
    c = 0;
  while (d < debtors.length && c < creditors.length) {
    const amount = Math.min(debtors[d].amount, creditors[c].amount);
    result.push({ from: debtors[d].id, to: creditors[c].id, amount });
    debtors[d].amount -= amount;
    creditors[c].amount -= amount;
    if (!debtors[d].amount) d++;
    if (!creditors[c].amount) c++;
  }
  return result;
}

/** Consumption follows participation, independently of who paid or settled debts. */
export function personalTotals(
  userId: string,
  expenses: Expense[],
  shares: Share[],
  budget: number,
) {
  const amounts = new Map(
    shares
      .filter((s) => s.member_id === userId)
      .map((s) => [s.expense_id, s.amount_minor]),
  );
  return totals(
    expenses.map((e) => ({ ...e, eur_minor: amounts.get(e.id) ?? 0 })),
    budget,
  );
}

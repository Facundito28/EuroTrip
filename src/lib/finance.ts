import { splitWeighted, toEur } from "./money";
import type {
  Expense,
  Member,
  Settlement,
  Share,
  ExpensePayment,
} from "./types";

export function totals(expenses: Expense[], budget: number) {
  const paid = expenses.reduce((s, e) => s + paidAmount(e), 0);
  const reserved = expenses
    .filter((e) => e.status !== "estimated")
    .reduce((s, e) => s + remainingAmount(e), 0);
  const estimated = expenses
    .filter((e) => e.status === "estimated")
    .reduce((s, e) => s + e.eur_minor, 0);
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
  payments?: ExpensePayment[],
) {
  const result: Record<string, number> = Object.fromEntries(
    members.map((m) => [m.user_id, 0]),
  );
  for (const expense of expenses) {
    const ledger = payments?.filter((p) => p.expense_id === expense.id);
    if (ledger) {
      for (const p of ledger)
        result[p.payer_id] = (result[p.payer_id] ?? 0) + p.eur_minor;
    } else
      result[expense.payer_id] =
        (result[expense.payer_id] ?? 0) + paidAmount(expense);
    const consumed = paidShares(expense, shares);
    for (const [id, amount] of Object.entries(consumed))
      result[id] = (result[id] ?? 0) - amount;
  }
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
  let paid = 0,
    reserved = 0,
    estimated = 0;
  for (const expense of expenses) {
    const own = shares.filter((s) => s.expense_id === expense.id);
    if (expense.paid_eur_minor === undefined) {
      const part = own.find((s) => s.member_id === userId)?.amount_minor ?? 0;
      if (expense.status === "paid") paid += part;
      else if (expense.status === "reserved") reserved += part;
      else estimated += part;
      continue;
    }
    paid += paidShares(expense, shares)[userId] ?? 0;
    const weights = Object.fromEntries(
      own.map((s) => [s.member_id, s.weight ?? s.amount_minor]),
    );
    if (Object.values(weights).some((w) => w > 0)) {
      if (expense.status === "estimated")
        estimated += splitWeighted(expense.eur_minor, weights)[userId] ?? 0;
      else
        reserved +=
          splitWeighted(remainingAmount(expense), weights)[userId] ?? 0;
    }
  }
  return {
    paid,
    reserved,
    estimated,
    available: budget - paid - reserved,
    projected: paid + reserved + estimated,
  };
}
export function paidAmount(e: Expense) {
  return e.paid_eur_minor ?? (e.status === "paid" ? e.eur_minor : 0);
}
export function remainingOriginal(e: Expense) {
  return Math.max(
    0,
    e.amount_minor -
      (e.paid_original_minor ?? (e.status === "paid" ? e.amount_minor : 0)),
  );
}
export function remainingAmount(e: Expense) {
  return e.status === "estimated"
    ? 0
    : toEur(remainingOriginal(e), String(e.rate_to_eur));
}
export function paidShares(e: Expense, shares: Share[]) {
  const own = shares.filter((s) => s.expense_id === e.id);
  if (e.paid_eur_minor === undefined)
    return Object.fromEntries(
      own.map((s) => [s.member_id, e.status === "paid" ? s.amount_minor : 0]),
    );
  const weights = Object.fromEntries(
    own.map((s) => [s.member_id, s.weight ?? s.amount_minor]),
  );
  return Object.values(weights).some((w) => w > 0)
    ? splitWeighted(paidAmount(e), weights)
    : {};
}

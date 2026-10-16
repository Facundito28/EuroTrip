import { decimalAmount } from "./money";
import type { Expense, Member } from "./types";
function cell(value: string) {
  // Prevent spreadsheet formula injection, including whitespace-prefixed formulas.
  const safe = /^[\s]*[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
}
export function expensesCsv(expenses: Expense[], members: Member[]) {
  const rows = [
    [
      "ID",
      "Fecha",
      "Descripción",
      "Categoría",
      "Estado",
      "Pagador",
      "Importe original",
      "Moneda",
      "EUR por unidad",
      "Fecha cotización",
      "Equivalente EUR",
      "Notas",
    ],
    ...expenses.map((e) => [
      e.id,
      e.occurred_on,
      e.description,
      e.category,
      { paid: "Pagado", reserved: "Reservado", estimated: "Estimado" }[
        e.status
      ],
      members.find((m) => m.user_id === e.payer_id)?.display_name ?? e.payer_id,
      decimalAmount(e.amount_minor),
      e.currency,
      String(e.rate_to_eur),
      e.rate_date,
      decimalAmount(e.eur_minor),
      e.notes,
    ]),
  ];
  return "\uFEFF" + rows.map((row) => row.map(cell).join(";")).join("\r\n");
}

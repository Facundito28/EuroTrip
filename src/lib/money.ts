export const currencies = ["EUR", "USD", "GBP", "ARS"] as const;
export type Currency = (typeof currencies)[number];
export const MAX_MINOR = 1_000_000_000_000;

/** All amounts are integer hundredths. Never multiply binary floating point money. */
export function parseMoney(value: string): number {
  const normalized = value.trim().replace(",", ".");
  if (!/^\d{1,13}(\.\d{1,2})?$/.test(normalized))
    throw new Error(
      "Ingresá un importe positivo, sin separadores de miles y con hasta 2 decimales.",
    );
  const [whole, fraction = ""] = normalized.split(".");
  const minor = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
  if (minor > BigInt(MAX_MINOR))
    throw new Error("El importe supera el límite permitido.");
  return Number(minor);
}

export function validateRate(value: string): string {
  const rate = value.trim().replace(",", ".");
  if (!/^\d{1,8}(\.\d{1,8})?$/.test(rate))
    throw new Error("Cotización inválida: usá hasta 8 decimales.");
  const [whole, fraction = ""] = rate.split(".");
  if (BigInt(whole) * 100000000n + BigInt(fraction.padEnd(8, "0")) <= 0n)
    throw new Error("La cotización debe ser mayor que cero.");
  return rate;
}

/** EUR per one unit of original currency; rounds half up just like PostgreSQL numeric. */
export function toEur(minor: number, rate: string): number {
  if (!Number.isSafeInteger(minor) || minor < 0 || minor > MAX_MINOR)
    throw new Error("Importe inválido.");
  const [whole, fraction = ""] = validateRate(rate).split(".");
  const scaled = BigInt(whole) * 100000000n + BigInt(fraction.padEnd(8, "0"));
  const result = (BigInt(minor) * scaled + 50000000n) / 100000000n;
  if (result > BigInt(MAX_MINOR))
    throw new Error("El equivalente en EUR supera el límite permitido.");
  return Number(result);
}

export function splitEqual(
  total: number,
  participants: string[],
): Record<string, number> {
  if (
    !Number.isSafeInteger(total) ||
    total < 0 ||
    total > MAX_MINOR ||
    participants.length === 0 ||
    new Set(participants).size !== participants.length
  )
    throw new Error("División inválida.");
  const sorted = [...participants].sort();
  const base = Math.floor(total / sorted.length);
  const remainder = total % sorted.length;
  return Object.fromEntries(
    sorted.map((id, index) => [id, base + (index < remainder ? 1 : 0)]),
  );
}

export function formatMoney(minor: number, currency: Currency = "EUR"): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(minor / 100);
}
export function decimalAmount(minor: number): string {
  return (minor / 100).toFixed(2);
}

/** Largest remainder allocation, conserving cents for arbitrary nonnegative weights. */
export function splitWeighted(
  total: number,
  weights: Record<string, number>,
): Record<string, number> {
  const entries = Object.entries(weights);
  if (
    !Number.isSafeInteger(total) ||
    total < 0 ||
    total > MAX_MINOR ||
    !entries.length ||
    entries.some(([, w]) => !Number.isSafeInteger(w) || w < 0)
  )
    throw new Error("Reparto inválido.");
  const sum = entries.reduce((s, [, w]) => s + BigInt(w), 0n);
  if (sum <= 0n)
    throw new Error(
      "El reparto debe tener participantes con importe mayor a cero.",
    );
  const result = Object.fromEntries(
    entries.map(([id, w]) => [id, Number((BigInt(total) * BigInt(w)) / sum)]),
  );
  let rest = total - Object.values(result).reduce((a, b) => a + b, 0);
  entries.sort(([a, wa], [b, wb]) => {
    const ra = (BigInt(total) * BigInt(wa)) % sum,
      rb = (BigInt(total) * BigInt(wb)) % sum;
    return ra === rb ? a.localeCompare(b) : ra > rb ? -1 : 1;
  });
  for (const [id] of entries) {
    if (!rest) break;
    result[id]++;
    rest--;
  }
  return result;
}

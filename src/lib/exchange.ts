import { z } from "zod";
import { reciprocalRate, divideRates, validateRate } from "./money";
const date = z.iso.date();
const positive = z.number().positive().finite().max(99999999);
const frankfurter = z.object({
  base: z.literal("EUR"),
  date,
  rates: z.object({ USD: positive, GBP: positive, CZK: positive }),
});
export type ReferenceRates = {
  date: string;
  source: string;
  perEur: { EUR: string; USD: string; GBP: string; CZK: string };
  toEur: { EUR: string; USD: string; GBP: string; CZK: string };
};
export function parseEuropeanRates(data: unknown): ReferenceRates {
  const parsed = frankfurter.parse(data);
  const perEur = {
    EUR: "1",
    USD: validateRate(String(parsed.rates.USD)),
    GBP: validateRate(String(parsed.rates.GBP)),
    CZK: validateRate(String(parsed.rates.CZK)),
  };
  return {
    date: parsed.date,
    source: "Frankfurter · referencia diaria",
    perEur,
    toEur: {
      EUR: "1",
      USD: reciprocalRate(perEur.USD),
      GBP: reciprocalRate(perEur.GBP),
      CZK: reciprocalRate(perEur.CZK),
    },
  };
}
export const pesoMarkets = ["oficial", "blue", "bolsa"] as const;
export const pesoMarketLabels = {
  oficial: "Oficial",
  blue: "Blue",
  bolsa: "MEP",
};
export function parsePesoRate(
  data: unknown,
  market: (typeof pesoMarkets)[number],
  europe: ReferenceRates,
) {
  const peso = z
    .object({
      moneda: z.literal("USD"),
      casa: z.literal(market),
      venta: positive,
      fechaActualizacion: z.iso.datetime({ offset: true }),
    })
    .parse(data);
  return {
    date: europe.date,
    rate: divideRates(europe.toEur.USD, String(peso.venta)),
    source: `DolarAPI · ${pesoMarketLabels[market]} venta (${peso.fechaActualizacion.slice(0, 10)}) / ${europe.source} (${europe.date})`,
    arsPerUsd: String(peso.venta),
  };
}

"use client";
import { useRef, useState } from "react";
import type { ReferenceRates } from "@/lib/exchange";
import { pesoMarketLabels, pesoMarkets } from "@/lib/exchange";
import { currencyLabels, type Currency } from "@/lib/money";
type Reference = ReferenceRates & {
  peso: {
    date: string;
    rate: string;
    source: string;
    arsPerUsd: string;
  } | null;
};
export function RateInputs({
  currency,
  initialRate = "",
  initialDate = new Date().toISOString().slice(0, 10),
  direction = "toEur",
  rateName = "rate",
  dateName = "rate_date",
  dateLabel = "Fecha de la cotización",
  rateLabel,
}: {
  currency: Currency;
  initialRate?: string;
  initialDate?: string;
  direction?: "toEur" | "perEur";
  rateName?: string;
  dateName?: string;
  dateLabel?: string;
  rateLabel?: string;
}) {
  const [rate, setRate] = useState(initialRate),
    [day, setDay] = useState(initialDate),
    [market, setMarket] = useState(""),
    [reference, setReference] = useState<{
      rate: string;
      date: string;
      source: string;
    } | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false);
  const generation = useRef(0);

  async function consult() {
    const current = ++generation.current;
    setLoading(true);
    setError("");
    setReference(null);
    try {
      if (currency === "ARS" && !market)
        throw new Error(
          "Elegí oficial, blue o MEP, o ingresá tu cambio manualmente.",
        );
      const res = await fetch(
        `/api/rates${currency === "ARS" ? `?market=${market}` : ""}`,
      );
      const data = (await res.json()) as Reference & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "No se pudo consultar.");
      const quote =
        currency === "ARS"
          ? data.peso
          : {
              rate: data[direction][currency],
              date: data.date,
              source: data.source,
            };
      if (!quote) throw new Error("No hay referencia disponible.");
      if (current === generation.current) setReference(quote);
    } catch (e) {
      if (current === generation.current)
        setError(
          e instanceof Error
            ? e.message
            : "No se pudo consultar. Usá el cambio manual.",
        );
    } finally {
      if (current === generation.current) setLoading(false);
    }
  }
  return (
    <>
      <div className="form-grid">
        <label>
          {rateLabel ?? `EUR por 1 ${currency}`}
          <input
            name={rateName}
            inputMode="decimal"
            required
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            placeholder="Ingresá tu cambio o consultá una referencia"
          />
        </label>
        <label>
          {dateLabel}
          <input
            type="date"
            name={dateName}
            required
            value={day}
            onChange={(e) => setDay(e.target.value)}
          />
        </label>
      </div>
      {currency === "ARS" && (
        <label>
          Referencia argentina
          <select
            value={market}
            onChange={(e) => {
              generation.current++;
              setLoading(false);
              setReference(null);
              setError("");
              setMarket(e.target.value);
            }}
          >
            <option value="">Elegí una referencia · o usá cambio manual</option>
            {pesoMarkets.map((m) => (
              <option key={m} value={m}>
                {pesoMarketLabels[m]} · precio de venta
              </option>
            ))}
          </select>
        </label>
      )}
      <button
        type="button"
        className="button secondary small"
        disabled={loading}
        onClick={consult}
      >
        {loading ? "Consultando…" : "Consultar cotización online"}
      </button>
      {error && (
        <p role="alert" className="field-help">
          {error}
        </p>
      )}
      {reference && (
        <div className="reference-quote">
          <p>
            {direction === "perEur" ? "1 EUR" : `1 ${currencyLabels[currency]}`}{" "}
            ={" "}
            <b>
              {reference.rate} {direction === "perEur" ? currency : "EUR"}
            </b>
          </p>
          <p>
            {reference.source} · Fecha: {reference.date}
          </p>
          <button
            type="button"
            className="button secondary small"
            onClick={() => {
              setRate(reference.rate);
              setDay(reference.date);
            }}
          >
            Usar esta referencia
          </button>
        </div>
      )}
      <p className="field-help">
        Referencia orientativa; puede ser del último día hábil. No incluye
        comisiones ni garantiza el cambio de tu tarjeta. Podés editarla antes de
        guardar. No modifica compras anteriores.
      </p>
    </>
  );
}

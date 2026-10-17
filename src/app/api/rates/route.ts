import { z } from "zod";
import { parseEuropeanRates, parsePesoRate, pesoMarkets } from "@/lib/exchange";
export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get("market");
  const parsed = z.enum(pesoMarkets).nullable().safeParse(raw);
  if (!parsed.success)
    return Response.json(
      { error: "Referencia de pesos inválida." },
      { status: 400 },
    );
  try {
    const response = await fetch(
      "https://api.frankfurter.dev/v1/latest?base=EUR&symbols=USD,GBP,CZK",
      { next: { revalidate: 3600 }, signal: AbortSignal.timeout(8000) },
    );
    if (!response.ok) throw new Error("Reference unavailable");
    const europe = parseEuropeanRates(await response.json());
    let peso = null;
    if (parsed.data) {
      const ar = await fetch(`https://dolarapi.com/v1/dolares/${parsed.data}`, {
        next: { revalidate: 900 },
        signal: AbortSignal.timeout(8000),
      });
      if (!ar.ok) throw new Error("ARS reference unavailable");
      peso = parsePesoRate(await ar.json(), parsed.data, europe);
    }
    return Response.json(
      { ...europe, peso },
      { headers: { "Cache-Control": "public, max-age=300" } },
    );
  } catch {
    return Response.json(
      {
        error:
          "No se pudo consultar la cotización. Podés ingresar el cambio manualmente.",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}

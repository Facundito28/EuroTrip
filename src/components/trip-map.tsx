"use client";
import { useState } from "react";
import { mapUrl } from "@/lib/agenda";
export function TripMap({ initialQuery }: { initialQuery: string }) {
  const [query, setQuery] = useState(initialQuery),
    [shown, setShown] = useState("");
  return (
    <section className="panel trip-map" aria-label="Mapa del viaje">
      <h2>Mapa del viaje</h2>
      <p>Buscá un museo, alojamiento o dirección sin salir de Travel HQ.</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (query.trim()) setShown(query.trim());
        }}
      >
        <label>
          Lugar o dirección para buscar
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            required
            maxLength={300}
            placeholder="Museo del Prado, Madrid"
          />
        </label>
        <button className="button secondary" type="submit">
          Buscar en el mapa
        </button>
      </form>
      {shown ? (
        <>
          <iframe
            key={shown}
            title={`Mapa de ${shown}`}
            src={mapUrl(shown)}
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(shown)}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Abrir en Google Maps
          </a>
        </>
      ) : (
        <p className="field-help">
          El mapa de Google se carga cuando buscás. Necesita Internet y recibe
          el lugar consultado. Confirmá que el resultado sea el correcto.
        </p>
      )}
    </section>
  );
}

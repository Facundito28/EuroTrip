"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="fatal-error">
      <h1>Hubo un problema al cargar.</h1>
      <p>
        No pudimos confirmar la conexión. Tus datos guardados no se modificaron.
      </p>
      <button className="button primary" onClick={reset}>
        Reintentar
      </button>
    </main>
  );
}

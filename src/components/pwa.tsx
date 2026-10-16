"use client";
import { useEffect, useState } from "react";
import { Download } from "lucide-react";
type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};
export function PwaRegistration() {
  useEffect(() => {
    if ("serviceWorker" in navigator && window.isSecureContext)
      navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return null;
}
export function InstallButton() {
  const [prompt, setPrompt] = useState<InstallEvent | null>(null),
    [message, setMessage] = useState("");
  useEffect(() => {
    const handle = (e: Event) => {
      e.preventDefault();
      setPrompt(e as InstallEvent);
    };
    window.addEventListener("beforeinstallprompt", handle);
    return () => window.removeEventListener("beforeinstallprompt", handle);
  }, []);
  return (
    <>
      <button
        className="button primary"
        onClick={async () => {
          if (prompt) {
            await prompt.prompt();
            await prompt.userChoice;
            setPrompt(null);
          } else {
            setMessage(
              "Abrí el menú de tu navegador y elegí Instalar aplicación o Agregar a inicio. Requiere HTTPS y un navegador compatible.",
            );
          }
        }}
      >
        <Download size={16} />
        Instalar Travel HQ
      </button>
      {message && (
        <p role="status" className="field-help">
          {message}
        </p>
      )}
    </>
  );
}

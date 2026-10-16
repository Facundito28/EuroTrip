"use client";
import { useState, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { completeReceiptUpload, prepareReceiptUpload } from "@/lib/actions";
import { receiptMetadata } from "@/lib/receipts";
const subscribe = () => () => {};
export function ReceiptUploader({
  trip,
  expense,
  description,
  done,
}: {
  trip: string;
  expense: string;
  description: string;
  done: () => void;
}) {
  const [pending, startTransition] = useTransition(),
    [phase, setPhase] = useState(""),
    [error, setError] = useState("");
  const ready = useSyncExternalStore(
      subscribe,
      () => true,
      () => false,
    ),
    router = useRouter();
  return (
    <form
      method="post"
      onSubmit={(event) => {
        event.preventDefault();
        if (pending) return;
        if (!navigator.onLine) {
          setError("Conectate a Internet antes de subir un comprobante.");
          return;
        }
        const file = new FormData(event.currentTarget).get("file");
        if (!(file instanceof File)) {
          setError("Seleccioná un archivo.");
          return;
        }
        const parsed = receiptMetadata.safeParse({
          trip_id: trip,
          expense_id: expense,
          filename: file.name.slice(0, 200),
          content_type: file.type,
          size: file.size,
        });
        if (!parsed.success) {
          setError(parsed.error.issues[0].message);
          return;
        }
        const metadata = new FormData();
        Object.entries(parsed.data).forEach(([key, value]) =>
          metadata.set(key, String(value)),
        );
        setError("");
        startTransition(async () => {
          try {
            setPhase("Preparando…");
            const prepared = await prepareReceiptUpload(metadata);
            if (!prepared.ok || !prepared.upload) {
              setError(prepared.message);
              return;
            }
            setPhase("Subiendo…");
            const body = new FormData();
            body.set("cacheControl", "3600");
            body.set("", file);
            const response = await fetch(prepared.upload.signedUrl, {
              method: "PUT",
              headers: {
                apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
                "x-upsert": "false",
              },
              body,
            });
            if (!response.ok) {
              setError(
                "No se pudo subir el archivo. Revisá tu conexión y reintentá.",
              );
              return;
            }
            setPhase("Confirmando…");
            metadata.set("path", prepared.upload.path);
            const completed = await completeReceiptUpload(metadata);
            if (!completed.ok) {
              setError(completed.message);
              return;
            }
            router.refresh();
            done();
          } catch {
            setError(
              "No se pudo confirmar la subida. Revisá tus comprobantes antes de reintentar.",
            );
          }
        });
      }}
    >
      <fieldset disabled={!ready || pending}>
        <label>
          Comprobante de {description}
          <input
            type="file"
            name="file"
            required
            accept="image/jpeg,image/png,image/webp,application/pdf"
          />
        </label>
      </fieldset>
      <p className="field-help">
        JPG, PNG, WebP o PDF. Hasta 5 MB. Subida directa al almacenamiento
        privado de tu grupo.
      </p>
      {error && (
        <p className="form-message error" role="alert">
          {error}
        </p>
      )}
      <button
        className="button primary"
        type="submit"
        disabled={!ready || pending}
      >
        {pending && <LoaderCircle size={16} className="spin" />}
        {!ready ? "Preparando…" : pending ? phase : "Subir comprobante"}
      </button>
    </form>
  );
}

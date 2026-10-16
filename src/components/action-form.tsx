"use client";
import {
  useState,
  useTransition,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import type { ActionResult } from "@/lib/actions";
const subscribe = () => () => {};
export function ActionForm({
  action,
  children,
  label = "Guardar",
  className = "",
  onSuccess,
  confirm,
}: {
  action: (data: FormData) => Promise<ActionResult>;
  children: ReactNode;
  label?: string;
  className?: string;
  onSuccess?: (result: ActionResult) => void;
  confirm?: string;
}) {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const hydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const router = useRouter();
  return (
    <form
      method="post"
      className={className}
      onSubmit={(event) => {
        event.preventDefault();
        if (pending || (confirm && !window.confirm(confirm))) return;
        if (!navigator.onLine) {
          setResult({
            ok: false,
            message:
              "Estás sin conexión. Conectate antes de guardar; no enviamos cambios offline.",
          });
          return;
        }
        const form = event.currentTarget;
        const data = new FormData(form);
        setResult(null);
        startTransition(async () => {
          try {
            const response = await action(data);
            setResult(response);
            if (response.ok) {
              if (response.redirectTo) router.push(response.redirectTo);
              router.refresh();
              onSuccess?.(response);
            }
          } catch {
            setResult({
              ok: false,
              message:
                "No se pudo confirmar el resultado. Revisá los registros antes de volver a enviar para evitar duplicados.",
            });
          }
        });
      }}
    >
      <fieldset disabled={pending || !hydrated}>{children}</fieldset>
      {result && (
        <p
          role={result.ok ? "status" : "alert"}
          className={`form-message ${result.ok ? "success" : "error"}`}
        >
          {result.message}
        </p>
      )}
      <button
        className="button primary"
        disabled={pending || !hydrated}
        type="submit"
      >
        {pending && <LoaderCircle size={16} className="spin" />}
        {!hydrated ? "Preparando…" : pending ? "Guardando…" : label}
      </button>
    </form>
  );
}
export function HiddenTrip({ id }: { id: string }) {
  return <input type="hidden" name="trip_id" value={id} />;
}

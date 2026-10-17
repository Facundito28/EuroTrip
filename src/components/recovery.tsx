"use client";
import { useState, type FormEvent } from "react";
import { generateRecoveryCodes } from "@/lib/actions";
import { ActionForm } from "./action-form";
import { PasswordInputs } from "./password-forms";
export function RecoveryCodes() {
  const [codes, setCodes] = useState<string[]>([]);
  return (
    <section className="panel">
      <h2>Recuperar tu cuenta</h2>
      <p>
        Prepará tus códigos antes del viaje. Si olvidás tu contraseña, uno de
        estos códigos te permite crear otra, sin correos ni servicios pagos.
      </p>
      <details>
        <summary>Generar códigos de recuperación</summary>
        <p className="field-help">
          Se crean 8 códigos de un solo uso. Generar otros invalida los
          anteriores. Guardalos en tu gestor de contraseñas o en un lugar seguro
          fuera de esta app.
        </p>
        <ActionForm
          action={generateRecoveryCodes}
          label="Generar mis códigos"
          onSuccess={(r) => setCodes(r.recoveryCodes ?? [])}
        >
          <label>
            Confirmá tu contraseña para generar códigos
            <input
              name="current_password"
              type="password"
              autoComplete="current-password"
              required
              maxLength={72}
            />
          </label>
        </ActionForm>
      </details>
      {codes.length > 0 && (
        <div className="recovery-codes">
          <p role="status">
            Se muestran solo ahora. No compartas estos códigos: permiten entrar
            a tu cuenta.
          </p>
          <pre>{codes.join("\n")}</pre>
          <button
            type="button"
            className="button secondary"
            onClick={() => {
              const blob = new Blob(
                [
                  "EuroTrip 2027 — Códigos privados de recuperación\nCada código sirve una sola vez. No los compartas.\n\n" +
                    codes.join("\n"),
                ],
                { type: "text/plain" },
              );
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "eurotrip-codigos-privados.txt";
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            Descargar códigos
          </button>
          <button
            type="button"
            className="text-button"
            onClick={() => setCodes([])}
          >
            Ya los guardé · ocultar
          </button>
        </div>
      )}
    </section>
  );
}
export function RecoveryForm() {
  const [pending, setPending] = useState(false),
    [message, setMessage] = useState(""),
    [done, setDone] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = new FormData(event.currentTarget);
    if (form.get("password") !== form.get("password_confirm")) {
      setMessage("Las contraseñas no coinciden.");
      return;
    }
    setPending(true);
    setMessage("");
    try {
      const response = await fetch("/api/recovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: String(form.get("email")),
          code: String(form.get("code")).trim().toLowerCase(),
          password: String(form.get("password")),
        }),
      });
      setMessage((await response.json()).message);
      setDone(response.ok);
    } catch {
      setMessage("No se pudo conectar. Reintentá más tarde.");
    } finally {
      setPending(false);
    }
  }
  return (
    <form onSubmit={submit}>
      <fieldset disabled={pending || done}>
        <label>
          Correo electrónico
          <input name="email" type="email" autoComplete="email" required />
        </label>
        <label>
          Código de recuperación
          <input
            name="code"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            minLength={32}
            maxLength={32}
            required
          />
        </label>
        <PasswordInputs registration />
      </fieldset>
      {message && (
        <p
          role={done ? "status" : "alert"}
          className={`form-message ${done ? "success" : "error"}`}
        >
          {message}
        </p>
      )}
      {!done && (
        <button className="button primary" disabled={pending}>
          {pending ? "Comprobando…" : "Restablecer contraseña"}
        </button>
      )}
    </form>
  );
}

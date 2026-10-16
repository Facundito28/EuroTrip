"use client";
import { useState, useSyncExternalStore } from "react";
import { changePassword, joinTrip } from "@/lib/actions";
import { ActionForm } from "./action-form";
const subscribe = (callback: () => void) => {
  window.addEventListener("hashchange", callback);
  return () => window.removeEventListener("hashchange", callback);
};
export function PasswordInputs({
  registration = false,
}: {
  registration?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <>
      <label>
        {registration ? "Elegí una contraseña" : "Contraseña"}
        <input
          name="password"
          type={visible ? "text" : "password"}
          autoComplete={registration ? "new-password" : "current-password"}
          minLength={registration ? 12 : 1}
          maxLength={72}
          required
        />
      </label>
      {registration && (
        <label>
          Repetí la contraseña
          <input
            name="password_confirm"
            type={visible ? "text" : "password"}
            autoComplete="new-password"
            minLength={12}
            maxLength={72}
            required
          />
        </label>
      )}
      <button
        type="button"
        className="text-button password-toggle"
        aria-pressed={visible}
        onClick={() => setVisible(!visible)}
      >
        {visible ? "Ocultar contraseña" : "Mostrar contraseña"}
      </button>
      {registration && (
        <p className="field-help">
          Al menos 12 caracteres. Podés usar una frase larga que recuerdes o un
          gestor de contraseñas.
        </p>
      )}
    </>
  );
}
export function JoinForm() {
  const code = useSyncExternalStore(
    subscribe,
    () =>
      new URLSearchParams(window.location.hash.slice(1)).get("invite") ?? "",
    () => "",
  );
  return (
    <ActionForm
      action={joinTrip}
      label="Unirme al viaje"
      onSuccess={() =>
        window.history.replaceState(
          null,
          "",
          window.location.pathname + window.location.search,
        )
      }
    >
      <label>
        Código de invitación
        <input
          key={code}
          name="code"
          defaultValue={code}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={32}
          required
          placeholder="Pegá el código del organizador"
        />
      </label>
      <p className="field-help">
        Usá el mismo correo al que se emitió la invitación. El código vence a
        los 7 días y se usa una sola vez.
      </p>
    </ActionForm>
  );
}
export function ChangePasswordForm() {
  return (
    <ActionForm action={changePassword} label="Cambiar contraseña">
      <label>
        Contraseña actual
        <input
          name="current_password"
          type="password"
          required
          autoComplete="current-password"
          maxLength={72}
        />
      </label>
      <PasswordInputs registration />
    </ActionForm>
  );
}

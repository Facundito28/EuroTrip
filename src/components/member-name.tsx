"use client";
import { useState } from "react";
import { saveMemberName } from "@/lib/actions";
import type { Member } from "@/lib/types";
import { ActionForm, HiddenTrip } from "./action-form";
export function MemberName({
  member,
  self,
}: {
  member: Member;
  self: boolean;
}) {
  const [editing, setEditing] = useState(false);
  return (
    <div className="member-name-editor">
      {editing ? (
        <>
          <ActionForm
            action={saveMemberName}
            label="Guardar nombre"
            onSuccess={() => setEditing(false)}
          >
            <HiddenTrip id={member.trip_id} />
            <input name="member_id" type="hidden" value={member.user_id} />
            <label>
              {self ? "Mi nombre" : "Nombre del integrante"}
              <input
                name="display_name"
                required
                maxLength={80}
                defaultValue={member.display_name}
                autoComplete="nickname"
              />
            </label>
            <p className="field-help">
              Así aparecerá en el viaje, los gastos y los saldos.
            </p>
          </ActionForm>
          <button
            type="button"
            className="text-button"
            onClick={() => setEditing(false)}
          >
            Cancelar
          </button>
        </>
      ) : (
        <button
          type="button"
          className="text-button"
          onClick={() => setEditing(true)}
        >
          {self ? "Editar mi nombre" : "Editar nombre"}
        </button>
      )}
    </div>
  );
}

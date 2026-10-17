import Link from "next/link";
import { RecoveryForm } from "@/components/recovery";
export default function Recover() {
  return (
    <main className="access-shell">
      <section className="panel recovery-page">
        <h1>Recuperar mi cuenta</h1>
        <p>
          Usá uno de los códigos que guardaste en Ajustes. Cada código funciona
          una sola vez.
        </p>
        <RecoveryForm />
        <p className="field-help">
          Si todavía no generaste códigos, necesitás ayuda del organizador y del
          administrador del proyecto. No enviamos enlaces por correo.
        </p>
        <Link className="button secondary" href="/">
          Volver al inicio
        </Link>
      </section>
    </main>
  );
}

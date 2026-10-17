"use client";
import Link from "next/link";
import { useState } from "react";
import {
  ArrowUpRight,
  Compass,
  LockKeyhole,
  Wallet,
  Route,
  Users,
  LogOut,
} from "lucide-react";
import { createTrip, login, register, logout } from "@/lib/actions";
import { ActionForm } from "./action-form";
import { JoinForm, PasswordInputs } from "./password-forms";
export function AccessScreen({
  mode,
  error,
  email,
}: {
  mode: "setup" | "login" | "create" | "error";
  error?: string;
  email?: string;
}) {
  const [signup, setSignup] = useState(false);
  return (
    <main className="access-shell">
      <div className="access-brand">
        <span className="brand-icon">
          <Compass />
        </span>
        <span>
          EUROTRIP <b>2027</b>
          <small>TRAVEL HQ</small>
        </span>
      </div>
      <section className="access-grid">
        <div className="access-intro">
          <span className="eyebrow">CUATRO AMIGOS. UN GRAN VIAJE.</span>
          <h1>
            Más Europa.
            <br />
            <span>Menos cuentas.</span>
          </h1>
          <p>
            Todo el viaje en un solo lugar. Presupuesto claro, gastos
            compartidos y planes que cierran.
          </p>
          <div className="intro-route">
            22 ABR — 19 MAY 2027 <ArrowUpRight size={18} />
          </div>
          <div className="intro-features">
            <span>
              <Wallet />
              Cada euro, en orden
            </span>
            <span>
              <Users />
              Cuentas claras entre amigos
            </span>
            <span>
              <Route />
              Un itinerario compartido
            </span>
          </div>
          <div className="orbit-art" aria-hidden="true">
            <i />
            <i />
            <i />
            <span>
              EU
              <br />
              27
            </span>
          </div>
        </div>
        <div className="access-card">
          <span className="eyebrow">TU CENTRO DE OPERACIONES</span>
          {mode === "setup" ? (
            <>
              <h2>Conectemos el viaje</h2>
              <p>
                La aplicación está instalada. Falta conectar tu proyecto de
                Supabase para guardar datos reales.
              </p>
              <ol className="setup-steps">
                <li>
                  Aplicá la migración SQL de <code>supabase/migrations</code> en
                  tu proyecto.
                </li>
                <li>
                  Configurá <code>NEXT_PUBLIC_SUPABASE_URL</code> y{" "}
                  <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code> en{" "}
                  <code>.env.local</code> o en Vercel.
                </li>
                <li>
                  Configurá el acceso con contraseña según el README y reiniciá
                  la aplicación.
                </li>
              </ol>
              <div className="notice">
                <LockKeyhole size={18} /> No usamos datos ficticios ni guardamos
                información sin conexión.
              </div>
            </>
          ) : mode === "error" ? (
            <>
              <h2>No pudimos cargar el viaje</h2>
              <p role="alert" className="form-message error">
                {error}
              </p>
              <p>
                La sesión puede estar activa, pero todavía no podemos confirmar
                el acceso a los datos.
              </p>
              <button
                className="button primary"
                onClick={() => window.location.reload()}
              >
                Reintentar
              </button>
              <form action={logout}>
                <button className="button ghost">Cerrar sesión</button>
              </form>
            </>
          ) : mode === "create" ? (
            <>
              <h2>El viaje empieza acá</h2>
              <p>
                Ingresaste como <strong>{email}</strong>. Si te invitaron, pegá
                el código que te compartió el organizador.
              </p>
              <JoinForm />
              <details className="create-trip-details">
                <summary>Soy el organizador: crear un viaje</summary>
                <ActionForm action={createTrip} label="Crear mi viaje">
                  <label>
                    Tu nombre
                    <input
                      name="display_name"
                      placeholder="¿Cómo te dicen?"
                      required
                      maxLength={80}
                    />
                  </label>
                  <label>
                    Nombre del viaje
                    <input
                      name="name"
                      defaultValue="EuroTrip 2027"
                      required
                      maxLength={100}
                    />
                  </label>
                </ActionForm>
                <p className="muted small">
                  El grupo empieza sin gastos ni presupuesto. Después podés
                  invitar a tres amigos.
                </p>
              </details>
              <form action={logout}>
                <button className="button ghost">
                  <LogOut size={16} />
                  Cambiar de cuenta
                </button>
              </form>
            </>
          ) : (
            <>
              <h2>{signup ? "Creá tu cuenta" : "Bienvenido al viaje"}</h2>
              <p>
                Ingresá con correo y contraseña. Para acceder al viaje de tus
                amigos necesitás su código de invitación.
              </p>
              <div
                className="auth-tabs"
                role="group"
                aria-label="Acceso a la cuenta"
              >
                <button aria-pressed={!signup} onClick={() => setSignup(false)}>
                  Ingresar
                </button>
                <button aria-pressed={signup} onClick={() => setSignup(true)}>
                  Crear cuenta
                </button>
              </div>
              <ActionForm
                key={signup ? "register" : "login"}
                action={signup ? register : login}
                label={signup ? "Crear mi cuenta" : "Entrar a Travel HQ"}
              >
                <label>
                  Correo electrónico
                  <input
                    type="email"
                    name="email"
                    placeholder="vos@ejemplo.com"
                    autoComplete="email"
                    required
                    maxLength={254}
                  />
                </label>
                <PasswordInputs registration={signup} />
                {!signup && (
                  <Link href="/recuperar" className="text-button">
                    Olvidé mi contraseña
                  </Link>
                )}
              </ActionForm>
              <p className="field-help auth-help">
                No enviamos correos ni códigos de acceso. Guardá tu contraseña:
                la recuperación por correo no está habilitada.
              </p>
              <div className="notice">
                <LockKeyhole size={16} />
                Tu correo identifica la cuenta. Solo una invitación privada
                válida permite entrar a un grupo existente.
              </div>
            </>
          )}
        </div>
      </section>
      <footer className="access-footer">
        EUROTRIP 2027 · HECHO PARA VIAJAR JUNTOS
      </footer>
    </main>
  );
}

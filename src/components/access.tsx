"use client";
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
import { createTrip, login, verifyOtp, logout } from "@/lib/actions";
import { ActionForm } from "./action-form";
export function AccessScreen({
  mode,
  error,
  email,
}: {
  mode: "setup" | "login" | "create" | "error";
  error?: string;
  email?: string;
}) {
  const [sent, setSent] = useState(false),
    [address, setAddress] = useState("");
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
                  Configurá el correo de acceso con código según el README y
                  reiniciá la aplicación.
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
                Ingresaste como <strong>{email}</strong>. Si te invitaron,
                comprobá que sea el correo autorizado. Si sos el organizador,
                creá el grupo.
              </p>
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
                El grupo empieza vacío, con presupuesto sin definir y sin
                gastos. Podés invitar a tres amigos.
              </p>
              <form action={logout}>
                <button className="button ghost">
                  <LogOut size={16} />
                  Cambiar de cuenta
                </button>
              </form>
            </>
          ) : (
            <>
              <h2>{sent ? "Revisá tu correo" : "Bienvenido al viaje"}</h2>
              <p>
                {sent
                  ? "Ingresá el código que recibiste. No compartas este código con nadie."
                  : "Ingresá con tu correo. Si estás invitado, te sumaremos automáticamente a tu grupo."}
              </p>
              {!sent ? (
                <ActionForm
                  action={login}
                  label="Recibir código de acceso"
                  onSuccess={() => setSent(true)}
                >
                  <label>
                    Correo electrónico
                    <input
                      type="email"
                      name="email"
                      placeholder="vos@ejemplo.com"
                      autoComplete="email"
                      required
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                    />
                  </label>
                </ActionForm>
              ) : (
                <>
                  <ActionForm action={verifyOtp} label="Entrar a Travel HQ">
                    <input type="hidden" name="email" value={address} />
                    <label>
                      Código enviado a {address}
                      <input
                        name="token"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        pattern="[0-9]{6,10}"
                        maxLength={10}
                        required
                        placeholder="Código de acceso"
                      />
                    </label>
                  </ActionForm>
                  <button
                    className="button ghost"
                    onClick={() => setSent(false)}
                  >
                    Cambiar correo o pedir otro código
                  </button>
                </>
              )}
              <div className="notice">
                <LockKeyhole size={16} />
                Acceso seguro. Solo tus compañeros pueden ver tu viaje.
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

# EuroTrip 2027 — Travel HQ

Aplicación privada en español para el presupuesto, los gastos compartidos y el itinerario de cuatro viajeros. Next.js App Router, TypeScript, Tailwind CSS y Supabase (Auth, PostgreSQL y Storage). Preparada para Vercel y para instalarse como PWA.

**No contiene gastos, viajeros ni precios de demostración.** El organizador crea el grupo, define su presupuesto e invita hasta tres compañeros por correo. El recorrido inicial es Madrid, Lisboa, Oporto, Londres, Róterdam, Ámsterdam, Bélgica, París y Madrid; las fechas generales son 22/04–19/05/2027. Las fechas de cada parada se cargan manualmente.

## Requisitos

- Node.js 24 y npm 11 (versiones indicadas en `.nvmrc` y `package.json`).
- Un proyecto de Supabase con acceso al SQL Editor y a la configuración de Auth.
- Para publicar: repositorio GitHub con este código y un proyecto Vercel. Crear commits no publica la aplicación.

## Desarrollo local

```bash
npm ci
cp .env.example .env.local
# Completar las dos variables con datos de tu proyecto.
npm run dev
```

Las variables son:

| Variable                               | Valor                                           |
| -------------------------------------- | ----------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | URL HTTPS del proyecto                          |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Clave `sb_publishable_…` de Settings → API Keys |

Ambos valores se usan en el navegador por diseño de Supabase. La autorización depende de Auth y RLS, nunca de esconder esta clave. **No utilizar `service_role`, `sb_secret_…`, contraseñas de base de datos ni tokens administrativos en estas variables.** `.env.local` está ignorado por Git. Las variables `NEXT_PUBLIC_*` quedan incorporadas al compilar: después de cambiarlas hay que reiniciar desarrollo o recompilar producción.

Sin configuración, la página muestra instrucciones; no simula una aplicación conectada.

## Preparar Supabase (una vez)

1. Abrir SQL Editor en el proyecto correcto y ejecutar **completo** [`supabase/migrations/202610160001_travel_hq.sql`](supabase/migrations/202610160001_travel_hq.sql). La migración es transaccional y crea tablas, funciones, permisos, índices, políticas y el bucket privado `receipts`. No volver a ejecutar una migración ya aplicada. Alternativamente, con Supabase CLI autenticada, inicializar primero su configuración local con `supabase init` si no existe; luego `supabase link --project-ref TU_REFERENCIA` y `supabase db push`.
2. En Authentication → Providers, habilitar Email. La app usa código por correo, sin contraseña.
3. En Authentication → Email Templates → Magic Link, incluir el código `{{ .Token }}` en el cuerpo del correo. Por ejemplo: `<h2>Tu código de Travel HQ</h2><p>{{ .Token }}</p><p>No compartas este código.</p>`. El usuario debe copiar el código, no depender de un enlace. El formulario acepta códigos de 6 a 10 dígitos según la configuración del proyecto.
4. Configurar Site URL y Redirect URLs con el dominio real al publicar. La ruta `/auth/confirm` admite enlaces configurados con `token_hash` y tipo email; el flujo principal de la app utiliza OTP.
5. **Para que reciban correos los cuatro amigos, configurar SMTP propio en Supabase.** El servicio de correo predeterminado de Supabase limita destinatarios y envíos; una clave publicable no puede modificar esta configuración. Respetar los límites y expiración de OTP del proyecto.
6. Entrar con el correo del organizador y crear el viaje. En Equipo, autorizar los correos de los tres amigos. Compartirles la URL de la app. Cada uno ingresa con su propio correo y el código recibido; la invitación se acepta solo con correo confirmado. Autorizar un correo no envía un mensaje de invitación.

La clave publicable permite usar la app, pero **no permite aplicar migraciones ni administrar Auth**. No hay credenciales administrativas en el servidor Next.js.

## Administración segura opcional

Para que Codex aplique la migración por API, cargar un token personal dedicado de Supabase en los ajustes seguros del entorno como `SUPABASE_ACCESS_TOKEN`, con destino permitido `api.supabase.com`. No pegarlo en el chat, no guardarlo en archivos del repositorio y no configurarlo en Vercel: la app no lo necesita.

El helper administrativo no se importa desde la aplicación. Con la credencial disponible:

```bash
python3 scripts/supabase_admin.py status --project-ref TU_REFERENCIA
python3 scripts/supabase_admin.py apply --project-ref TU_REFERENCIA
python3 scripts/supabase_admin.py configure-otp --project-ref TU_REFERENCIA
```

`status` consulta sin modificar. `apply` se niega a reaplicar si ya existe alguna de las tablas. `configure-otp` cambia únicamente el cuerpo de la plantilla Magic Link para incluir el código; no envía correos ni cambia SMTP, dominios o expiración. Los resultados muestran conteos y estados, nunca valores de secretos. Una vez completada la administración, se puede revocar el token.

Después de aplicar SQL por el editor o la API, si se pasa a gestionar migraciones con CLI, vincular el proyecto y registrar esta versión como aplicada mediante `supabase migration repair 202610160001 --status applied` antes de `supabase db push`. No intentar recrear las tablas existentes.

## Qué se puede usar

- **Resumen financiero:** presupuesto grupal, referencia por viajero (cuatro previstos), pagos efectivos, reservas pendientes, disponible, proyección y gráfico por categoría. Un presupuesto de cero se muestra como no definido.
- **Gastos:** crear, editar, filtrar y eliminar gastos; marcar una reserva o estimación como pagada sin crear otro gasto; importe original, moneda, pagador, fecha, cotización manual, participantes y notas. El grupo puede corregir gastos compartidos.
- **Reparto:** partes iguales entre uno, dos, tres o cuatro participantes seleccionados. El pagador puede no participar del consumo. Los saldos usan solo gastos pagados.
- **Transferencias internas:** registro en las cuatro monedas, compensación de deudas y propuesta de transferencias en EUR. No se ejecutan movimientos bancarios. Solo el creador o el organizador puede eliminar una transferencia.
- **Itinerario:** calendario mensual con planes por día, recorrido editable, eventos por fecha para alojamiento, transporte o actividad, notas y vinculación opcional a un gasto. El gasto vinculado sigue siendo único. No se asignan fechas ni reservas ficticias a las ciudades.
- **Comprobantes:** PDF, JPG, PNG o WebP de hasta 5 MiB, guardados en Storage privado y descargables por integrantes con enlaces que vencen en 60 segundos.
- **Escenarios:** alternativas con sus propios conceptos, cotizaciones manuales, fuente y grado de certeza (estimado, cotizado o confirmado). Los escenarios no suman consumos. La diferencia respecto de la primera alternativa solo tiene sentido si se compara el mismo alcance.
- **Equipo:** organizador e invitados, hasta cuatro lugares incluyendo invitaciones pendientes. Se pueden revocar invitaciones sin aceptar. No se borran integrantes con historial financiero.
- **Exportación CSV:** gastos con importes originales, estado, pagador, fecha de cotización y equivalente en EUR. Delimitado por punto y coma, UTF-8 con BOM y protección contra fórmulas de hoja de cálculo. Las transferencias no se exportan como gastos.
- **PWA:** manifiesto, iconos e instalación desde navegadores compatibles. En iPhone/iPad: Safari → Compartir → Agregar a inicio. La app tiene interfaz oscura y diseño adaptable. Los datos se actualizan después de guardar, al volver a la ventana y cada 45 segundos mientras está visible.

### Reglas financieras

Los importes se guardan como enteros en centavos (`bigint` en PostgreSQL). EUR, USD, GBP y ARS tienen dos decimales. No se aceptan separadores de miles en formularios ni más de dos decimales en importes.

La cotización representa **EUR por una unidad de la moneda original**, tiene hasta ocho decimales y conserva su fecha. Es manual: la aplicación no promete cotizaciones en vivo. EUR siempre tiene cotización 1. Se convierte una vez usando aritmética decimal exacta en PostgreSQL y `BigInt` en TypeScript, con redondeo de mitades hacia arriba. Las cotizaciones se devuelven como texto para conservar su precisión.

El equivalente en EUR se divide entre los participantes; los centavos sobrantes van a los primeros UUID ordenados. Las cuotas siempre suman exactamente el total. El importe máximo por operación y su equivalente es 1.000.000.000.000 centavos. No se permiten operaciones que redondeen a menos de un centavo EUR.

```
Disponible = presupuesto − pagado − reservado
Proyección = pagado + reservado + estimado
Saldo de integrante = pagos realizados − cuotas de consumos + transferencias enviadas − recibidas
```

Saldo positivo significa que debe recibir; negativo, que debe devolver. Cambiar reservado → pagado reclasifica el mismo gasto. Al marcar pagado se confirma el importe y la cotización guardados; si cambiaron, editar antes. La fecha del gasto se puede corregir al editar.

Crear gastos utiliza una función SQL transaccional: gasto y cuotas se guardan juntos. Cada formulario de creación lleva un identificador de solicitud para no duplicar gastos o transferencias por reenvío. Abrir un formulario nuevo para un movimiento nuevo genera otro identificador. Si se pierde la respuesta, revisar el listado antes de repetir la operación. El resumen se obtiene con un único snapshot SQL consistente.

### Alcance actual

Los pagos son completos y tienen **un pagador por gasto**. Para consumos pagados por más de una persona se cargan los importes efectivamente pagados por cada una como movimientos separados, distribuidos entre los participantes correspondientes. No hay pagos parciales de una misma reserva, reparto por porcentajes/cuotas personalizadas, sincronización bancaria, OCR, reservas de proveedores ni cotizaciones automáticas.

La PWA requiere conexión para consultar y guardar datos. Muestra una pantalla de desconexión y **no almacena HTML autenticado ni información financiera en el caché del service worker**. No hay cola de gastos offline ni notificaciones push. Storage y PostgreSQL no comparten una transacción: si una descarga/subida se interrumpe puede requerir reintento. No es un sistema de auditoría contable inmutable: los integrantes pueden editar los gastos del grupo. Las ediciones concurrentes del mismo gasto se serializan en base de datos y prevalece la última edición guardada.

## Validación

```bash
npm run test        # Dinero, balances, CSV y migración/RLS en PostgreSQL WASM (PGlite)
npm run typecheck
npm run lint
npm run build
npm exec playwright install chromium
npm run test:e2e
```

Las pruebas de base de datos aplican la migración completa y verifican roles, invitados, máximo de integrantes, centavos, reintentos, permisos del ledger y aislamiento de objetos de comprobantes. PGlite ejecuta PostgreSQL real; las tablas de Auth y Storage del proveedor se reproducen solo en el entorno de pruebas.

Las pruebas de navegador levantan Next.js y un adaptador **exclusivo de tests** sobre esa base aislada. Simulan identidad por correo sin enviar mensajes; ejercitan las acciones reales de la aplicación y sus funciones SQL en escritorio y tamaño iPhone. Los correos y el código de prueba viven solo en `tests/`; el código de acceso de prueba no funciona con Supabase real. No hay un modo demo en la aplicación. Para usar un Chromium preinstalado: `PLAYWRIGHT_EXECUTABLE_PATH=/ruta/al/chromium npm run test:e2e`.

Estas pruebas **no sustituyen la validación de tu proyecto Supabase**: hay que comprobar allí entrega de OTP, cuatro cuentas, RLS remota, carga/descarga real en Storage y sesiones. Tampoco prueban una publicación Vercel.

## Desplegar en Vercel

La preparación del repositorio no publica nada. Después de autorizar la publicación:

1. Subir la rama revisada a GitHub. Elegir conscientemente la rama de producción; no se requiere hacer merge a `main` para revisar el código. Los proyectos Vercel ya conectados pueden desplegar automáticamente al recibir un push.
2. Importar el repositorio en Vercel, preset Next.js, raíz del repositorio, Node.js 24. Comando de instalación `npm ci`; build `npm run build`. No hace falta `vercel.json` ni servidor persistente.
3. Configurar ambas variables de entorno para Production y para los Preview que se quieran usar. Los previews deben apuntar preferentemente a un Supabase de pruebas para evitar cambios accidentales en datos reales.
4. Aplicar la migración y configurar Auth/SMTP según la sección anterior; definir el dominio final en Supabase Auth.
5. Desplegar. Comprobar acceso por correo, invitaciones, gastos, transferencia, comprobante, CSV e instalación PWA en el dominio HTTPS.

El workflow de GitHub Actions solo valida e instala navegadores para pruebas; no publica ni hace merge.

## Organización

```
src/app/                 Rutas Next.js, exportación y descarga autenticadas
src/components/          Pantallas, formularios y PWA
src/lib/actions.ts       Mutaciones del servidor con validación Zod
src/lib/money.ts          Aritmética exacta y conversiones
src/lib/finance.ts        Totales, balances y compensaciones
src/lib/supabase/         Cliente SSR con cookies
src/proxy.ts             Renovación de sesiones; respuestas privadas
supabase/migrations/     Esquema, RPC, índices, RLS y bucket privado
tests/                   Pruebas unitarias, SQL y navegador aislado
```

## Seguridad y operación

- Cookies de sesión HttpOnly y SameSite=Lax; Secure en producción. No se requiere acceso al token desde JavaScript del navegador.
- RLS en todas las tablas. Funciones privadas con `search_path` fijado; RPCs privilegiadas solo para usuarios autenticados y con verificación de membresía.
- El dueño del viaje no puede cambiarse desde la API. Los invitados no pueden alterar miembros ni cuotas financieras directamente.
- Los comprobantes se descargan solo después de verificar sesión y RLS. No usar URLs públicas del bucket.
- Nunca subir `.env.local`, credenciales o tokens. Rotar cualquier contraseña compartida por chat. La clave publicable no es una clave administrativa.
- Habilitar copias de seguridad en Supabase según el plan; Storage requiere su estrategia de respaldo además de la base de datos. No borrar usuarios con movimientos financieros.
- Si la red cloud bloquea el proyecto con `Tunnel connection failed: 403 Forbidden`, habilitar el hostname exacto `TU_PROYECTO.supabase.co` en el entorno. Eso es distinto de un error de Auth o RLS del proveedor.

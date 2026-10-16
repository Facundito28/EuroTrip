# EuroTrip 2027 — Travel HQ

Aplicación privada en español para el presupuesto, los gastos compartidos y el itinerario de cuatro viajeros. Next.js App Router, TypeScript, Tailwind CSS y Supabase (Auth, PostgreSQL y Storage). Preparada para Vercel y para instalarse como PWA.

**No contiene gastos, viajeros ni precios de demostración.** El organizador crea el grupo, define su presupuesto e invita hasta tres compañeros con códigos privados asociados a sus correos. El recorrido inicial es Madrid, Lisboa, Oporto, Londres, Róterdam, Ámsterdam, Bélgica, París y Madrid; las fechas generales son 22/04–19/05/2027. Las fechas de cada parada se cargan manualmente.

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

La aplicación funciona con **correo y contraseña, sin SMTP ni envío de correos**. Para entrar a un viaje existente también se exige una invitación privada de un solo uso. No es necesario cambiar de plan por la limitación de plantillas del proveedor gratuito.

1. Ejecutar en orden todas las migraciones de `supabase/migrations`. Si la primera ya está aplicada, ejecutar solamente `202610160002_password_invitations.sql`. No volver a ejecutar migraciones instaladas.
2. En Authentication → Providers → Email: habilitar Email y desactivar **Confirm email**. Habilitar nuevos registros y establecer una contraseña mínima de 12 caracteres. **Primero aplicar la segunda migración:** desactiva expresamente el antiguo ingreso al grupo basado únicamente en el correo.
3. El organizador crea su cuenta desde la app con correo y contraseña; luego abre “Soy el organizador: crear un viaje”. No se manda ningún correo.
4. En Equipo, el organizador genera una invitación para el correo de cada amigo y comparte el código en privado. El amigo crea su cuenta con ese mismo correo y pega el código en “Unirme al viaje”.
5. El código vence a los siete días, se usa una vez y se guarda en la base de datos únicamente como hash SHA-256. Si se pierde o vence, el organizador puede revocar y generar otro. Regenerarlo invalida el anterior. Los cuatro lugares incluyen las invitaciones pendientes.

El correo identifica la cuenta, pero **no se verifica su propiedad**. Por eso coincidir con el correo de una invitación nunca otorga acceso: siempre se exige poseer el código privado. Alguien que se registre sin invitación solo puede crear su propio grupo independiente; no puede ver el viaje de los cuatro amigos.

Guardá la contraseña en un gestor. Se puede cambiar desde Configuración, confirmando la actual. **La recuperación de contraseña por correo no está disponible sin SMTP.** Ante pérdida de acceso se requiere una recuperación administrativa con comprobación de identidad; la app no permite saltarse la contraseña ni recuperar cuentas por conocer un correo. No se permite editar el correo de la cuenta desde la interfaz.

Con Supabase CLI: inicializar su configuración si falta con `supabase init`, vincular mediante `supabase link --project-ref TU_REFERENCIA` y usar `supabase db push`. Después de aplicar SQL por el editor o por API, registrar las versiones aplicadas con `supabase migration repair VERSION --status applied` antes de utilizar `db push`.

## Administración segura opcional

El token personal dedicado `SUPABASE_ACCESS_TOKEN` solo se utiliza desde el entorno administrativo con destino `api.supabase.com`. No debe guardarse en Git, pegarse en chat ni configurarse en Vercel. La aplicación no lo necesita.

```bash
python3 scripts/supabase_admin.py status --project-ref TU_REFERENCIA
# Solo en un proyecto sin las tablas base:
python3 scripts/supabase_admin.py apply --project-ref TU_REFERENCIA
python3 scripts/supabase_admin.py upgrade-password --project-ref TU_REFERENCIA
python3 scripts/supabase_admin.py configure-password --project-ref TU_REFERENCIA
```

El helper se niega a habilitar registro sin confirmación hasta comprobar que está instalada la protección de invitaciones privadas. No cambia plantillas, SMTP, plan ni dominio. `configure-otp` se conserva solo para administraciones futuras con un proveedor de correo habilitado; no es parte del flujo actual.

Para una verificación explícita en el proyecto real configurado en el script:

```bash
python3 scripts/verify_supabase.py
```

Este comando administrativo crea cinco cuentas temporales, valida registro/contraseña, acceso de cuatro integrantes por invitación, rechazo de la quinta cuenta, conversión, reparto, deduplicación y archivos privados; después elimina los objetos, registros y cuentas creados. Obtiene una clave administrativa de limpieza exclusivamente en memoria; nunca la registra ni la entrega al frontend. No se ejecuta en CI ni al arrancar la app. No imprime contraseñas, códigos, tokens ni enlaces firmados. Si falla la limpieza, lo informa expresamente para completar la eliminación antes de dar el entorno por validado.

## Qué se puede usar

- **Resumen financiero:** presupuesto grupal, referencia por viajero (cuatro previstos), pagos efectivos, reservas pendientes, disponible, proyección y gráfico por categoría. Un presupuesto de cero se muestra como no definido.
- **Gastos:** crear, editar, filtrar y eliminar gastos; marcar una reserva o estimación como pagada sin crear otro gasto; importe original, moneda, pagador, fecha, cotización manual, participantes y notas. El grupo puede corregir gastos compartidos.
- **Reparto:** partes iguales entre uno, dos, tres o cuatro participantes seleccionados. El pagador puede no participar del consumo. Los saldos usan solo gastos pagados.
- **Transferencias internas:** registro en las cuatro monedas, compensación de deudas y propuesta de transferencias en EUR. No se ejecutan movimientos bancarios. Solo el creador o el organizador puede eliminar una transferencia.
- **Itinerario:** calendario mensual con planes por día, recorrido editable, eventos por fecha para alojamiento, transporte o actividad, notas y vinculación opcional a un gasto. El gasto vinculado sigue siendo único. No se asignan fechas ni reservas ficticias a las ciudades.
- **Comprobantes:** PDF, JPG, PNG o WebP de hasta 5 MiB, subidos directamente a Storage mediante autorización firmada (sin atravesar el límite de cuerpo de Vercel), verificados por el servidor y descargables por integrantes con enlaces que vencen en 60 segundos.
- **Escenarios:** alternativas con sus propios conceptos, cotizaciones manuales, fuente y grado de certeza (estimado, cotizado o confirmado). Los escenarios no suman consumos. La diferencia respecto de la primera alternativa solo tiene sentido si se compara el mismo alcance.
- **Equipo:** organizador e invitados con códigos privados, hasta cuatro lugares incluyendo invitaciones pendientes. Se pueden revocar invitaciones sin aceptar. No se borran integrantes con historial financiero.
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

La PWA requiere conexión para consultar y guardar datos. Muestra una pantalla de desconexión y **no almacena HTML autenticado ni información financiera en el caché del service worker**. No hay cola de gastos offline ni notificaciones push. Storage y PostgreSQL no comparten una transacción: si una descarga/subida se interrumpe puede requerir reintento; una subida completa cuya confirmación no llegue puede dejar un objeto privado sin vincular. No es un sistema de auditoría contable inmutable: los integrantes pueden editar los gastos del grupo. Las ediciones concurrentes del mismo gasto se serializan en base de datos y prevalece la última edición guardada.

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

Las pruebas de navegador levantan Next.js y un adaptador **exclusivo de tests** sobre esa base aislada. Simulan el servicio de identidad con contraseña sin enviar mensajes; ejercitan las acciones reales de la aplicación y sus funciones SQL en escritorio y tamaño iPhone. Los correos y contraseñas de prueba viven solo en `tests/`; las identidades del adaptador no funcionan en Supabase real. No hay un modo demo en la aplicación. Para usar un Chromium preinstalado: `PLAYWRIGHT_EXECUTABLE_PATH=/ruta/al/chromium npm run test:e2e`.

Estas pruebas **no sustituyen la validación de tu proyecto Supabase**: hay que comprobar allí registro con contraseña, invitaciones privadas, cuatro cuentas, RLS remota, carga/descarga real en Storage y sesiones. Tampoco prueban una publicación Vercel.

## Desplegar en Vercel

La preparación del repositorio no publica nada. Después de autorizar la publicación:

1. Subir la rama revisada a GitHub. Elegir conscientemente la rama de producción; no se requiere hacer merge a `main` para revisar el código. Los proyectos Vercel ya conectados pueden desplegar automáticamente al recibir un push.
2. Importar el repositorio en Vercel, preset Next.js, raíz del repositorio, Node.js 24. Comando de instalación `npm ci`; build `npm run build`. No hace falta `vercel.json` ni servidor persistente.
3. Configurar ambas variables de entorno para Production y para los Preview que se quieran usar. Los previews deben apuntar preferentemente a un Supabase de pruebas para evitar cambios accidentales en datos reales.
4. Aplicar la migración y configurar el acceso con contraseña según la sección anterior; definir el dominio final en Supabase Auth.
5. Desplegar. Comprobar acceso con contraseña, invitaciones privadas, gastos, transferencia, comprobante, CSV e instalación PWA en el dominio HTTPS.

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

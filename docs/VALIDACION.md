# Estado de validación — 16 de octubre de 2026

## Comprobado en este entorno

- Instalación reproducible con `npm ci` y lockfile.
- `npm run typecheck` sin errores.
- `npm run lint` sin errores ni advertencias.
- `npm test`: **38 pruebas aprobadas**, tres archivos, sin casos omitidos.
- `npm run test:e2e`: **6 pruebas aprobadas**, tres flujos en escritorio y tres en tamaño móvil con Chromium.
- `npm run build`: compilación de producción completada.
- `npm audit --omit=dev`: cero vulnerabilidades reportadas al validar.
- Revisión visual de capturas de escritorio y móvil; sin desbordamiento horizontal en los tamaños probados.

Los tests de navegador comprueban ingreso con identidad simulada exclusivamente en el adaptador de pruebas, creación de viaje, invitación y aceptación por un segundo integrante, presupuesto, gasto compartido, compensación exacta por transferencia, evento vinculado, calendario mensual, escenario cotizado con fuente y exportación CSV. También comprueban rechazo de exportación/descarga sin sesión, manifiesto PWA y pantalla offline sin guardar páginas privadas en caché.

Las 38 pruebas de dinero y PostgreSQL incluyen cuatro participantes, subconjuntos, cotizaciones de las cuatro monedas, residuos de centavos, totales por estado, transferencias que no aumentan consumos, CSV seguro, ejecución de la migración, máximo de cuatro personas incluyendo invitaciones, correos confirmados, aislamiento por RLS, prohibición de reescribir cuotas/propietario, rollback, deduplicación y acceso a objetos de comprobantes.

## Pendiente de validar en los proveedores reales

- Entrega de OTP mediante el SMTP configurado para las cuatro cuentas.
- Sesiones reales, carga/descarga en Supabase Storage y RLS del proyecto remoto.
- Deployment, HTTPS e instalación PWA en dispositivos físicos con el dominio Vercel final.

El adaptador de pruebas no implementa el servicio de correo ni la API de archivos de Supabase. Las políticas SQL de Storage sí se prueban con roles aislados; una carga real de archivos sigue pendiente.

## Accesos observados

- Checkout local y lectura del remoto Git disponibles. Rama de trabajo `work`.
- Consulta de la API GitHub: `Forbidden`. Esto no invalida el acceso Git ni prueba permiso para publicar.
- Supabase: bloqueo inicial del proxy (`Tunnel connection failed: 403 Forbidden`), resuelto en la comprobación posterior. `/auth/v1/settings` respondió **HTTP 200** con la clave publicable. El REST respondió **PGRST205 / HTTP 404** para `public.trips` y **PGRST202 / HTTP 404** para la función de invitaciones: esos errores iniciales se resolvieron al aplicar la migración con el acceso administrativo.
- Servidor de producción local: login y manifiesto HTTP 200, exportación y descarga sin sesión HTTP 401, respuestas privadas sin caché y ausencia de datos de pruebas en la página real.
- El token administrativo de Supabase quedó disponible mediante el secreto seguro `SUPABASE_ACCESS_TOKEN`. No se configuró acceso administrativo a Vercel. La clave publicable del proyecto está solo en configuración local ignorada por Git; no otorga privilegios para aplicar migraciones.

No se hizo merge a `main`, no se subió la rama al remoto y no se publicó la aplicación. Un push podría activar deployments de Vercel si el usuario ya conectó el repositorio, por lo que requiere coordinar la publicación antes de realizarlo.

## Configuración remota completada

- Acceso administrativo al proyecto `wehyamqphrvizksxhpzn` confirmado con el secreto seguro, sin exponer su valor.
- Migración SQL aplicada satisfactoriamente: 10 tablas de Travel HQ, las 10 con RLS activado, 16 políticas públicas y bucket `receipts` privado.
- El rol `anon` no tiene permiso SELECT sobre gastos. Las solicitudes reales sin sesión a tablas y RPC se rechazan.
- Email está habilitado. No se crearon usuarios, gastos ni precios de prueba en el proyecto real.

## Bloqueo del correo de acceso

Supabase rechazó el cambio de plantilla OTP con HTTP 400 y el mensaje: “Email template modification is not available for free tier projects using the default email provider. Please upgrade your plan or configure a custom SMTP provider.”

No hay SMTP personalizado configurado. Se necesita un proveedor de correo compatible antes de habilitar y comprobar el acceso por código para los cuatro viajeros. No se modificó el plan ni se contrataron servicios. La migración sí quedó aplicada; este bloqueo no invalida el acceso administrativo ni requiere recrear el token.

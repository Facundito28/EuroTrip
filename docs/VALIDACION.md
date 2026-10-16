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

- Migración aplicada en el proyecto Supabase del usuario.
- Entrega de OTP mediante el SMTP configurado para las cuatro cuentas.
- Sesiones reales, carga/descarga en Supabase Storage y RLS del proyecto remoto.
- Deployment, HTTPS e instalación PWA en dispositivos físicos con el dominio Vercel final.

El adaptador de pruebas no implementa el servicio de correo ni la API de archivos de Supabase. Las políticas SQL de Storage sí se prueban con roles aislados; una carga real de archivos sigue pendiente.

## Accesos observados

- Checkout local y lectura del remoto Git disponibles. Rama de trabajo `work`.
- Consulta de la API GitHub: `Forbidden`. Esto no invalida el acceso Git ni prueba permiso para publicar.
- Supabase: bloqueo inicial del proxy (`Tunnel connection failed: 403 Forbidden`), resuelto en la comprobación posterior. `/auth/v1/settings` respondió **HTTP 200** con la clave publicable. El REST respondió **PGRST205 / HTTP 404** para `public.trips` y **PGRST202 / HTTP 404** para la función de invitaciones: el esquema todavía no está aplicado.
- Servidor de producción local: login y manifiesto HTTP 200, exportación y descarga sin sesión HTTP 401, respuestas privadas sin caché y ausencia de datos de pruebas en la página real.
- No se detectaron tokens administrativos de Supabase o Vercel en las variables disponibles. La clave publicable del proyecto está solo en configuración local ignorada por Git; no otorga privilegios para aplicar migraciones.

No se hizo merge a `main`, no se subió la rama al remoto y no se publicó la aplicación. Un push podría activar deployments de Vercel si el usuario ya conectó el repositorio, por lo que requiere coordinar la publicación antes de realizarlo.

Se declaró el requisito opcional de token administrativo personal `SUPABASE_ACCESS_TOKEN`, enviado solo a `api.supabase.com`, por preferencia expresa del usuario. Su declaración no proporciona un valor ni confirma acceso administrativo.

El helper administrativo `scripts/supabase_admin.py` está preparado. Su comprobación local informó que falta `SUPABASE_ACCESS_TOKEN` (salida 2); no se ejecutaron migraciones ni cambios de Auth en el proyecto remoto.

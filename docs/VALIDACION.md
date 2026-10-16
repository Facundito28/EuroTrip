# Validación — 16 de octubre de 2026

## Flujo actual sin SMTP

Registro e ingreso con correo y contraseña; invitación privada obligatoria para unirse a un viaje existente. No se mandan correos ni se requiere cambiar de plan. La contraseña se puede cambiar confirmando la actual. La recuperación por correo no está habilitada.

## Validación local

- Instalación reproducible con lockfile.
- 40 pruebas de dinero, contraseñas y PostgreSQL aprobadas, en cuatro archivos.
- Pruebas de navegador en escritorio y tamaño iPhone: registro, cookies HttpOnly, invitación, incorporación al grupo, presupuesto, gasto compartido, devolución, itinerario, calendario, escenarios, CSV, cambio de contraseña y nuevo ingreso.
- Pruebas PWA: manifiesto, pantalla sin conexión y exclusión de páginas privadas del caché.
- TypeScript, ESLint y compilación de producción comprobados.

La identidad de los tests de navegador se simula solo en el adaptador de pruebas; las migraciones y políticas se ejecutan sobre PostgreSQL WASM. No hay un modo demo ni cuentas precargadas en la aplicación.

## Validación en Supabase real

Se aplicaron las dos migraciones SQL en el proyecto `wehyamqphrvizksxhpzn`. Las 10 tablas tienen RLS; se verificaron 16 políticas públicas y el bucket `receipts` privado. El registro sin confirmación solo se habilitó después de desactivar el antiguo ingreso por coincidencia de correo y de instalar las invitaciones con hash, vencimiento y un solo uso. La contraseña mínima del proveedor es de 12 caracteres.

El verificador `scripts/verify_supabase.py` completó satisfactoriamente:

1. Registro e ingreso de cinco cuentas temporales con contraseña, sin mensajes de correo.
2. Incorporación de cuatro integrantes mediante sus códigos privados; rechazo de un código usado por otra identidad.
3. Conversión de un gasto original de USD a EUR, reparto que conserva centavos, reenvío sin duplicación y cambio de reserva a pagado sobre el mismo gasto.
4. Aislamiento real de la quinta cuenta: no puede leer los gastos del viaje.
5. Subida de un PNG al bucket privado, descarga por un compañero con URL firmada y rechazo de descarga para el no integrante.
6. Cambio de contraseña e ingreso posterior con la nueva contraseña, sin SMTP.
7. Eliminación de los objetos, el viaje y las cinco cuentas temporales al finalizar. Una primera ejecución reveló que la limpieza debía eliminar movimientos antes del viaje por las claves foráneas; se corrigió el orden, se completó la limpieza pendiente y la siguiente ejecución pasó completa.

No se imprimieron ni guardaron contraseñas, códigos privados, tokens o enlaces firmados. La clave administrativa usada para la limpieza se mantuvo exclusivamente en memoria, fuera de la aplicación.

## Estado y límites

- La restricción del plan gratuito sobre plantillas OTP quedó evitada al cambiar a contraseña e invitación privada; no se contrató SMTP ni se cambió el plan.
- No se verifica la propiedad del correo. El código de invitación proporciona la autorización al grupo y nunca se sustituye por una coincidencia de correo.
- La recuperación automática de contraseña por email queda fuera de este flujo; requiere SMTP o intervención administrativa con comprobación de identidad.
- Todavía no se publicó la aplicación en Vercel ni se validó una instalación PWA en dispositivos físicos con el dominio final.
- No se hizo merge a `main` ni push al remoto. Un push puede disparar deployments automáticos y sigue pendiente de autorización.

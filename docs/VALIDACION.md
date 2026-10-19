# Validación — 16 de octubre de 2026

## Flujo actual sin SMTP

Registro e ingreso con correo y contraseña; invitación privada obligatoria para unirse a un viaje existente. No se mandan correos ni se requiere cambiar de plan. La contraseña se puede cambiar confirmando la actual. La recuperación por correo no está habilitada.

## Validación local

- Instalación reproducible con lockfile.
- 42 pruebas de dinero, contraseñas, comprobantes y PostgreSQL aprobadas, en cinco archivos.
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
5. Subida directa de un PNG de 5 MiB al bucket privado mediante URL firmada, verificación del tamaño real, descarga por un compañero con URL firmada y rechazo de descarga para el no integrante.
6. Cambio de contraseña e ingreso posterior con la nueva contraseña, sin SMTP.
7. Eliminación de los objetos, el viaje y las cinco cuentas temporales al finalizar. Una primera ejecución reveló que la limpieza debía eliminar movimientos antes del viaje por las claves foráneas; se corrigió el orden, se completó la limpieza pendiente y la siguiente ejecución pasó completa.

No se imprimieron ni guardaron contraseñas, códigos privados, tokens o enlaces firmados. La clave administrativa usada para la limpieza se mantuvo exclusivamente en memoria, fuera de la aplicación.

## Estado y límites

- La restricción del plan gratuito sobre plantillas OTP quedó evitada al cambiar a contraseña e invitación privada; no se contrató SMTP ni se cambió el plan.
- No se verifica la propiedad del correo. El código de invitación proporciona la autorización al grupo y nunca se sustituye por una coincidencia de correo.
- La recuperación automática de contraseña por email queda fuera de este flujo; requiere SMTP o intervención administrativa con comprobación de identidad.
- Publicación de producción completada en https://eurotrip-2027-travel-hq.vercel.app. La instalación PWA en dispositivos físicos iOS y Android queda pendiente.
- No se hizo merge a `main`. La rama `work` está subida a GitHub. La cuenta Vercel fue autorizada mediante el flujo oficial de dispositivo.

## Preparación de Vercel

La subida de comprobantes evita el límite de 4,5 MB de las funciones: el servidor autoriza la ruta con la sesión y el gasto, el navegador transfiere el archivo directamente a Supabase, y el servidor comprueba el objeto antes de guardar su vínculo. Las pruebas de navegador transfirieron un archivo de 5 MiB mientras las solicitudes al servidor Next.js quedaron por debajo de 128 KiB. El verificador remoto también pasó con subida firmada de 5 MiB y limpieza completa.

`.vercelignore` excluye archivos de entorno, scripts administrativos, pruebas y artefactos locales. El despliegue requiere configurar únicamente las dos variables públicas de Supabase; nunca tokens administrativos.

Publicación autorizada y completada mediante Vercel CLI 64.3.1, Next.js y Node.js 24. Deployment `dpl_675PLNed1AmW64Q9A5kKP83Yr9kv`, estado `READY`, destino `production`, URL https://eurotrip-2027-travel-hq.vercel.app. Las dos variables públicas están configuradas en producción y el Site URL de Supabase coincide con ese dominio.

Verificación HTTP real sobre el dominio final: ingreso 200, manifiesto PWA 200 y exportación sin sesión 401. La compilación y TypeScript pasaron dentro de Vercel. El primer intento falló porque `supabase/` en `.vercelignore` también excluía `src/lib/supabase`; se corrigió a `/supabase/` para excluir únicamente las migraciones de raíz.

La conexión automática del repositorio desde Vercel falló por acceso GitHub. El despliegue actual se hizo directamente con CLI desde la rama `work`; los pushes no tienen publicación automática configurada. No se modificaron otros proyectos de la cuenta.

Se consultó https://vercel.com/get-started.md. CLI instalada y cuenta autenticada. El plugin y skills globales no pudieron instalarse por rutas de usuario no escribibles; el MCP no pudo persistirse porque la configuración de Codex es de solo lectura. Estas integraciones opcionales no se presentan como configuradas ni impidieron publicar con CLI.

La comprobación adicional de navegador contra producción encontró `ERR_CERT_AUTHORITY_INVALID` en el Chromium aislado ante el certificado del proxy del entorno; no se deshabilitó TLS. Las comprobaciones HTTP con la cadena de confianza del entorno sí pasaron. Las pruebas locales de escritorio y móvil descritas arriba pasaron; no sustituyen pruebas físicas en Safari iOS y Chrome Android.

## Actualización: presupuesto personal y USD/EUR

Migración 202610160003 aplicada al proyecto real: presupuestos personales con RLS por identidad y cotización de consulta del grupo editable solamente por el organizador. El snapshot incluye únicamente el límite propio. Los gastos conservan importe original y cotización histórica.

45 pruebas unitarias/SQL aprobadas, incluyendo privacidad frente al organizador, rechazo de no integrantes, consumo por participación y conservación de gastos ante cambios de cotización. Seis pruebas de navegador aprobadas en escritorio y móvil, con guardado del límite y cotización, conversión del límite a USD y ausencia de desbordamiento horizontal. TypeScript, lint y compilación de producción pasaron.

El verificador remoto pasó también con el límite personal privado y la cotización manual exacta; completó las pruebas existentes y eliminó las cinco cuentas y todos los datos temporales. No se cargaron vuelos ni importes ficticios en el viaje del usuario.

Actualización publicada: deployment `dpl_7e2S29tKPjo6zkacUxNVveXNEPPB`, estado READY, dominio estable sin cambios. Compilación y TypeScript aprobados en Vercel; ingreso HTTP 200 y exportación anónima HTTP 401 verificados tras publicar.

## Actualización: guía, mapa y agenda exportable

Guía pública `/guia`, disponible desde Equipo. Itinerario editable con dirección, horas y zona horaria local, migración 202610160004 aplicada sin cambiar eventos existentes. Mapa Google incrustado bajo búsqueda explícita; no usa claves de API ni facturación configurada. Exportación ICS autenticada y privada; enlace de creación en Google Calendar con revisión manual. No hay sincronización automática.

Pruebas de calendario: fechas inclusivas/exclusivas, zona de verano e invierno, rechazo de hora inexistente por cambio estacional, escape de contenido e inyección y plegado de líneas UTF-8. Pruebas SQL de horarios y privacidad. Seis pruebas de navegador aprobadas en escritorio y móvil: horario del evento, enlace Google, descarga ICS con UTC correcto y mapa sin desbordamiento. La respuesta del proveedor de mapas se sustituye en esas pruebas. La comprobación directa real de maps.google.com encontró `Tunnel connection failed: 403 Forbidden` del proxy del entorno; no se afirma que se verificó el mapa externo. Dominios maps.google.com y www.google.com añadidos al borrador de red sin ampliar el acceso general; guardar el borrador no prueba su activación.

51 pruebas unitarias/SQL aprobadas; lint y compilación con TypeScript aprobados. El verificador real confirmó direcciones y horarios compartidos entre miembros y aislamiento de no integrantes; eliminó las cinco cuentas y todos los datos temporales.

Publicación confirmada: deployment `dpl_FPk6ngUdcWFb5irwL6PeGLjveYKS`, READY en el dominio estable. Verificación posterior: ingreso 200, guía 200 e itinerario ICS sin sesión 401.

## Edición de nombres del equipo

Migración 202610160005 aplicada. Cada miembro puede editar su nombre visible; el organizador puede editar los del grupo. Permiso UPDATE limitado a display_name, con RLS por identidad y pertenencia; correo, user_id y trip_id permanecen protegidos. No se cambiaron nombres de usuarios reales durante la implementación.

52 pruebas unitarias/SQL aprobadas; seis pruebas de navegador escritorio/móvil aprobadas incluyendo edición propia por el amigo y posterior edición por el organizador. Se verificó que otro viajero no ve controles para editar a los demás, y que los selectores de gastos y transferencias usan el nombre actualizado. Lint y compilación de producción aprobados.

Verificación en Supabase real aprobada: edición propia y por organizador, rechazo de edición ajena por otro viajero y limpieza completa de cinco cuentas temporales y sus datos.

Publicación READY `dpl_FuBFeRRojn8zfvCuXa3aRfYYCr3Q`; dominio estable comprobado con ingreso HTTP 200 y guía HTTP 200 que incluye edición de nombres.

## Gastos avanzados: carga rápida, reparto, cuotas y actividad

Migración 202610160006 aplicada al proyecto real. Conservación de gastos, repartos y pagadores existentes comprobada dentro de la misma transacción; rollback obligatorio si cambian. Backfill de un pago equivalente por gasto pagado, sin alterar precios históricos. RPC anterior compatible con clientes abiertos. Nuevos RPC con bloqueo del gasto, validaciones de pertenencia, límite de pago e idempotencia; libro y auditoría solo de lectura para integrantes, sin escritura REST directa. Anulación limitada al creador u organizador.

56 pruebas unitarias/SQL aprobadas. Cubren mayores restos, conservación de centavos, importes y porcentajes exactos, cuotas con cotizaciones y pagadores distintos, rechazo de sobrepago, reversión a reserva, aislamiento de terceros y actividad inmutable. Lint, TypeScript y compilación aprobados. Seis pruebas de navegador previas pasaron con el nuevo libro; la prueba nueva de carga rápida, 60/40, dos cuotas, repetición e historial se ejecuta también en escritorio y móvil. Se corrigieron los selectores del test (Resumen y combobox), sin desactivar aserciones.

Verificador Supabase real aprobado: mismas validaciones de cuotas, reparto, idempotencia, anulación y auditoría privada; limpieza completa de cinco cuentas temporales y sus datos. El CSV incluye consumos efectivos y pendiente. Cuotas futuras sin pagar permanecen en el saldo reservado: no hay cronograma de vencimientos ni débitos automáticos.

La nueva prueba completa pasó en escritorio y móvil (dos ejecuciones dirigidas), además de las seis previas aprobadas con el nuevo libro. La navegación ahora tiene nombres accesibles estables para que el contador de gastos no cambie su identificación. Publicación inicial READY `dpl_GqNGwkHuDamD8D1xDfGeHy9NcyL9`; HTTP de producción 200, guía 200 y CSV anónimo 401.

## Gastos personales privados, edición del presupuesto y diseño móvil

Migración 202610160007 aplicada al proyecto real, sin modificar el libro compartido. Compras personales en tabla separada con RLS por autor, incluso frente al organizador. Snapshot devuelve únicamente las propias; no se registran en actividad, balances, totales ni CSV compartidos. El presupuesto personal suma compras privadas y participación propia en compartidos. Los compartidos anteriores conservan su visibilidad.

Definir/Editar mi presupuesto son botones visibles; Agregar gasto personal y Mis gastos permiten crear, editar y borrar compras propias. Una carga nueva ofrece Compartido o Solo para mí. Formularios móviles de una columna, columnas desktop minmax(0,1fr), límites de ancho para fechas nativas y tarjetas separadas. El botón flotante se limita a Gastos y desaparece al abrir un modal para no tapar el presupuesto. Campos de cotización se omiten al cargar EUR. Navegación desplazable en pantallas bajas.

58 pruebas unitarias/SQL aprobadas; permisos privados comprobados en la base, incluidos rechazo de lectura/escritura del organizador y ausencia en snapshot compartido e historial. Verificador real pasó con edición propia, intento de modificación y eliminación ajenas rechazado, y limpieza de cinco cuentas y todos los datos temporales. Pruebas de navegador cubren presupuesto editable, creación/edición privada, otro amigo sin acceso y controles dentro del modal. Se inspeccionaron capturas de formulario y dashboard móvil; sin desbordamiento de fechas ni botón sobre el presupuesto. Navegador de prueba Chromium con tamaño iPhone; no se presenta como prueba física de Safari iOS.

Las ocho pruebas existentes pasaron con la nueva separación privada. Las dos nuevas de privacidad y diseño pasaron en ejecución dirigida en escritorio y móvil, incluyendo capturas revisadas. Lint y primera compilación aprobaron; Vercel recompila la versión final con simplificación de campos EUR.

Versión final publicada READY `dpl_BZcHxCAc72VFQYaibrW6aPrcsUDs`. Compilación y TypeScript aprobados en Vercel, ingreso HTTP 200, guía privada/pública de uso HTTP 200 y CSV anónimo HTTP 401. Ocho pruebas existentes aprobadas y dos nuevas aprobadas en ejecución dirigida final, incluyendo cambio a USD, controles de fecha y selección de privado. Se corrigió la selección del combobox del test y se reejecutaron las dos afectadas; no se desactivaron aserciones.

## Monedas del recorrido, cotizaciones públicas y menú por gesto

Migración 202610170001 aplicada: CZK habilitado en gastos compartidos, privados, devoluciones y escenarios; no se modificó el recorrido ni importes anteriores. Selector con nombres completos Euro, Dólar estadounidense, Libra esterlina, Corona checa y Peso argentino; ayuda por destino.

Referencias gratuitas mediante Frankfurter v1 y DolarAPI. Endpoint de precios públicos `/api/rates`, sin claves ni datos personales, consulta limitada a URLs fijas y mercados validados. Caché externa 1 h para Europa y 15 min para ARS; timeout y validación de respuesta. Conversión decimal con BigInt y ocho decimales. Referencia se aplica solo con confirmación, es editable y no recalcula operaciones guardadas. ARS requiere elegir oficial/blue/MEP, usa venta y muestra ambas fechas del cruce. No incluye comisiones ni se promete cambio de tarjeta o actualización en tiempo real.

Se comprobaron respuestas REALES desde producción: Europa y los tres mercados ARS devolvieron 200 con fechas y cotizaciones válidas. Proveedor europeo fecha 2026-10-16; ARS fechas 2026-10-16/17 según mercado. Las páginas propuestas y proveedores directos resultaron bloqueados por el proxy cloud (403), pero las APIs funcionaron desde Vercel. Se preservó TLS. El código no scrapea ni atribuye estas cotizaciones a FinanzasArgy/Dolarito.

63 pruebas unitarias/SQL aprobadas y las 12 pruebas de navegador aprobadas entre la suite y ejecuciones dirigidas. La nueva prueba guarda CZK, valida nombres y confirma explícitamente una referencia. Gesto probado con pointer events y entrada táctil nativa de Chromium/CDP: abrir desde borde, cerrar, ignorar scroll vertical. Se respetó la transición del panel y el touch-action del overlay; no se presenta como prueba física de Safari. El navegador del sistema puede reservar el gesto de retroceso en iOS.

Verificador real Supabase aprobado incluyendo gasto y pago en CZK; limpieza completa de cinco cuentas temporales y sus datos. Lint, TypeScript y compilación aprobados antes de publicar; Vercel recompila la versión final.

Publicación final READY `dpl_9JHSZ5MPgWTF58KCafnMNTHwcbqS`. Compilación y TypeScript aprobados en Vercel. Verificación posterior: referencias europeas 200, ARS blue 200, mercado inválido 400 y guía 200. Navegación táctil nativa validada tras esperar las transiciones del panel; no se omitió la prueba.

## Vencimientos, papelera, resumen diario y recuperación sin correo

Migraciones `202610170002_quality` y `202610170003_recovery_codes` aplicadas al proyecto real. Se compararon cantidades y sumas de gastos, cuotas, repartos y compras privadas antes y después: sin cambios. Vencimiento opcional, papelera separada por privacidad y snapshot sin archivados. Restaurar conserva el mismo registro y relaciones. No hay purga automática ni notificaciones de vencimiento.

Resumen diario por fecha del dispositivo editable: participación propia en pagos del día y compras privadas pagadas. Redondeo mediante diferencia de asignación acumulada para coincidir con el total personal del viaje. Saldo neto separado de consumo. Importes primero en formularios, más tamaño y contraste, notas/vencimientos y explicaciones plegables, tarjetas móviles sin desbordes.

Recuperación con ocho códigos aleatorios personales de un uso, generados tras confirmar contraseña actual. Hashes privados, sin códigos en snapshot ni logs; consumo solo por service_role. Límites de 5 intentos/correo y 20/red cada 15 minutos; huella de red HMAC. Variable de proyecto guardada como Sensitive y exclusivamente de servidor en Vercel mediante stdin, sin archivos ni exposición cliente. No se instaló el token administrativo personal en Vercel. Requiere guardar códigos previamente y no promete revocar inmediatamente JWT ya emitidos.

68 pruebas unitarias/SQL aprobadas. Los 14 casos de navegador pasaron entre la suite (10) y la reejecución de los 4 afectados por etiquetas duplicadas/selector incorrecto del test, corregidos sin desactivar aserciones. Cubren vencimiento visible, duplicado con confirmación explícita, restauración y restablecimiento con rechazo de reutilización. Escritorio y Chromium con tamaño iPhone; no prueba física de Safari/iOS ni Android. TypeScript, lint, formato y compilación de producción aprobados.

Publicación READY `dpl_GWHuERhxYQHB4TBNzUxNQ6UwEF2C`, dominio estable conservado. Vercel recompiló y aprobó TypeScript. HTTP reales: inicio, recuperación, guía, manifiesto y cotizaciones 200; CSV anónimo 401.

Verificador Supabase real aprobado: papelera compartida conserva pago efectivo y comprobante de 5 MiB tras restauración; papelera privada invisible al organizador; coincidencia de duplicado correcta. La ruta publicada `/api/recovery` restableció la contraseña de una cuenta temporal, permitió ingresar con la nueva clave y rechazó reutilizar el mismo código. Limpieza completa de cinco cuentas temporales, sus gastos, cuotas, eventos, viajes y objeto Storage. Ninguna credencial, código real o URL firmada se imprimió ni se agregó al repositorio.

## Acompañante del viaje — 19 de octubre de 2026

Implementados Hoy, Reservas y Checklist. Reservas organizativas vinculables a gastos existentes, sin duplicar importes ni eventos; acceso a comprobantes ya adjuntos al gasto. Tareas compartidas con asignación, vencimiento, filtros, edición, completar/reabrir y eliminación. RLS por membresía en ambas tablas; asignación limitada al mismo viaje y vínculo financiero con clave compuesta. Restricciones de fecha y enlaces HTTPS.

Hoy permite previsualizar fechas, alojamiento excluyendo la noche del check-out, planes y próximo plan con horario ordenado por UTC, mapa bajo demanda y pendientes propios/sin asignar. El resumen de consumos sigue la fecha seleccionada. Se agrega Europe/Prague. Separación de tarjetas revisada en captura móvil; no se guardan datos privados sin conexión.

71 pruebas unitarias/SQL aprobadas. Los 18 casos de navegador aprobaron entre suite y ejecuciones dirigidas: se corrigió una espera prematura del nuevo test móvil al navegar antes de terminar de crear el viaje, sin forzar clics ni desactivar verificaciones. Las nuevas secciones y compatibilidad con snapshot anterior se probaron en escritorio y móvil Chromium; no es prueba física iOS/Android. Build, TypeScript, lint y formato aprobados. Helpers Python validados sintácticamente.

**Activación remota pendiente:** la API administrativa de Supabase respondió HTTP 401 `Invalid access token` tanto al consultar proyectos como al primer SELECT previo a migrar. No se ejecutó la migración real ni se crearon cuentas temporales. `companion_ready` protege la compatibilidad: sin migración, las nuevas secciones y la opción Praga no se ofrecen; la app financiera sigue funcionando. El helper `scripts/upgrade_companion.py --apply` y el verificador remoto quedaron preparados para continuar una vez renovado el secreto seguro. No se afirma validación real de estas tablas ni activación en producción.

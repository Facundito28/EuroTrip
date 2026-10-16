import Link from "next/link";
const steps = [
  [
    "Tu nombre en el equipo",
    "En Equipo, cada integrante puede tocar Editar mi nombre y guardar cómo quiere aparecer. El organizador también puede editar los nombres de los demás. Cambiar un nombre no cambia la cuenta, el correo ni el historial de gastos.",
  ],
  [
    "1. Sumarse al mismo viaje",
    "El organizador va a Equipo, escribe el correo de cada amigo y pulsa Generar invitación. Comparte en privado el código y el enlace de la app. Cada amigo pulsa Crear cuenta, usa exactamente el correo invitado y elige su propia contraseña de al menos 12 caracteres. Después pega el código en Código de invitación y pulsa Unirme al viaje. No debe crear un viaje nuevo. No se envía un correo automático. Cada código vence en 7 días y sirve una sola vez. Hay cuatro lugares en total, incluyendo al organizador y las invitaciones pendientes.",
  ],
  [
    "2. Definir el presupuesto",
    "El organizador configura el presupuesto grupal en Configuración. Cada integrante guarda su límite privado en Mi presupuesto. Ese límite no modifica el total del grupo. Allí puede consultar su consumo, sus reservas y cuánto le queda. Los totales se pueden consultar en EUR o USD con la cotización que acuerde el organizador. Esa cotización de consulta no cambia los gastos históricos.",
  ],
  [
    "3. Cargar vuelos, Airbnb y otros gastos",
    "En Nuevo gasto, elegí descripción, categoría, moneda, importe original, fecha, quién pagó y los participantes. Vuelos y trenes van en Transporte; Airbnb y hoteles, en Alojamiento. Si pagaste para todos, cargá una sola vez el total y marcá a los cuatro. Si cada uno compró su propio pasaje, cada uno registra su compra seleccionándose solo a sí mismo. Con monedas distintas de EUR, guardá la cotización manual del gasto: 1 unidad de esa moneda = X EUR.",
  ],
  [
    "4. Separar pagos y planes",
    "Pagado es dinero efectivamente gastado. Reservado es un compromiso pendiente de pago. Estimado es solo una idea. Cuando paguen una reserva, editen el mismo registro o márquenlo pagado: no creen otro gasto por el total. Las reservas reducen el disponible, pero solo los pagos generan deudas entre amigos. Los comprobantes se adjuntan desde Gastos y quedan privados para el grupo.",
  ],
  [
    "5. Devolverse dinero",
    "En Saldos se ve quién debe recibir y quién debe devolver. Cuando un amigo le paga a otro, registren una transferencia entre ellos. Esa devolución reduce la deuda; no es un nuevo consumo. Lo que pagaste por otros es distinto de tu parte del gasto.",
  ],
  [
    "6. Organizar el itinerario",
    "El organizador puede cambiar ciudades, orden y fechas en Configuración o Editar ruta. Todos pueden agregar, editar y eliminar eventos en Itinerario. Para un museo, cargá título, ciudad, lugar o dirección, fechas, hora de inicio y fin y zona horaria del destino. Sin horas, el evento ocupa todo el día. Podés vincular una entrada o reserva ya registrada en Gastos sin duplicarla. Una visita en la agenda por sí sola no registra un gasto.",
  ],
  [
    "7. Consultar el mapa",
    "En Itinerario buscá el museo, hotel o dirección en Mapa del viaje y pulsá Buscar en el mapa. Cada evento también tiene Ver lugar en el mapa. Se muestra Google Maps dentro de Travel HQ, sin claves ni un servicio de pago configurado. Requiere Internet y conviene confirmar que el lugar encontrado sea el correcto. El botón Abrir en Google Maps es opcional y sale de la app.",
  ],
  [
    "8. Guardar visitas en el calendario",
    "Agregar a Google Calendar abre Google para revisar y guardar una copia en tu cuenta; no guarda automáticamente. Guardar en calendario (.ics) permite importar un evento en Apple Calendar, Google Calendar u Outlook. Descargar agenda (.ics) exporta todos los eventos. Se respetan los horarios del destino. No hay sincronización automática: si modifican un plan, actualicen también su copia externa. Reimportar puede duplicar eventos según la aplicación. Las alertas se eligen en el calendario personal.",
  ],
  [
    "9. Comparar y exportar",
    "Escenarios sirve para comparar alternativas con precios estimados, cotizados o confirmados y su fuente. No suma esos precios a Gastos automáticamente. La exportación CSV permite descargar los gastos registrados.",
  ],
  [
    "10. Usarla desde el celular",
    "iPhone y iPad: abrí la app en Safari, Compartir y Agregar a inicio. Android: Chrome, menú e Instalar aplicación o Agregar a pantalla principal. También funciona en PC. Necesitás Internet para consultar o guardar los datos privados; no se sincronizan cambios sin conexión. Guardá tu contraseña: la recuperación por correo todavía no está habilitada.",
  ],
];
export default function Guide() {
  return (
    <main className="user-guide">
      <Link className="button secondary" href="/">
        Volver a Travel HQ
      </Link>
      <h1>Cómo usar EuroTrip 2027</h1>
      <p>Guía para compartir con los cuatro integrantes del viaje.</p>
      {steps.map(([title, text]) => (
        <section className="panel" key={title}>
          <h2>{title}</h2>
          <p>{text}</p>
        </section>
      ))}
      <p>
        Estas conexiones no requieren contratar APIs, SMTP ni planes
        adicionales. Los servicios gratuitos de alojamiento y almacenamiento
        mantienen sus propios límites. Las entradas, reservas y transporte se
        compran por separado.
      </p>
    </main>
  );
}

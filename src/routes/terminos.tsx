import { createFileRoute } from "@tanstack/react-router";
import { LegalLayout, Seccion } from "@/components/LegalLayout";

export const Route = createFileRoute("/terminos")({
  head: () => ({
    meta: [
      { title: "Términos de uso — DosisYa" },
      {
        name: "description",
        content: "Términos y condiciones de uso de DosisYa para pacientes y farmacias.",
      },
    ],
  }),
  component: Terminos,
});

function Terminos() {
  return (
    <LegalLayout titulo="Términos de uso" actualizado="4 de agosto de 2026">
      <div
        className="rounded-lg border px-4 py-3 text-sm"
        style={{ borderColor: "var(--ambar-receta)", background: "var(--ambar-fondo)", color: "var(--ambar-receta)" }}
      >
        <strong>Borrador.</strong> Este texto describe cómo funciona DosisYa hoy, pero
        todavía no fue revisado por un abogado. No lo tomes como asesoría legal
        definitiva — complétalo y valídalo antes de operar con farmacias y pacientes reales.
      </div>

      <Seccion titulo="1. Qué es DosisYa">
        <p>
          DosisYa es un directorio y buscador de disponibilidad de medicamentos que conecta
          pacientes con farmacias afiliadas en Acarigua y Araure (Venezuela). DosisYa{" "}
          <strong>no es una farmacia, no vende medicamentos y no procesa pagos</strong>: solo
          muestra qué farmacia reporta tener un producto en stock y, si el paciente quiere
          contactarla, abre una conversación de WhatsApp directamente con esa farmacia.
        </p>
      </Seccion>

      <Seccion titulo="2. Uso por parte del paciente">
        <p>
          Buscar medicamentos, armar tu Lista Médica y contactar farmacias en DosisYa es
          gratuito y no requiere registro ni cuenta.
        </p>
        <p>
          La disponibilidad y el precio que ves los reporta cada farmacia y pueden cambiar
          entre el momento en que buscas y el momento en que llegas o escribes — DosisYa no
          garantiza que un producto siga disponible ni que el precio final sea exactamente
          el mostrado. Confirma siempre con la farmacia antes de trasladarte.
        </p>
        <p>
          La compra, el pago y la entrega ocurren directamente entre tú y la farmacia, fuera
          de DosisYa. La farmacia es responsable de su inventario, sus precios y su logística
          de entrega (motorizado propio o servicio de delivery de terceros).
        </p>
      </Seccion>

      <Seccion titulo="3. Escáner de récipe y Asistente IA">
        <p>
          El escáner de récipe y el Asistente IA son herramientas de apoyo informativo que
          usan inteligencia artificial (Google Gemini) para leer una foto de récipe o
          responder preguntas generales sobre medicamentos. Son un auxiliar de búsqueda, no
          sustituyen la indicación de un médico ni de un farmacéutico, y{" "}
          <strong>DosisYa no diagnostica ni prescribe</strong>. Ante cualquier duda sobre
          dosis, interacciones o alternativas, consulta siempre a un profesional de la salud.
        </p>
      </Seccion>

      <Seccion titulo="4. Uso por parte de la farmacia">
        <p>
          Las farmacias se afilian mediante un registro que DosisYa aprueba antes de
          publicar su inventario. DosisYa cobra a la farmacia por cada interacción cobrable
          que genera hacia su WhatsApp (modelo de costo-por-lead), no por cada venta ni
          comisión sobre el monto vendido. El detalle de facturación queda disponible en el
          panel de la farmacia.
        </p>
        <p>
          La farmacia es responsable de la exactitud de su inventario, sus precios y de
          responder a los pacientes que la contactan a través de DosisYa.
        </p>
      </Seccion>

      <Seccion titulo="5. Límite de responsabilidad">
        <p>
          DosisYa actúa como intermediario tecnológico entre pacientes y farmacias. No es
          parte de la transacción de compra-venta ni de la relación de entrega entre ambos,
          y no responde por errores de inventario, demoras de entrega o el estado de los
          productos entregados por la farmacia.
        </p>
      </Seccion>

      <Seccion titulo="6. Cambios a estos términos">
        <p>
          Podemos actualizar estos términos para reflejar cambios en el producto. La fecha
          de "Última actualización" en la parte de arriba indica la versión vigente.
        </p>
      </Seccion>

      <Seccion titulo="7. Contacto">
        <p style={{ color: "var(--tinta-tenue)" }}>
          [COMPLETAR: correo o WhatsApp real de soporte antes de publicar — el número
          de soporte actual en la app es un placeholder de desarrollo.]
        </p>
      </Seccion>
    </LegalLayout>
  );
}

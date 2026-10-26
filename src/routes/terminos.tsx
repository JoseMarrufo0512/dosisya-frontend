import { createFileRoute, Link } from "@tanstack/react-router";
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
    <LegalLayout titulo="Términos de uso" actualizado="26 de octubre de 2026">
      <div
        className="rounded-lg border px-4 py-3 text-sm"
        style={{
          borderColor: "var(--ambar-receta)",
          background: "var(--ambar-fondo)",
          color: "var(--ambar-receta)",
        }}
      >
        <strong>Borrador.</strong> Este texto describe cómo funciona DosisYa hoy, pero todavía no
        fue revisado por un abogado. No lo tomes como asesoría legal definitiva: complétalo
        (identidad legal, ciudad del domicilio legal) y valídalo antes de publicarlo u operar con
        farmacias y pacientes reales.
      </div>

      <Seccion titulo="1. Qué es DosisYa">
        <p>
          DosisYa es un directorio y buscador de disponibilidad de medicamentos que conecta
          pacientes con farmacias afiliadas en Venezuela. DosisYa{" "}
          <strong>no es una farmacia, no vende medicamentos y no procesa pagos</strong>: solo
          muestra qué farmacia reporta tener un producto en stock y, si el paciente quiere
          contactarla, abre una conversación de WhatsApp directamente con esa farmacia.
        </p>
      </Seccion>

      <Seccion titulo="2. Aceptación y quién puede usar DosisYa">
        <p>
          Al usar DosisYa aceptas estos Términos de uso y nuestra{" "}
          <Link to="/privacidad" style={{ color: "var(--verde-cruz)", fontWeight: 500 }}>
            Política de privacidad
          </Link>
          . Si no estás de acuerdo con ellos, no uses la plataforma.
        </p>
        <p>
          Para usar DosisYa debes ser mayor de edad. Puedes buscar y contactar farmacias{" "}
          <strong>sin crear una cuenta</strong>; crear una cuenta de paciente es opcional y te
          permite guardar tu Lista Médica y acceder a beneficios.
        </p>
      </Seccion>

      <Seccion titulo="3. Dónde funciona DosisYa">
        <p>
          DosisYa está diseñado para operar en Venezuela y mostrar farmacias dentro del país. Si
          accedes desde el exterior lo haces bajo tu propia responsabilidad, y algunas funciones
          (como la cercanía de farmacias o el contacto) pueden no estar disponibles o no tener
          sentido fuera de Venezuela.
        </p>
      </Seccion>

      <Seccion titulo="4. Uso por parte del paciente">
        <p>
          Buscar medicamentos, armar tu Lista Médica y contactar farmacias en DosisYa es gratuito y
          no requiere cuenta.
        </p>
        <p>
          La disponibilidad y el precio que ves los reporta cada farmacia y pueden cambiar entre el
          momento en que buscas y el momento en que llegas o escribes: DosisYa no garantiza que un
          producto siga disponible ni que el precio final sea exactamente el mostrado. Confirma
          siempre con la farmacia antes de trasladarte.
        </p>
        <p>
          La compra, el pago y la entrega ocurren directamente entre tú y la farmacia, fuera de
          DosisYa. La farmacia es responsable de su inventario, sus precios y su logística de
          entrega (motorizado propio o servicios de delivery de terceros).
        </p>
      </Seccion>

      <Seccion titulo="5. Escáner de récipe y Asistente IA">
        <p>
          El escáner de récipe y el Asistente IA son herramientas de apoyo informativo que usan
          inteligencia artificial (Google Gemini) para leer una foto de récipe o responder preguntas
          generales sobre medicamentos. Son un auxiliar de búsqueda, no sustituyen la indicación de
          un médico ni de un farmacéutico, y <strong>DosisYa no diagnostica ni prescribe</strong>.
          Ante cualquier duda sobre dosis, interacciones, contraindicaciones o alternativas, consulta
          siempre a un profesional de la salud.
        </p>
      </Seccion>

      <Seccion titulo="6. Uso aceptable">
        <p>Al usar DosisYa te comprometes a no:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            extraer datos de forma masiva o automatizada (scraping) del directorio o del inventario;
          </li>
          <li>
            generar clics o interacciones artificiales o fraudulentas hacia las farmacias (cada
            interacción se factura, así que simularlas es fraude);
          </li>
          <li>enviar spam o comunicaciones no solicitadas a través de la plataforma;</li>
          <li>
            intentar vulnerar la seguridad del sitio, acceder a datos de terceros o interferir con su
            funcionamiento;
          </li>
          <li>
            usar DosisYa para fines ilícitos o que dañen a otros usuarios, a las farmacias o a
            DosisYa.
          </li>
        </ul>
      </Seccion>

      <Seccion titulo="7. Uso por parte de la farmacia">
        <p>
          Las farmacias se afilian mediante un registro que DosisYa aprueba antes de publicar su
          inventario. DosisYa cobra a la farmacia por cada interacción cobrable que genera hacia su
          WhatsApp (modelo de costo-por-lead), no por cada venta ni comisión sobre el monto vendido.
          El detalle de facturación queda disponible en el panel de la farmacia.
        </p>
        <p>
          La farmacia es responsable de la exactitud de su inventario, sus precios y de responder a
          los pacientes que la contactan a través de DosisYa.
        </p>
      </Seccion>

      <Seccion titulo="8. Propiedad intelectual y marcas">
        <p>
          La marca "DosisYa", el software, el diseño y los contenidos de la plataforma pertenecen a
          DosisYa o a sus titulares. No se te otorga ninguna licencia para copiarlos, reproducirlos o
          reutilizarlos fuera del uso normal de la aplicación sin autorización previa por escrito.
        </p>
      </Seccion>

      <Seccion titulo="9. Enlaces y servicios de terceros">
        <p>
          DosisYa se apoya en servicios de terceros y enlaza hacia ellos: WhatsApp (para el contacto
          con la farmacia), mapas (para ubicar farmacias) y servicios de delivery de terceros. DosisYa
          no controla esos servicios ni responde por su contenido, disponibilidad o condiciones; su
          uso se rige por los términos de cada proveedor.
        </p>
      </Seccion>

      <Seccion titulo="10. Límite de responsabilidad">
        <p>
          DosisYa actúa como intermediario tecnológico entre pacientes y farmacias y ofrece la
          plataforma "tal cual", según su disponibilidad. No es parte de la transacción de
          compra-venta ni de la relación de entrega entre ambos, y no responde por errores de
          inventario o precios, demoras de entrega ni por el estado de los productos entregados por la
          farmacia.
        </p>
      </Seccion>

      <Seccion titulo="11. Privacidad">
        <p>
          El tratamiento de tus datos se rige por nuestra{" "}
          <Link to="/privacidad" style={{ color: "var(--verde-cruz)", fontWeight: 500 }}>
            Política de privacidad
          </Link>
          , que forma parte de estos Términos.
        </p>
      </Seccion>

      <Seccion titulo="12. Ley aplicable y jurisdicción">
        <p>
          Estos Términos se regirán e interpretarán en todas sus partes por las leyes de la República
          Bolivariana de Venezuela. Para todos los efectos legales derivados del uso de DosisYa, las
          partes se someten a la jurisdicción de los tribunales competentes de la República
          Bolivariana de Venezuela.
        </p>
        <p style={{ color: "var(--tinta-tenue)" }}>
          [COMPLETAR: ciudad del domicilio legal (por ejemplo, "se elige como domicilio la ciudad de
          ___, Venezuela") una vez constituida la identidad legal del operador.]
        </p>
      </Seccion>

      <Seccion titulo="13. Disposiciones finales">
        <p>
          Si alguna cláusula de estos Términos se considerara inválida o inaplicable, el resto seguirá
          en plena vigencia. El hecho de que DosisYa no ejerza un derecho en un momento dado no
          implica que renuncie a él.
        </p>
      </Seccion>

      <Seccion titulo="14. Cambios a estos términos">
        <p>
          Podemos actualizar estos términos para reflejar cambios en el producto. La fecha de "Última
          actualización" en la parte de arriba indica la versión vigente.
        </p>
      </Seccion>

      <Seccion titulo="15. Contacto">
        <p>
          Para dudas sobre estos Términos, escríbenos por WhatsApp al{" "}
          <strong>+58 424-592-8624</strong> o al correo <strong>soporte@dosisya.com</strong>.
        </p>
        <p style={{ color: "var(--tinta-tenue)" }}>
          [COMPLETAR: identidad legal del operador (nombre o razón social y RIF) antes de publicar.]
        </p>
      </Seccion>
    </LegalLayout>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { LegalLayout, Seccion } from "@/components/LegalLayout";

export const Route = createFileRoute("/privacidad")({
  head: () => ({
    meta: [
      { title: "Privacidad — DosisYa" },
      {
        name: "description",
        content: "Qué datos maneja DosisYa, para qué los usa y con quién los comparte.",
      },
    ],
  }),
  component: Privacidad,
});

function Privacidad() {
  return (
    <LegalLayout titulo="Política de privacidad" actualizado="26 de octubre de 2026">
      <div
        className="rounded-lg border px-4 py-3 text-sm"
        style={{
          borderColor: "var(--ambar-receta)",
          background: "var(--ambar-fondo)",
          color: "var(--ambar-receta)",
        }}
      >
        <strong>Borrador.</strong> Describe el manejo de datos real de la app a esta fecha e incluye
        el registro de paciente previsto (formulario + Google), que aún no está en producción. No lo
        publiques hasta que ese registro esté activo y un abogado haya revisado el texto, y completa
        la identidad legal y el canal de contacto definitivos.
      </div>

      <Seccion titulo="1. Cómo usas DosisYa: con o sin cuenta">
        <p>
          Buscar, armar tu Lista Médica y contactar farmacias en DosisYa no requiere cuenta: no
          necesitas registrarte para usar lo esencial de la app. Crear una cuenta de paciente es{" "}
          <strong>opcional</strong> y te permite guardar tu Lista Médica y acceder a beneficios.
        </p>
      </Seccion>

      <Seccion titulo="2. Qué guarda tu propio dispositivo (no nuestros servidores)">
        <p>
          Tu Lista Médica, tus favoritos y tus recordatorios de reposición se guardan únicamente en
          el almacenamiento local de tu navegador (localStorage). Si no tienes cuenta, DosisYa no
          recibe esa información en sus servidores: si borras los datos del navegador o cambias de
          dispositivo, se pierde.
        </p>
      </Seccion>

      <Seccion titulo="3. Qué recibimos cuando contactas a una farmacia">
        <p>
          Cuando tocas "Contactar por WhatsApp", "Ver mapa", "Guardar" o "Compartir" sobre un
          resultado, registramos esa interacción: la farmacia, el medicamento asociado (si aplica),
          el tipo de interacción, la fecha y hora, y tu dirección IP y user-agent del navegador.
          Usamos esto para cobrarle a la farmacia por el contacto generado (nuestro modelo de
          negocio) y para detectar clics artificiales o fraudulentos.
        </p>
        <p>
          La conversación de WhatsApp en sí ocurre directamente entre tú y la farmacia: no pasa por
          los servidores de DosisYa ni la leemos.
        </p>
        <p>
          Tu ubicación (si la compartes) se usa únicamente para calcular qué farmacias están cerca
          en el momento de la búsqueda; no queda guardada asociada a tu identidad.
        </p>
        <p>
          También registramos, de forma anónima, eventos de uso como qué buscas, cuándo agregas algo
          a tu Lista Médica y cuándo contactas a una farmacia: nos sirve para entender en qué punto
          del recorrido se pierde la gente y mejorar la app.
        </p>
      </Seccion>

      <Seccion titulo="4. Si creas una cuenta de paciente">
        <p>
          Si te registras, guardamos los datos que nos proporcionas para crear tu cuenta: nombre,
          apellido, correo electrónico, número de documento, número de teléfono y, de forma opcional,
          tu género. Si te registras con Google, recibimos los datos básicos de tu cuenta de Google
          (como tu nombre y tu correo).
        </p>
        <p>
          Usamos esos datos para crear y autenticar tu cuenta, recordarte entre sesiones y
          dispositivos, y guardar tu Lista Médica. Puedes cerrar sesión en cualquier momento y pedir
          la eliminación de tu cuenta escribiéndonos a <strong>soporte@dosisya.com</strong>.
        </p>
      </Seccion>

      <Seccion titulo="5. Escáner de récipe y Asistente IA">
        <p>
          La foto de tu récipe se procesa en memoria en nuestro servidor y se envía a la API de{" "}
          <strong>Google Gemini</strong> para extraer los medicamentos: DosisYa no la guarda ni la
          almacena en sus servidores ni en su base de datos.
        </p>
        <p>
          Los mensajes que le escribes al Asistente IA se envían a Google Gemini para generar la
          respuesta; DosisYa no guarda el historial de esa conversación en sus servidores.
        </p>
      </Seccion>

      <Seccion titulo="6. Si eres farmacia (panel B2B)">
        <p>
          Para operar tu panel guardamos los datos de tu registro: correo, nombre de la farmacia,
          RIF, WhatsApp, sector/punto de referencia y tus credenciales de acceso (contraseña
          cifrada). Los usamos para autenticarte, mostrarte tus leads y calcular tu facturación
          mensual.
        </p>
      </Seccion>

      <Seccion titulo="7. Con quién compartimos datos">
        <p>Usamos estos proveedores (subencargados) para operar DosisYa:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <strong>Google Gemini</strong> — análisis de récipes y Asistente IA.
          </li>
          <li>
            <strong>Google</strong> — registro e inicio de sesión del paciente con Google.
          </li>
          <li>
            <strong>Supabase</strong> — base de datos donde vive la información descrita arriba.
          </li>
          <li>
            <strong>Vercel</strong> — hosting de la aplicación y la API.
          </li>
          <li>
            <strong>Sentry</strong> — monitoreo de errores técnicos; puede incluir tu dirección IP
            si ocurre un fallo mientras usas la app.
          </li>
          <li>
            <strong>PostHog</strong> — analítica de uso anónima (búsquedas, uso de la Lista Médica,
            contacto con farmacias).
          </li>
          <li>
            <strong>n8n</strong> — envío de la notificación del lead al WhatsApp de la farmacia.
          </li>
        </ul>
        <p>No vendemos tus datos a terceros con fines publicitarios.</p>
      </Seccion>

      <Seccion titulo="8. Cuánto tiempo conservamos los datos">
        <p>
          Conservamos los registros de interacciones/leads durante <strong>12 meses</strong> (cubren
          la facturación de la farmacia y posibles reclamos). Los datos de la cuenta de una farmacia
          se conservan mientras la cuenta esté activa y hasta <strong>6 meses</strong> después de
          darse de baja. Los datos de tu cuenta de paciente se conservan hasta que pidas eliminarla.
        </p>
      </Seccion>

      <Seccion titulo="9. Seguridad de la información">
        <p>
          Aplicamos medidas de seguridad razonables para proteger tu información (por ejemplo, las
          contraseñas se almacenan cifradas). Sin embargo, ninguna transmisión por Internet ni
          almacenamiento electrónico es completamente seguro, por lo que no podemos garantizar una
          seguridad absoluta.
        </p>
      </Seccion>

      <Seccion titulo="10. Cookies y tecnologías similares">
        <p>
          DosisYa no usa cookies de rastreo publicitario para el paciente. Usamos el almacenamiento
          local de tu navegador (localStorage) para que la app funcione y analítica de uso anónima
          para mejorarla. Puedes borrar ese almacenamiento desde la configuración de tu navegador.
        </p>
      </Seccion>

      <Seccion titulo="11. Menores de edad">
        <p>
          DosisYa está dirigido a personas mayores de edad. No recopilamos de forma intencional
          información de menores; si crees que un menor nos proporcionó datos, escríbenos y los
          eliminaremos.
        </p>
      </Seccion>

      <Seccion titulo="12. Tus derechos">
        <p>
          Si tienes una cuenta (de paciente o de farmacia) puedes pedirnos acceder, corregir o
          eliminar tus datos escribiéndonos a <strong>soporte@dosisya.com</strong>. Si usas DosisYa
          sin cuenta, las interacciones quedan asociadas a la farmacia contactada, no a una identidad
          tuya, por lo que no tenemos un perfil tuyo que mostrarte o borrar.
        </p>
      </Seccion>

      <Seccion titulo="13. Cambios a esta política">
        <p>
          Podemos actualizar esta política si cambia cómo manejamos los datos. La fecha de "Última
          actualización" arriba indica la versión vigente.
        </p>
      </Seccion>

      <Seccion titulo="14. Contacto">
        <p>
          Para dudas sobre esta política o para ejercer tus derechos, escríbenos por WhatsApp al{" "}
          <strong>+58 424-592-8624</strong> o al correo <strong>soporte@dosisya.com</strong>.
        </p>
        <p style={{ color: "var(--tinta-tenue)" }}>
          [COMPLETAR: identidad legal del operador (nombre o razón social y RIF) antes de publicar.]
        </p>
      </Seccion>
    </LegalLayout>
  );
}

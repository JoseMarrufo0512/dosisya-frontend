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
    <LegalLayout titulo="Política de privacidad" actualizado="4 de agosto de 2026">
      <div
        className="rounded-lg border px-4 py-3 text-sm"
        style={{ borderColor: "var(--ambar-receta)", background: "var(--ambar-fondo)", color: "var(--ambar-receta)" }}
      >
        <strong>Borrador.</strong> Describe el manejo de datos real de la app a esta fecha,
        pero todavía no fue revisado por un abogado. Complétalo (identidad legal, plazos de
        conservación, canal de contacto) y valídalo antes de publicarlo.
      </div>

      <Seccion titulo="1. Como paciente, no creas una cuenta">
        <p>
          Buscar, armar tu Lista Médica y contactar farmacias en DosisYa no requiere registro.
          No creamos una cuenta ni un perfil identificado tuyo.
        </p>
      </Seccion>

      <Seccion titulo="2. Qué guarda tu propio dispositivo (no nuestros servidores)">
        <p>
          Tu Lista Médica, tus favoritos y tus recordatorios de reposición se guardan
          únicamente en el almacenamiento local de tu navegador (localStorage). DosisYa no
          tiene acceso a esa información ni la recibe en sus servidores — si borras los datos
          del navegador o cambias de dispositivo, se pierde.
        </p>
      </Seccion>

      <Seccion titulo="3. Qué recibimos cuando contactas a una farmacia">
        <p>
          Cuando tocas "Contactar por WhatsApp", "Ver mapa", "Guardar" o "Compartir" sobre un
          resultado, registramos esa interacción: la farmacia, el medicamento asociado (si
          aplica), el tipo de interacción, la fecha y hora, y tu dirección IP y user-agent del
          navegador. Usamos esto para cobrarle a la farmacia por el contacto generado (nuestro
          modelo de negocio) y para detectar clics artificiales/fraudulentos.
        </p>
        <p>
          La conversación de WhatsApp en sí ocurre directamente entre tú y la farmacia — no
          pasa por los servidores de DosisYa ni la leemos.
        </p>
        <p>
          Tu ubicación (si la compartes) se usa únicamente para calcular qué farmacias están
          cerca en el momento de la búsqueda; no queda guardada asociada a tu identidad.
        </p>
      </Seccion>

      <Seccion titulo="4. Escáner de récipe y Asistente IA">
        <p>
          La foto de tu récipe se procesa en memoria en nuestro servidor y se envía a la API
          de <strong>Google Gemini</strong> para extraer los medicamentos — DosisYa no la
          guarda ni la almacena en sus servidores ni base de datos.
        </p>
        <p>
          Los mensajes que le escribes al Asistente IA se envían a Google Gemini para generar
          la respuesta; DosisYa no guarda el historial de esa conversación en sus servidores.
        </p>
      </Seccion>

      <Seccion titulo="5. Si eres farmacia (panel B2B)">
        <p>
          Para operar tu panel guardamos los datos de tu registro: correo, nombre de la
          farmacia, RIF, WhatsApp, sector/punto de referencia y tus credenciales de acceso
          (contraseña cifrada). Los usamos para autenticarte, mostrarte tus leads y calcular
          tu facturación mensual.
        </p>
      </Seccion>

      <Seccion titulo="6. Con quién compartimos datos">
        <p>Usamos estos proveedores (subencargados) para operar DosisYa:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Google Gemini</strong> — análisis de récipes y Asistente IA.</li>
          <li><strong>Supabase</strong> — base de datos donde vive la información descrita arriba.</li>
          <li><strong>Vercel</strong> — hosting de la aplicación y la API.</li>
          <li><strong>Sentry</strong> — monitoreo de errores técnicos; puede incluir tu dirección IP si ocurre un fallo mientras usas la app.</li>
          <li><strong>n8n</strong> — envío de la notificación del lead al WhatsApp de la farmacia.</li>
        </ul>
        <p>No vendemos tus datos a terceros con fines publicitarios.</p>
      </Seccion>

      <Seccion titulo="7. Cuánto tiempo conservamos los datos">
        <p style={{ color: "var(--tinta-tenue)" }}>
          [COMPLETAR: plazo de retención de leads/interacciones y de datos de farmacias —
          hoy no hay un borrado automático definido.]
        </p>
      </Seccion>

      <Seccion titulo="8. Tus derechos">
        <p>
          Como no creamos una cuenta de paciente, no tenemos un perfil tuyo para mostrarte,
          corregir o borrar por identidad — los datos de interacción quedan asociados a la
          farmacia, no a ti. Si eres farmacia, puedes pedirnos acceder, corregir o eliminar
          los datos de tu cuenta escribiéndonos.
        </p>
      </Seccion>

      <Seccion titulo="9. Cambios a esta política">
        <p>
          Podemos actualizar esta política si cambia cómo manejamos los datos. La fecha de
          "Última actualización" arriba indica la versión vigente.
        </p>
      </Seccion>

      <Seccion titulo="10. Contacto">
        <p style={{ color: "var(--tinta-tenue)" }}>
          [COMPLETAR: correo o WhatsApp real de soporte antes de publicar — el número
          de soporte actual en la app es un placeholder de desarrollo.]
        </p>
      </Seccion>
    </LegalLayout>
  );
}

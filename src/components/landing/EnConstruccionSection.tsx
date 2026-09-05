import { motion } from "framer-motion";
import { MessageCircle, type LucideIcon } from "lucide-react";
import { construirUrlWhatsApp, WHATSAPP_COMERCIAL } from "@/lib/whatsapp";

/**
 * Bloque compartido para las líneas de negocio que DosisYa todavía está
 * diseñando (Productores, Creditiendas, Gremio) — no existen backend ni
 * flujo aún, así que en vez de inventar cifras o alianzas mostramos el
 * enfoque real y una vía de contacto directa. Ver open question en el plan
 * de la landing: falta contenido real del negocio para reemplazar esto.
 */
export function EnConstruccionSection({
  id,
  etiqueta,
  icono: Icono,
  titulo,
  descripcion,
  mensajeWhatsApp,
  fondo = "var(--papel)",
}: {
  id: string;
  etiqueta: string;
  icono: LucideIcon;
  titulo: string;
  descripcion: string;
  mensajeWhatsApp: string;
  fondo?: string;
}) {
  const urlWhatsApp = construirUrlWhatsApp(WHATSAPP_COMERCIAL, mensajeWhatsApp);

  return (
    <section id={id} className="px-5 py-24" style={{ background: fondo }}>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.5 }}
        className="mx-auto flex max-w-3xl flex-col items-center rounded-[24px] px-6 py-14 text-center sm:px-14"
        style={{ background: "var(--blanco)", border: "1px dashed var(--borde)" }}
      >
        <div
          className="flex h-14 w-14 items-center justify-center rounded-2xl"
          style={{ background: "var(--disp-fondo)" }}
        >
          <Icono className="h-6 w-6" style={{ color: "var(--verde-cruz)" }} aria-hidden="true" />
        </div>

        <span
          className="mt-5 inline-flex items-center rounded-full px-3.5 py-1.5 text-xs font-semibold tracking-wide uppercase"
          style={{ background: "var(--ambar-fondo)", color: "var(--ambar-receta)" }}
        >
          {etiqueta} · en construcción
        </span>

        <h2
          className="mt-4 text-2xl font-black sm:text-3xl"
          style={{ color: "var(--tinta)", letterSpacing: "-0.02em" }}
        >
          {titulo}
        </h2>
        <p
          className="mt-4 max-w-xl text-[16px] leading-relaxed"
          style={{ color: "var(--tinta-suave)" }}
        >
          {descripcion}
        </p>

        {urlWhatsApp && (
          <a
            href={urlWhatsApp}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-7 inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: "var(--whatsapp)" }}
          >
            <MessageCircle className="h-4 w-4" aria-hidden="true" />
            Conversemos por WhatsApp
          </a>
        )}
      </motion.div>
    </section>
  );
}

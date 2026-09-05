import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowRight, Building2, MessageCircle, Search } from "lucide-react";
import { construirUrlWhatsApp, WHATSAPP_COMERCIAL } from "@/lib/whatsapp";

export function RegistrarseSection() {
  const urlOtros = construirUrlWhatsApp(
    WHATSAPP_COMERCIAL,
    "Hola, quiero más información sobre DosisYa (Productores / Gremio / Creditiendas).",
  );

  return (
    <section id="registrarse" className="px-5 py-24" style={{ background: "var(--fondo-suave)" }}>
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <span
            className="inline-flex items-center rounded-full px-3.5 py-1.5 text-xs font-semibold tracking-wide uppercase"
            style={{ background: "var(--disp-fondo)", color: "var(--disp-text)" }}
          >
            Registrarse
          </span>
          <h2
            className="mt-4 text-3xl font-black sm:text-4xl"
            style={{ color: "var(--tinta)", letterSpacing: "-0.02em" }}
          >
            Elige cómo quieres entrar a DosisYa
          </h2>
        </div>

        <div className="mt-12 grid gap-5 md:grid-cols-3">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.45 }}
            className="flex flex-col rounded-[22px] p-7"
            style={{ background: "var(--blanco)", border: "1px solid var(--borde)" }}
          >
            <div
              className="flex h-12 w-12 items-center justify-center rounded-2xl"
              style={{ background: "var(--disp-fondo)" }}
            >
              <Search
                className="h-5 w-5"
                style={{ color: "var(--verde-cruz)" }}
                aria-hidden="true"
              />
            </div>
            <h3 className="mt-4 text-lg font-semibold" style={{ color: "var(--tinta)" }}>
              Soy paciente
            </h3>
            <p
              className="mt-2 flex-1 text-sm leading-relaxed"
              style={{ color: "var(--tinta-suave)" }}
            >
              No necesitas registrarte. Busca tu medicamento y contacta a la farmacia directamente.
            </p>
            <Link
              to="/buscar"
              className="mt-5 inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{ background: "var(--verde-cruz)" }}
            >
              Buscar ahora
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.45, delay: 0.08 }}
            className="relative flex flex-col rounded-[22px] p-7"
            style={{ background: "var(--verde-cruz)", border: "1px solid var(--verde-cruz)" }}
          >
            <span
              className="absolute top-6 right-6 rounded-full px-2.5 py-1 text-[11px] font-semibold"
              style={{ background: "rgba(95,214,164,0.25)", color: "var(--verde-claro)" }}
            >
              Recomendado
            </span>
            <div
              className="flex h-12 w-12 items-center justify-center rounded-2xl"
              style={{ background: "rgba(255,255,255,0.14)" }}
            >
              <Building2 className="h-5 w-5 text-white" aria-hidden="true" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-white">Soy farmacia</h3>
            <p
              className="mt-2 flex-1 text-sm leading-relaxed"
              style={{ color: "rgba(255,255,255,0.85)" }}
            >
              Regístrate, sube tu inventario y empieza a recibir contactos de pacientes cercanos por
              WhatsApp.
            </p>
            <Link
              to="/admin/login"
              className="mt-5 inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90"
              style={{ background: "#ffffff", color: "var(--verde-cruz)" }}
            >
              Registrar mi farmacia
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.45, delay: 0.16 }}
            className="flex flex-col rounded-[22px] p-7"
            style={{ background: "var(--blanco)", border: "1px solid var(--borde)" }}
          >
            <div
              className="flex h-12 w-12 items-center justify-center rounded-2xl"
              style={{ background: "var(--disp-fondo)" }}
            >
              <MessageCircle
                className="h-5 w-5"
                style={{ color: "var(--verde-cruz)" }}
                aria-hidden="true"
              />
            </div>
            <h3 className="mt-4 text-lg font-semibold" style={{ color: "var(--tinta)" }}>
              Soy productor, gremio o inversor
            </h3>
            <p
              className="mt-2 flex-1 text-sm leading-relaxed"
              style={{ color: "var(--tinta-suave)" }}
            >
              Estas líneas todavía están en construcción. Escríbenos directo y conversamos.
            </p>
            {urlOtros && (
              <a
                href={urlOtros}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-5 inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90"
                style={{
                  background: "var(--blanco)",
                  color: "var(--verde-cruz)",
                  border: "1.5px solid var(--verde-cruz)",
                }}
              >
                Contactar al equipo
              </a>
            )}
          </motion.div>
        </div>
      </div>
    </section>
  );
}

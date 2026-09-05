import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowRight, BadgeCheck, Sparkles, Wallet } from "lucide-react";

const BENEFICIOS = [
  {
    icono: Wallet,
    titulo: "Pagas por contacto, no por venta",
    texto:
      "Cobramos por cada lead que te llega a WhatsApp — no cobramos comisión sobre lo que vendes.",
  },
  {
    icono: Sparkles,
    titulo: "Inventario normalizado con IA",
    texto:
      "Sube tu inventario y nuestro sistema lo normaliza automáticamente contra el catálogo de DosisYa.",
  },
  {
    icono: BadgeCheck,
    titulo: "Tu logística sigue siendo tuya",
    texto:
      "Sin flota obligatoria: entregas con tu motorizado propio o con Yummy, como ya lo haces hoy.",
  },
];

export function ComercioSection() {
  return (
    <section id="comercio" className="px-5 py-24" style={{ background: "var(--blanco)" }}>
      <div className="mx-auto grid max-w-6xl gap-14 lg:grid-cols-2 lg:items-center">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5 }}
        >
          <span
            className="inline-flex items-center rounded-full px-3.5 py-1.5 text-xs font-semibold tracking-wide uppercase"
            style={{ background: "var(--disp-fondo)", color: "var(--disp-text)" }}
          >
            Comercio · Farmacias
          </span>
          <h2
            className="mt-4 text-3xl font-black sm:text-4xl"
            style={{ color: "var(--tinta)", letterSpacing: "-0.02em" }}
          >
            Aparece frente a pacientes que ya te están buscando
          </h2>
          <p className="mt-4 text-[17px] leading-relaxed" style={{ color: "var(--tinta-suave)" }}>
            En Acarigua y Araure hay pacientes buscando tu medicamento ahora mismo. DosisYa te
            muestra frente a ellos y te lleva el contacto directo a WhatsApp, con un modelo simple
            de pago por lead.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/admin/login"
              className="group inline-flex items-center justify-center gap-2 rounded-full px-6 py-3.5 text-[15px] font-semibold text-white transition-transform hover:-translate-y-0.5"
              style={{ background: "var(--verde-cruz)" }}
            >
              Únete como farmacia
              <ArrowRight
                className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </Link>
          </div>
        </motion.div>

        <div className="flex flex-col gap-4">
          {BENEFICIOS.map((b, i) => (
            <motion.div
              key={b.titulo}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.45, delay: i * 0.1 }}
              className="flex gap-4 rounded-2xl p-5"
              style={{ background: "var(--papel)", border: "1px solid var(--borde)" }}
            >
              <div
                className="flex h-11 w-11 flex-none items-center justify-center rounded-2xl"
                style={{ background: "var(--verde-cruz)" }}
              >
                <b.icono className="h-5 w-5 text-white" aria-hidden="true" />
              </div>
              <div>
                <h3 className="text-[15px] font-semibold" style={{ color: "var(--tinta)" }}>
                  {b.titulo}
                </h3>
                <p className="mt-1 text-sm leading-relaxed" style={{ color: "var(--tinta-suave)" }}>
                  {b.texto}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

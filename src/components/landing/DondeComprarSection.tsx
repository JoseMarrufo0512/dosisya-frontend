import { motion } from "framer-motion";
import { MapPinned, MessagesSquare, SearchCheck, Truck } from "lucide-react";

const PASOS = [
  {
    icono: SearchCheck,
    titulo: "Busca tu medicamento",
    texto:
      "Escribe el nombre del medicamento (o sube tu récipe). Sin crear cuenta ni iniciar sesión.",
  },
  {
    icono: MapPinned,
    titulo: "Compara farmacias cercanas",
    texto:
      "Verás las farmacias de Acarigua y Araure que reportan stock, con precio en USD y en Bs.",
  },
  {
    icono: MessagesSquare,
    titulo: "Contacta por WhatsApp",
    texto:
      "Un toque te lleva directo al WhatsApp de la farmacia elegida — ya con tu pedido armado.",
  },
  {
    icono: Truck,
    titulo: "Recíbelo o pasa a buscarlo",
    texto:
      "La farmacia coordina la entrega contigo (motorizado propio o Yummy) o lo retiras en el local.",
  },
];

export function DondeComprarSection() {
  return (
    <section id="donde-comprar" className="px-5 py-24" style={{ background: "var(--papel)" }}>
      <div className="mx-auto max-w-6xl">
        <div className="max-w-2xl">
          <span
            className="inline-flex items-center rounded-full px-3.5 py-1.5 text-xs font-semibold tracking-wide uppercase"
            style={{ background: "var(--disp-fondo)", color: "var(--disp-text)" }}
          >
            Dónde comprar
          </span>
          <h2
            className="mt-4 text-3xl font-black sm:text-4xl"
            style={{ color: "var(--tinta)", letterSpacing: "-0.02em" }}
          >
            Tu farmacia más cercana, en cuatro pasos
          </h2>
          <p className="mt-4 text-[17px] leading-relaxed" style={{ color: "var(--tinta-suave)" }}>
            Nada de formularios ni contraseñas: DosisYa está pensado para que cualquier paciente en
            Acarigua o Araure encuentre su medicamento y hable con la farmacia en menos de un
            minuto.
          </p>
        </div>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {PASOS.map((paso, i) => (
            <motion.div
              key={paso.titulo}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.45, delay: i * 0.08 }}
              className="relative rounded-[20px] p-6 transition-transform duration-200 hover:-translate-y-1"
              style={{
                background: "var(--blanco)",
                border: "1px solid var(--borde)",
                boxShadow: "0 8px 28px -16px rgba(22,24,26,0.14)",
              }}
            >
              <span
                className="absolute top-5 right-5 text-2xl font-black"
                style={{ color: "var(--borde)" }}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <div
                className="flex h-11 w-11 items-center justify-center rounded-2xl"
                style={{ background: "var(--disp-fondo)" }}
              >
                <paso.icono
                  className="h-5 w-5"
                  style={{ color: "var(--verde-cruz)" }}
                  aria-hidden="true"
                />
              </div>
              <h3 className="mt-4 text-[15px] font-semibold" style={{ color: "var(--tinta)" }}>
                {paso.titulo}
              </h3>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--tinta-suave)" }}>
                {paso.texto}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

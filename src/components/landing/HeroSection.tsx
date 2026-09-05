import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowRight, MapPin, MessageCircle, ShieldCheck } from "lucide-react";

const SEÑALES = [
  { icono: ShieldCheck, texto: "Sin registro para buscar" },
  { icono: MapPin, texto: "Farmacias reales de Acarigua y Araure" },
  { icono: MessageCircle, texto: "Contacto directo por WhatsApp" },
];

export function HeroSection() {
  return (
    <section
      id="inicio"
      className="relative flex min-h-[92vh] items-center overflow-hidden pt-16"
      style={{
        background:
          "linear-gradient(150deg, var(--verde-cruz) 0%, #0e5a41 45%, var(--verde-vivo) 100%)",
      }}
    >
      <div
        aria-hidden="true"
        className="absolute -top-32 -right-24 h-[420px] w-[420px] rounded-full"
        style={{ background: "rgba(95,214,164,0.22)", filter: "blur(90px)" }}
      />
      <div
        aria-hidden="true"
        className="absolute -bottom-40 -left-24 h-[380px] w-[380px] rounded-full"
        style={{ background: "rgba(29,158,117,0.35)", filter: "blur(100px)" }}
      />

      <div className="relative mx-auto grid w-full max-w-6xl gap-12 px-5 py-16 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <span
            className="inline-flex items-center rounded-full px-3.5 py-1.5 text-xs font-semibold tracking-wide uppercase"
            style={{
              background: "rgba(95,214,164,0.18)",
              color: "var(--verde-claro)",
              border: "1px solid rgba(95,214,164,0.35)",
            }}
          >
            Marketplace farmacéutico hiperlocal
          </span>

          <h1
            className="mt-6 text-4xl leading-[1.08] font-black text-white sm:text-5xl lg:text-6xl"
            style={{ letterSpacing: "-0.025em" }}
          >
            Encuentra tu medicamento cerca de ti,{" "}
            <span style={{ color: "var(--verde-claro)" }}>hoy mismo.</span>
          </h1>

          <p
            className="mt-5 max-w-[520px] text-lg leading-relaxed"
            style={{ color: "rgba(255,255,255,0.86)" }}
          >
            DosisYa conecta a pacientes de Acarigua y Araure con las farmacias que ya tienen su
            medicamento en stock. Compara precios en USD y Bs., y escribe por WhatsApp directo a la
            farmacia — sin crear cuenta, sin fricción.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              to="/buscar"
              className="group inline-flex items-center justify-center gap-2 rounded-full px-6 py-3.5 text-[15px] font-semibold shadow-lg transition-transform hover:-translate-y-0.5"
              style={{ background: "#ffffff", color: "var(--verde-cruz)" }}
            >
              Buscar medicamentos
              <ArrowRight
                className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </Link>
            <a
              href="#registrarse"
              onClick={(e) => {
                e.preventDefault();
                document.querySelector("#registrarse")?.scrollIntoView({ behavior: "smooth" });
              }}
              className="inline-flex items-center justify-center gap-2 rounded-full px-6 py-3.5 text-[15px] font-semibold text-white transition-colors hover:bg-white/10"
              style={{ border: "1.5px solid rgba(255,255,255,0.45)" }}
            >
              Registra tu farmacia
            </a>
          </div>

          <ul className="mt-9 flex flex-wrap gap-x-7 gap-y-3">
            {SEÑALES.map(({ icono: Icono, texto }) => (
              <li
                key={texto}
                className="flex items-center gap-2 text-sm"
                style={{ color: "rgba(255,255,255,0.82)" }}
              >
                <Icono
                  className="h-4 w-4 flex-none"
                  style={{ color: "var(--verde-claro)" }}
                  aria-hidden="true"
                />
                {texto}
              </li>
            ))}
          </ul>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.15, ease: "easeOut" }}
          className="relative hidden lg:block"
        >
          <div
            className="mx-auto max-w-[360px] rounded-[28px] p-1.5"
            style={{
              background: "rgba(255,255,255,0.12)",
              border: "1px solid rgba(255,255,255,0.18)",
            }}
          >
            <div
              className="rounded-[22px] p-5"
              style={{
                background: "var(--papel)",
                boxShadow: "0 30px 60px -20px rgba(0,0,0,0.45)",
              }}
            >
              <div
                className="flex items-center gap-2 rounded-full px-4 py-3"
                style={{ background: "var(--blanco)", border: "1px solid var(--borde)" }}
              >
                <span className="text-sm" style={{ color: "var(--tinta-tenue)" }}>
                  Buscar: Losartán 50mg
                </span>
              </div>

              {[
                { farmacia: "Farmacia San Rafael", distancia: "0.4 km", precio: "$3.50" },
                { farmacia: "Farmacia Central Araure", distancia: "1.1 km", precio: "$3.80" },
              ].map((r) => (
                <div
                  key={r.farmacia}
                  className="mt-3 rounded-2xl p-3.5"
                  style={{ background: "var(--blanco)", border: "1px solid var(--borde)" }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold" style={{ color: "var(--tinta)" }}>
                      {r.farmacia}
                    </span>
                    <span className="text-sm font-bold" style={{ color: "var(--verde-cruz)" }}>
                      {r.precio}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-xs" style={{ color: "var(--tinta-tenue)" }}>
                      A {r.distancia} de ti
                    </span>
                    <span
                      className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold text-white"
                      style={{ background: "var(--whatsapp)" }}
                    >
                      <MessageCircle className="h-3 w-3" aria-hidden="true" />
                      Contactar
                    </span>
                  </div>
                </div>
              ))}
              <p className="mt-3 text-center text-[11px]" style={{ color: "var(--tinta-tenue)" }}>
                Ejemplo ilustrativo de la búsqueda en vivo
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

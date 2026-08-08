import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Building2, Search, TrendingUp } from "lucide-react";
import { construirUrlWhatsApp } from "@/lib/whatsapp";

const WHATSAPP_COMERCIAL = "+584245928624";

export const Route = createFileRoute("/acerca-de")({
  head: () => ({
    meta: [
      { title: "Acerca de DosisYa" },
      {
        name: "description",
        content:
          "Qué es DosisYa: marketplace hiperlocal de medicamentos en Acarigua/Araure. Información para pacientes, farmacias e inversores.",
      },
    ],
  }),
  component: AcercaDe,
});

function AcercaDe() {
  const urlFarmacias = construirUrlWhatsApp(
    WHATSAPP_COMERCIAL,
    "Hola, quiero información sobre unirme a DosisYa como farmacia.",
  );
  const urlInversores = construirUrlWhatsApp(
    WHATSAPP_COMERCIAL,
    "Hola, quiero más información sobre DosisYa.",
  );

  return (
    <div className="dosisya-ui min-h-screen" style={{ background: "var(--papel)" }}>
      <div className="mx-auto max-w-2xl">
        <div
          className="relative overflow-hidden px-5 py-12 text-white"
          style={{
            // Verde intermedio sintetizado para el degradé — no es un token nuevo,
            // es la interpolación visual entre --verde-cruz y --verde-vivo.
            background:
              "linear-gradient(140deg, var(--verde-cruz) 0%, #0e5a41 48%, var(--verde-vivo) 100%)",
          }}
        >
          <div
            aria-hidden="true"
            className="absolute -top-20 -right-[70px] h-[260px] w-[260px] rounded-full"
            style={{ background: "rgba(95,214,164,0.25)", filter: "blur(50px)" }}
          />

          <Link
            to="/"
            className="relative inline-flex items-center gap-1.5 text-sm"
            style={{ color: "rgba(255,255,255,0.85)" }}
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Volver a DosisYa
          </Link>

          <h1
            className="relative mt-5 text-3xl font-black"
            style={{ letterSpacing: "-0.02em" }}
          >
            <span style={{ color: "#ffffff" }}>Dosis</span>
            <span style={{ color: "var(--verde-claro)" }}>Ya</span>
          </h1>
          <p
            className="relative mt-2.5 max-w-[440px] text-[15px] leading-relaxed"
            style={{ color: "rgba(255,255,255,0.85)" }}
          >
            Marketplace hiperlocal de medicamentos en Acarigua y Araure. Buscamos que
            cualquier paciente encuentre, compare y contacte a la farmacia más cercana con
            su medicamento en stock — sin registrarse, sin fricción.
          </p>

          <ul className="relative mt-[22px] flex list-none flex-col gap-[11px] p-0">
            <li className="flex items-start gap-2.5">
              <span
                className="flex h-6 w-6 flex-none items-center justify-center rounded-[7px]"
                style={{
                  background: "rgba(95,214,164,0.2)",
                  border: "1px solid rgba(95,214,164,0.3)",
                }}
              >
                <Search
                  className="h-3.5 w-3.5"
                  style={{ color: "var(--verde-claro)" }}
                  strokeWidth={2.5}
                  aria-hidden="true"
                />
              </span>
              <span className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.9)" }}>
                Pacientes buscan y contactan sin registrarse
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <span
                className="flex h-6 w-6 flex-none items-center justify-center rounded-[7px]"
                style={{
                  background: "rgba(95,214,164,0.2)",
                  border: "1px solid rgba(95,214,164,0.3)",
                }}
              >
                <Building2
                  className="h-3.5 w-3.5"
                  style={{ color: "var(--verde-claro)" }}
                  strokeWidth={2.5}
                  aria-hidden="true"
                />
              </span>
              <span className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.9)" }}>
                Farmacias pagan por contacto, no por venta
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <span
                className="flex h-6 w-6 flex-none items-center justify-center rounded-[7px]"
                style={{
                  background: "rgba(95,214,164,0.2)",
                  border: "1px solid rgba(95,214,164,0.3)",
                }}
              >
                <TrendingUp
                  className="h-3.5 w-3.5"
                  style={{ color: "var(--verde-claro)" }}
                  strokeWidth={2.5}
                  aria-hidden="true"
                />
              </span>
              <span className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.9)" }}>
                Modelo B2B de leads, sin flota propia
              </span>
            </li>
          </ul>
        </div>

        <div className="flex flex-col gap-4 px-5 pt-6 pb-10">
          <section
            id="pacientes"
            className="dy-animar-entrada rounded-[20px] p-[22px] transition-transform duration-200 hover:-translate-y-[3px]"
            style={{
              border: "1px solid var(--borde)",
              background: "var(--blanco)",
              boxShadow: "0 8px 32px -12px rgba(22,24,26,0.1)",
              animationDelay: "0.08s",
            }}
          >
            <div
              className="flex h-11 w-11 items-center justify-center rounded-2xl"
              style={{ background: "var(--disp-fondo)" }}
            >
              <Search className="h-5 w-5" style={{ color: "var(--verde-cruz)" }} aria-hidden="true" />
            </div>
            <h2 className="mt-3.5 text-lg font-semibold" style={{ color: "var(--verde-cruz)" }}>
              Para pacientes
            </h2>
            <p className="mt-2 text-[15px] leading-relaxed" style={{ color: "var(--tinta-suave)" }}>
              Busca tu medicamento, compara precio y disponibilidad entre farmacias cercanas,
              arma tu Lista Médica si necesitas varios productos, y contacta a la farmacia
              directo por WhatsApp. Todo sin crear cuenta ni iniciar sesión.
            </p>
            <Link
              to="/"
              className="mt-4 inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{ background: "var(--verde-cruz)" }}
            >
              Buscar medicamentos
            </Link>
          </section>

          <section
            id="farmacias"
            className="dy-animar-entrada relative rounded-[20px] p-[22px] transition-transform duration-200 hover:-translate-y-[3px]"
            style={{
              border: "1.5px solid var(--verde-cruz)",
              background: "var(--disp-fondo)",
              animationDelay: "0.16s",
            }}
          >
            <div
              className="flex h-11 w-11 items-center justify-center rounded-2xl"
              style={{ background: "var(--verde-cruz)" }}
            >
              <Building2 className="h-5 w-5 text-white" aria-hidden="true" />
            </div>
            <span
              aria-hidden="true"
              className="dy-pulso absolute top-[22px] right-[22px] h-[9px] w-[9px] rounded-full"
              style={{ background: "var(--whatsapp)" }}
            />
            <h2 className="mt-3.5 text-lg font-semibold" style={{ color: "var(--verde-cruz)" }}>
              Para farmacias
            </h2>
            <p className="mt-2 text-[15px] leading-relaxed" style={{ color: "var(--tinta)" }}>
              Aparece frente a pacientes de Acarigua y Araure que ya están buscando ese
              medicamento cerca de ti. Cobramos por cada contacto que te llega por WhatsApp —
              no cobramos comisión por venta, y tu logística de entrega sigue siendo tuya
              (motorizado propio o Yummy).
            </p>
            {urlFarmacias && (
              <a
                href={urlFarmacias}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                style={{ background: "var(--whatsapp)" }}
              >
                Quiero unir mi farmacia
              </a>
            )}
          </section>

          <section
            id="inversores"
            className="dy-animar-entrada rounded-[20px] p-[22px] transition-transform duration-200 hover:-translate-y-[3px]"
            style={{
              border: "1px solid var(--borde)",
              background: "var(--blanco)",
              animationDelay: "0.24s",
            }}
          >
            <div
              className="flex h-11 w-11 items-center justify-center rounded-2xl"
              style={{ background: "var(--disp-fondo)" }}
            >
              <TrendingUp className="h-5 w-5" style={{ color: "var(--verde-cruz)" }} aria-hidden="true" />
            </div>
            <h2 className="mt-3.5 text-lg font-semibold" style={{ color: "var(--verde-cruz)" }}>
              Para inversores y prensa
            </h2>
            <p className="mt-2 text-[15px] leading-relaxed" style={{ color: "var(--tinta-suave)" }}>
              DosisYa conecta oferta y demanda de medicamentos a nivel hiperlocal con un
              modelo de leads B2B: las farmacias pagan por cada contacto que reciben, no por
              transacción. La última milla la resuelve cada farmacia, lo que nos permite
              crecer sin operar flota propia.
            </p>
            {urlInversores && (
              <a
                href={urlInversores}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90"
                style={{
                  background: "var(--blanco)",
                  color: "var(--verde-cruz)",
                  border: "1.5px solid var(--verde-cruz)",
                }}
              >
                Contactar al equipo
              </a>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

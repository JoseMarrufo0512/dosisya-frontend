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
      <div style={{ background: "var(--verde-cruz)" }} className="px-5 py-12">
        <div className="mx-auto max-w-2xl">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm"
            style={{ color: "rgba(255,255,255,0.85)" }}
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Volver a DosisYa
          </Link>

          <div className="mt-8 text-center">
            <h1 className="text-3xl font-black" style={{ letterSpacing: "-0.02em" }}>
              <span style={{ color: "#ffffff" }}>Dosis</span>
              <span style={{ color: "var(--verde-claro)" }}>Ya</span>
            </h1>
            <p
              className="mt-3 text-[15px] leading-relaxed"
              style={{ color: "rgba(255,255,255,0.85)" }}
            >
              Marketplace hiperlocal de medicamentos en Acarigua y Araure. Buscamos que
              cualquier paciente encuentre, compare y contacte a la farmacia más cercana con
              su medicamento en stock — sin registrarse, sin fricción.
            </p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-2xl space-y-6 px-5 py-10">
        <section
          id="pacientes"
          className="rounded-3xl p-7"
          style={{ background: "var(--disp-fondo)" }}
        >
          <div
            className="flex h-11 w-11 items-center justify-center rounded-2xl"
            style={{ background: "var(--verde-cruz)" }}
          >
            <Search className="h-5 w-5 text-white" aria-hidden="true" />
          </div>
          <h2 className="mt-4 text-lg font-semibold" style={{ color: "var(--verde-cruz)" }}>
            Para pacientes
          </h2>
          <p className="mt-2 text-[15px] leading-relaxed" style={{ color: "var(--tinta)" }}>
            Busca tu medicamento, compara precio y disponibilidad entre farmacias cercanas,
            arma tu Lista Médica si necesitas varios productos, y contacta a la farmacia
            directo por WhatsApp. Todo sin crear cuenta ni iniciar sesión.
          </p>
          <Link
            to="/"
            className="mt-5 inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: "var(--verde-cruz)" }}
          >
            Buscar medicamentos
          </Link>
        </section>

        <section
          id="farmacias"
          className="rounded-3xl p-7"
          style={{ background: "var(--ambar-receta)" }}
        >
          <div
            className="flex h-11 w-11 items-center justify-center rounded-2xl"
            style={{ background: "rgba(255,255,255,0.2)" }}
          >
            <Building2 className="h-5 w-5 text-white" aria-hidden="true" />
          </div>
          <h2 className="mt-4 text-lg font-semibold text-white">Para farmacias</h2>
          <p
            className="mt-2 text-[15px] leading-relaxed"
            style={{ color: "rgba(255,255,255,0.92)" }}
          >
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
              className="mt-5 inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90"
              style={{ background: "#ffffff", color: "var(--ambar-receta)" }}
            >
              Quiero unir mi farmacia
            </a>
          )}
        </section>

        <section
          id="inversores"
          className="mb-2 rounded-3xl p-7"
          style={{ background: "var(--tinta)" }}
        >
          <div
            className="flex h-11 w-11 items-center justify-center rounded-2xl"
            style={{ background: "rgba(255,255,255,0.12)" }}
          >
            <TrendingUp className="h-5 w-5 text-white" aria-hidden="true" />
          </div>
          <h2 className="mt-4 text-lg font-semibold text-white">Para inversores y prensa</h2>
          <p
            className="mt-2 text-[15px] leading-relaxed"
            style={{ color: "rgba(255,255,255,0.85)" }}
          >
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
              className="mt-5 inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90"
              style={{ background: "#ffffff", color: "var(--tinta)" }}
            >
              Contactar al equipo
            </a>
          )}
        </section>
      </div>
    </div>
  );
}

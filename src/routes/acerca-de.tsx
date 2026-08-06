import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
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
      <div className="mx-auto max-w-2xl px-5 py-10">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm"
          style={{ color: "var(--tinta-tenue)" }}
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Volver a DosisYa
        </Link>

        <div className="mt-8 text-center">
          <h1 className="text-3xl font-black" style={{ letterSpacing: "-0.02em" }}>
            <span style={{ color: "var(--tinta)" }}>Dosis</span>
            <span style={{ color: "var(--verde-cruz)" }}>Ya</span>
          </h1>
          <p
            className="mt-3 text-[15px] leading-relaxed"
            style={{ color: "var(--tinta-suave)" }}
          >
            Marketplace hiperlocal de medicamentos en Acarigua y Araure. Buscamos que
            cualquier paciente encuentre, compare y contacte a la farmacia más cercana con
            su medicamento en stock — sin registrarse, sin fricción.
          </p>
        </div>

        <section id="pacientes" className="mt-12">
          <h2 className="text-lg font-semibold" style={{ color: "var(--verde-cruz)" }}>
            Para pacientes
          </h2>
          <p className="mt-2 text-[15px] leading-relaxed" style={{ color: "var(--tinta)" }}>
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

        <section id="farmacias" className="mt-10">
          <h2 className="text-lg font-semibold" style={{ color: "var(--verde-cruz)" }}>
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

        <section id="inversores" className="mt-10 mb-10">
          <h2 className="text-lg font-semibold" style={{ color: "var(--verde-cruz)" }}>
            Para inversores y prensa
          </h2>
          <p className="mt-2 text-[15px] leading-relaxed" style={{ color: "var(--tinta)" }}>
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
              className="mt-4 inline-flex items-center justify-center rounded-full border px-5 py-2.5 text-sm font-semibold transition-colors hover:bg-[var(--fondo-suave)]"
              style={{ borderColor: "var(--verde-cruz)", color: "var(--verde-cruz)" }}
            >
              Contactar al equipo
            </a>
          )}
        </section>
      </div>
    </div>
  );
}

import { Link } from "@tanstack/react-router";
import { MapPin, MessageCircle } from "lucide-react";
import { construirUrlWhatsApp, WHATSAPP_COMERCIAL } from "@/lib/whatsapp";

const COLUMNAS = [
  {
    titulo: "DosisYa",
    enlaces: [
      { label: "Inicio", href: "#inicio" },
      { label: "Dónde comprar", href: "#donde-comprar" },
      { label: "Comercio", href: "#comercio" },
      { label: "Registrarse", href: "#registrarse" },
    ],
  },
  {
    titulo: "En construcción",
    enlaces: [
      { label: "Productores", href: "#productores" },
      { label: "Creditiendas", href: "#creditiendas" },
      { label: "Gremio", href: "#gremio" },
    ],
  },
];

function irASeccion(e: React.MouseEvent, href: string) {
  e.preventDefault();
  document.querySelector(href)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function Footer() {
  const urlSoporte = construirUrlWhatsApp(
    WHATSAPP_COMERCIAL,
    "Hola, tengo una consulta sobre DosisYa.",
  );

  return (
    <footer style={{ background: "var(--verde-cruz)" }}>
      <div className="mx-auto max-w-6xl px-5 py-16">
        <div className="grid gap-12 lg:grid-cols-[1.3fr_1fr_1fr]">
          <div>
            <span className="text-xl font-black" style={{ letterSpacing: "-0.02em" }}>
              <span className="text-white">Dosis</span>
              <span style={{ color: "var(--verde-claro)" }}>Ya</span>
            </span>
            <p
              className="mt-3 max-w-sm text-sm leading-relaxed"
              style={{ color: "rgba(255,255,255,0.72)" }}
            >
              Una PYME venezolana construyendo el marketplace farmacéutico hiperlocal de Acarigua y
              Araure — sin fricción para el paciente, sin comisión por venta para la farmacia.
            </p>
            <div
              className="mt-5 flex items-center gap-2 text-sm"
              style={{ color: "rgba(255,255,255,0.62)" }}
            >
              <MapPin className="h-4 w-4 flex-none" aria-hidden="true" />
              Acarigua y Araure, estado Portuguesa, Venezuela
            </div>
            {urlSoporte && (
              <a
                href={urlSoporte}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-5 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                style={{ background: "var(--whatsapp)" }}
              >
                <MessageCircle className="h-4 w-4" aria-hidden="true" />
                Escríbenos por WhatsApp
              </a>
            )}
          </div>

          {COLUMNAS.map((col) => (
            <div key={col.titulo}>
              <h3
                className="text-sm font-semibold tracking-wide uppercase"
                style={{ color: "var(--verde-claro)" }}
              >
                {col.titulo}
              </h3>
              <ul className="mt-4 flex flex-col gap-2.5">
                {col.enlaces.map((enlace) => (
                  <li key={enlace.href}>
                    <a
                      href={enlace.href}
                      onClick={(e) => irASeccion(e, enlace.href)}
                      className="text-sm transition-opacity hover:opacity-80"
                      style={{ color: "rgba(255,255,255,0.78)" }}
                    >
                      {enlace.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div
          className="mt-14 flex flex-col gap-4 border-t pt-6 text-sm sm:flex-row sm:items-center sm:justify-between"
          style={{ borderColor: "rgba(255,255,255,0.14)", color: "rgba(255,255,255,0.6)" }}
        >
          <span>© {new Date().getFullYear()} DosisYa. Todos los derechos reservados.</span>
          <div className="flex gap-5">
            <Link to="/acerca-de" className="transition-opacity hover:opacity-80">
              Acerca de
            </Link>
            <Link to="/terminos" className="transition-opacity hover:opacity-80">
              Términos
            </Link>
            <Link to="/privacidad" className="transition-opacity hover:opacity-80">
              Privacidad
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

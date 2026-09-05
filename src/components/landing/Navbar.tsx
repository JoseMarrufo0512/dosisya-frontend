import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, X } from "lucide-react";

const ENLACES = [
  { href: "#inicio", label: "Inicio" },
  { href: "#productores", label: "Productores" },
  { href: "#donde-comprar", label: "Dónde Comprar" },
  { href: "#comercio", label: "Comercio" },
  { href: "#creditiendas", label: "Creditiendas" },
  { href: "#gremio", label: "Gremio" },
];

/** Scroll suave a una sección ancla sin dejar el `#` sucio en el historial. */
function irASeccion(e: React.MouseEvent, href: string) {
  e.preventDefault();
  document.querySelector(href)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function Navbar() {
  const [conFondo, setConFondo] = useState(false);
  const [menuAbierto, setMenuAbierto] = useState(false);

  useEffect(() => {
    const onScroll = () => setConFondo(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className="fixed inset-x-0 top-0 z-50 transition-[background-color,box-shadow] duration-300"
      style={{
        background: conFondo ? "rgba(250,250,247,0.9)" : "transparent",
        backdropFilter: conFondo ? "blur(10px)" : "none",
        boxShadow: conFondo ? "0 1px 0 var(--borde)" : "none",
      }}
    >
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <a
          href="#inicio"
          onClick={(e) => irASeccion(e, "#inicio")}
          className="text-xl font-black"
          style={{ letterSpacing: "-0.02em" }}
        >
          <span style={{ color: conFondo ? "var(--verde-cruz)" : "#ffffff" }}>Dosis</span>
          <span style={{ color: "var(--verde-claro)" }}>Ya</span>
        </a>

        <ul className="hidden items-center gap-7 lg:flex">
          {ENLACES.map((enlace) => (
            <li key={enlace.href}>
              <a
                href={enlace.href}
                onClick={(e) => irASeccion(e, enlace.href)}
                className="text-sm font-medium transition-opacity hover:opacity-70"
                style={{ color: conFondo ? "var(--tinta)" : "rgba(255,255,255,0.92)" }}
              >
                {enlace.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="hidden items-center gap-3 lg:flex">
          <a
            href="#registrarse"
            onClick={(e) => irASeccion(e, "#registrarse")}
            className="text-sm font-semibold transition-opacity hover:opacity-70"
            style={{ color: conFondo ? "var(--tinta)" : "rgba(255,255,255,0.92)" }}
          >
            Registrarse
          </a>
          <Link
            to="/buscar"
            className="inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: "var(--verde-cruz)" }}
          >
            Buscar medicamentos
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setMenuAbierto((v) => !v)}
          className="flex h-9 w-9 items-center justify-center rounded-full lg:hidden"
          style={{
            color: conFondo ? "var(--tinta)" : "#ffffff",
            background: conFondo ? "var(--fondo-suave)" : "rgba(255,255,255,0.14)",
          }}
          aria-label={menuAbierto ? "Cerrar menú" : "Abrir menú"}
          aria-expanded={menuAbierto}
        >
          {menuAbierto ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </nav>

      <AnimatePresence>
        {menuAbierto && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="border-t lg:hidden"
            style={{ background: "var(--blanco)", borderColor: "var(--borde)" }}
          >
            <ul className="flex flex-col gap-1 px-5 py-4">
              {[...ENLACES, { href: "#registrarse", label: "Registrarse" }].map((enlace) => (
                <li key={enlace.href}>
                  <a
                    href={enlace.href}
                    onClick={(e) => {
                      irASeccion(e, enlace.href);
                      setMenuAbierto(false);
                    }}
                    className="block rounded-lg px-3 py-2.5 text-[15px] font-medium"
                    style={{ color: "var(--tinta)" }}
                  >
                    {enlace.label}
                  </a>
                </li>
              ))}
              <li className="mt-2">
                <Link
                  to="/buscar"
                  className="flex items-center justify-center rounded-full px-4 py-2.5 text-sm font-semibold text-white"
                  style={{ background: "var(--verde-cruz)" }}
                >
                  Buscar medicamentos
                </Link>
              </li>
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

/**
 * Chrome compartido de las páginas legales (/terminos, /privacidad):
 * artículo simple y legible, sin la UI de la app de búsqueda.
 */
export function LegalLayout({
  titulo,
  actualizado,
  children,
}: {
  titulo: string;
  actualizado: string;
  children: React.ReactNode;
}) {
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

        <h1
          className="mt-6 text-2xl font-semibold"
          style={{ color: "var(--verde-cruz)", letterSpacing: "-0.01em" }}
        >
          {titulo}
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--tinta-tenue)" }}>
          Última actualización: {actualizado}
        </p>

        <article
          className="mt-8 space-y-6 text-[15px] leading-relaxed"
          style={{ color: "var(--tinta)" }}
        >
          {children}
        </article>
      </div>
    </div>
  );
}

export function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-base font-semibold" style={{ color: "var(--tinta)" }}>
        {titulo}
      </h2>
      <div className="mt-2 space-y-2">{children}</div>
    </section>
  );
}

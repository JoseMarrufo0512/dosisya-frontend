import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { createIsomorphicFn } from "@tanstack/react-start";
import { MapPin, Pill, ArrowLeft } from "lucide-react";
import { API_BASE } from "@/lib/api";
import { registrarLead } from "@/lib/leads";
import { construirMensajeProducto, construirUrlWhatsApp } from "@/lib/whatsapp";
import { toast } from "sonner";

interface ProductoDetalle {
  farmacia_id: string;
  farmacia_nombre: string;
  direccion: string;
  whatsapp: string;
  es_premium: boolean;
  tiene_delivery: boolean;
  medicamento_id: string;
  medicamento_nombre: string;
  marca_comercial: string | null;
  presentacion: string;
  precio_usd: number;
  precio_ves: number;
  stock_disponible: boolean;
}

// El loader corre isomórfico: en el servidor durante SSR/la primera carga, y
// en el navegador si el usuario navega client-side a otro /producto/... En
// dev, VITE_API_URL="" a propósito (el navegador usa el proxy de Vite hacia
// localhost:8000). Pero el servidor no tiene ese proxy y fetch() con URL
// relativa revienta ahí (no hay document.baseURI) — por eso el servidor
// necesita su propia base absoluta, igual al target del proxy en vite.config.mts.
const resolveApiBase = createIsomorphicFn()
  .server(() => import.meta.env.VITE_API_URL || process.env.DEV_API_PROXY || "http://localhost:8000")
  .client(() => API_BASE);

async function cargarProducto(
  farmaciaId: string,
  medicamentoId: string,
): Promise<ProductoDetalle | null> {
  const base = resolveApiBase();
  try {
    const res = await fetch(
      `${base}/api/v1/medicamentos/${medicamentoId}/farmacias/${farmaciaId}`,
    );
    if (!res.ok) return null;
    const json = await res.json();
    return json?.data ?? null;
  } catch {
    return null;
  }
}

export const Route = createFileRoute("/producto/$farmaciaId/$medicamentoId")({
  loader: async ({ params }) => {
    const producto = await cargarProducto(params.farmaciaId, params.medicamentoId);
    if (!producto) throw notFound();
    return producto;
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return { meta: [{ title: "Producto no encontrado — DosisYa" }] };
    }
    const p = loaderData;
    const titulo = `${p.medicamento_nombre} en ${p.farmacia_nombre} — DosisYa`;
    const descripcion = `$${p.precio_usd.toFixed(2)} · ${p.presentacion} · ${p.farmacia_nombre}, ${p.direccion}`;
    return {
      meta: [
        { title: titulo },
        { name: "description", content: descripcion },
        { property: "og:title", content: titulo },
        { property: "og:description", content: descripcion },
        { property: "og:type", content: "product" },
      ],
    };
  },
  component: ProductoPage,
  notFoundComponent: () => (
    <div className="dosisya-ui flex min-h-screen flex-col items-center justify-center gap-3 px-4 text-center" style={{ background: "var(--papel)" }}>
      <Pill className="h-10 w-10" style={{ color: "var(--tinta-tenue)" }} aria-hidden="true" />
      <h1 className="text-lg font-semibold" style={{ color: "var(--tinta)" }}>
        No encontramos este producto
      </h1>
      <p className="text-sm" style={{ color: "var(--tinta-tenue)" }}>
        Puede que la farmacia ya no lo tenga listado.
      </p>
      <Link to="/" className="mt-2 text-sm font-medium underline" style={{ color: "var(--verde-cruz)" }}>
        Buscar en DosisYa
      </Link>
    </div>
  ),
});

function ProductoPage() {
  const p = Route.useLoaderData();

  const handleWhatsApp = () => {
    const url = construirUrlWhatsApp(
      p.whatsapp,
      construirMensajeProducto(p.farmacia_nombre, p.medicamento_nombre, p.presentacion, p.precio_usd),
    );
    if (!url) {
      toast.error("Esta farmacia no tiene WhatsApp registrado");
      return;
    }
    void registrarLead(p.farmacia_id, "clic_whatsapp", p.medicamento_id, {
      keepalive: true,
      origen: "busqueda",
    });
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="dosisya-ui min-h-screen" style={{ background: "var(--papel)" }}>
      <div className="mx-auto max-w-md px-4 py-8">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm"
          style={{ color: "var(--tinta-tenue)" }}
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Buscar más en DosisYa
        </Link>

        <div
          className="mt-5 rounded-[16px] border bg-white p-4 shadow-[0_1px_2px_rgba(22,24,26,0.04)]"
          style={{ borderColor: "var(--borde)" }}
        >
          <div className="flex items-center gap-1.5">
            <h1 className="text-[15px] font-semibold" style={{ color: "var(--tinta)" }}>
              {p.farmacia_nombre}
            </h1>
            {p.es_premium && (
              <span
                className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
                style={{ background: "var(--disp-fondo)", color: "var(--disp-text)" }}
              >
                Premium
              </span>
            )}
          </div>
          <p className="mt-1 flex items-center gap-1 text-[12px]" style={{ color: "var(--tinta-tenue)" }}>
            <MapPin size={12} aria-hidden="true" />
            {p.direccion}
          </p>

          <p className="mt-3 text-[16px] font-semibold leading-snug" style={{ color: "var(--tinta)" }}>
            {p.medicamento_nombre}{" "}
            <span className="font-normal" style={{ color: "var(--tinta-suave)" }}>
              {p.presentacion}
            </span>
          </p>
          {p.marca_comercial && (
            <p className="text-[12.5px]" style={{ color: "var(--tinta-tenue)" }}>
              {p.marca_comercial}
            </p>
          )}

          {p.stock_disponible ? (
            <div className="mt-3">
              <div className="text-[26px] font-bold leading-none tabular-nums tracking-tight" style={{ color: "var(--verde-cruz)" }}>
                ${p.precio_usd.toFixed(2)}
              </div>
              <div className="mt-1 text-[13px] tabular-nums" style={{ color: "var(--tinta-suave)" }}>
                Bs {p.precio_ves.toLocaleString("es-VE", { minimumFractionDigits: 2 })}
              </div>
            </div>
          ) : (
            <p
              className="mt-3 rounded-lg px-3 py-2 text-[13px] font-medium"
              style={{ background: "var(--ambar-fondo)", color: "var(--ambar-receta)" }}
            >
              Agotado por ahora en esta farmacia — vuelve a buscar para ver otras opciones.
            </p>
          )}

          <button
            type="button"
            onClick={handleWhatsApp}
            disabled={!p.stock_disponible}
            className="mt-4 flex h-[44px] w-full items-center justify-center gap-1.5 rounded-xl text-[14px] font-semibold text-white transition-transform active:scale-[0.98] disabled:opacity-40"
            style={{ background: "var(--whatsapp)" }}
          >
            Contactar por WhatsApp
          </button>
        </div>
      </div>
    </div>
  );
}

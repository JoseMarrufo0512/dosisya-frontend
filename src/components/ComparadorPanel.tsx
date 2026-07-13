import { useIsMobile } from "@/hooks/use-mobile";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { registrarLead } from "@/lib/leads";
import { construirMensajeProducto, construirUrlWhatsApp } from "@/lib/whatsapp";
import { claveResultado, esGenerico } from "@/lib/filtros";
import type { ResultadoFarmacia } from "@/lib/api";
import { toast } from "sonner";

interface ComparadorPanelProps {
  abierto: boolean;
  onOpenChange: (v: boolean) => void;
  /** 2-3 resultados seleccionados, en el orden en que se marcaron. */
  seleccionados: ResultadoFarmacia[];
}

/**
 * Comparación lado a lado (spec busqueda-v2 §2.4): drawer (vaul) en móvil,
 * modal en desktop. El botón de WhatsApp de cada columna registra su lead
 * clic_whatsapp fire-and-forget con keepalive (después se abre wa.me).
 */
export function ComparadorPanel({ abierto, onOpenChange, seleccionados }: ComparadorPanelProps) {
  const esMovil = useIsMobile();

  const contactar = (r: ResultadoFarmacia) => {
    const url = construirUrlWhatsApp(
      r.whatsapp,
      construirMensajeProducto(
        r.farmacia_nombre,
        r.medicamento_nombre,
        r.presentacion,
        r.precio_usd,
      ),
    );
    if (!url) {
      toast.error("Esta farmacia no tiene WhatsApp registrado");
      return;
    }
    // Lead ANTES de navegar; keepalive para sobrevivir al salto a wa.me
    void registrarLead(r.farmacia_id, "clic_whatsapp", r.medicamento_id, {
      keepalive: true,
    });
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const minPrecio = Math.min(...seleccionados.map((r) => r.precio_usd));

  const cuerpo = (
    <div
      className="grid gap-3 p-4 pt-2"
      style={{
        gridTemplateColumns: `repeat(${Math.max(seleccionados.length, 2)}, minmax(0, 1fr))`,
      }}
    >
      {seleccionados.map((r) => (
        <div
          key={claveResultado(r)}
          className={`rounded-xl border p-3 flex flex-col gap-2 ${
            r.precio_usd === minPrecio && seleccionados.length >= 2
              ? "border-emerald-300 bg-emerald-50/40"
              : "border-gray-200"
          }`}
        >
          <div>
            <p className="font-semibold text-gray-900 text-sm leading-snug">
              {r.medicamento_nombre}
            </p>
            <p className="text-gray-500 text-xs">{r.presentacion}</p>
            {esGenerico(r) ? (
              <span className="mt-1 inline-flex items-center rounded-full bg-sky-100 text-sky-800 text-[11px] font-medium px-2 py-0.5">
                Genérico
              </span>
            ) : (
              <p className="text-gray-400 text-xs mt-0.5">{r.marca_comercial}</p>
            )}
          </div>

          <div>
            <p className="text-emerald-700 font-bold text-xl leading-none">
              ${r.precio_usd.toFixed(2)}
              {r.precio_usd === minPrecio && seleccionados.length >= 2 && (
                <span className="ml-1 text-xs align-middle">💰</span>
              )}
            </p>
            <p className="text-gray-500 text-[11px] mt-0.5">
              Bs. {r.precio_ves.toLocaleString("es-VE", { minimumFractionDigits: 2 })}
            </p>
          </div>

          <div className="text-xs text-gray-600 space-y-0.5 flex-1">
            <p className="font-medium text-gray-700 truncate">{r.farmacia_nombre}</p>
            <p>📍 {(r.distancia_m / 1000).toFixed(1)} km</p>
            <p>{r.tiene_delivery ? "🛵 Con delivery" : "— Sin delivery"}</p>
          </div>

          <button
            type="button"
            onClick={() => contactar(r)}
            aria-label={`Contactar a ${r.farmacia_nombre} por WhatsApp`}
            className="w-full rounded-lg bg-[#25d366] text-white text-xs font-semibold py-2 hover:opacity-90 transition-opacity active:scale-[0.98]"
          >
            WhatsApp
          </button>
        </div>
      ))}
    </div>
  );

  const titulo = `Comparando ${seleccionados.length} opciones`;

  if (esMovil) {
    return (
      <Drawer open={abierto} onOpenChange={onOpenChange}>
        <DrawerContent>
          <DrawerHeader className="pb-0">
            <DrawerTitle>{titulo}</DrawerTitle>
          </DrawerHeader>
          {cuerpo}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={abierto} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
        </DialogHeader>
        {cuerpo}
      </DialogContent>
    </Dialog>
  );
}

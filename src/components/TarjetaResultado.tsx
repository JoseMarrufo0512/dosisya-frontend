import { type ResultadoFarmacia } from "@/lib/api";
import { registrarLead } from "@/lib/leads";
import { useListaMedica } from "@/hooks/useListaMedica";
import { BadgePremium } from "./BadgePremium";
import { BadgeDelivery } from "./BadgeDelivery";
import { Check, Plus } from "lucide-react";
import { toast } from "sonner";

interface TarjetaResultadoProps {
  resultado: ResultadoFarmacia;
  onLeadRegistrado?: () => void;
  /** Marca esta tarjeta como la de menor precio entre los resultados mostrados. */
  esMasEconomico?: boolean;
  /**
   * Precio (USD) del equivalente más barato del mismo principio activo pero
   * distinto producto. Si viene, se muestra la nota "equivalente desde $X".
   */
  equivalenteDesde?: number | null;
}

export function TarjetaResultado({
  resultado,
  onLeadRegistrado,
  esMasEconomico = false,
  equivalenteDesde = null,
}: TarjetaResultadoProps) {
  // Genérico = sin marca comercial (o vacía).
  const esGenerico = !resultado.marca_comercial?.trim();
  const { agregar, estaEnLista } = useListaMedica();
  const enLista = estaEnLista(resultado.medicamento_id);

  const mapsUrl = `https://maps.google.com/?q=${resultado.lat},${resultado.lng}`;

  // ID base para elementos únicos en la tarjeta (requerido para testing y a11y)
  const cardId = `tarjeta-${resultado.farmacia_id}-${resultado.medicamento_id}`;

  // ─── Añadir a la Lista Médica (spec receta-ia-y-carrito) ──────────────────
  // OJO: aquí NO se registra lead. El lead CPC multi-producto se dispara al
  // CONTACTAR desde la lista — añadir todavía no es una interacción facturable.

  const handleAgregar = () => {
    const item = agregar({
      medicamentoId: resultado.medicamento_id,
      nombre: resultado.medicamento_nombre,
      presentacion: resultado.presentacion,
      marcaComercial: resultado.marca_comercial ?? null,
      precioRefUsd: resultado.precio_usd,
    });
    toast.success(
      item.cantidad > 1
        ? `${resultado.medicamento_nombre} · cantidad: ${item.cantidad}`
        : "Añadido a tu lista",
      {
        description: item.cantidad > 1 ? undefined : "Elige farmacia cuando termines",
        style: {
          background: "#ecfdf5",
          color: "#065f46",
          borderColor: "#a7f3d0",
        },
      },
    );
  };

  // ─── Handlers de leads CPC ────────────────────────────────────────────────
  // Todos usan void (fire-and-forget) para no bloquear la navegación del usuario.
  // El backend registra el lead antes de responder al usuario.

  const handleMapa = () => {
    void registrarLead(resultado.farmacia_id, "ver_mapa", resultado.medicamento_id);
    onLeadRegistrado?.();
  };

  const handleGuardar = async () => {
    // El lead se registra ANTES de intentar copiar: la intención ya cuenta como CPC
    void registrarLead(resultado.farmacia_id, "capture_pantalla", resultado.medicamento_id);
    onLeadRegistrado?.();

    const textToCopy = `💊 ${resultado.medicamento_nombre} (${resultado.presentacion}) — $${resultado.precio_usd.toFixed(2)} USD — ${resultado.farmacia_nombre} — WhatsApp: ${resultado.whatsapp}`;
    try {
      await navigator.clipboard.writeText(textToCopy);
      toast.success("✅ Info copiada al portapapeles", {
        style: {
          background: "#ecfdf5",
          color: "#065f46",
          borderColor: "#a7f3d0",
        },
      });
    } catch {
      toast.error("No se pudo copiar al portapapeles");
    }
  };

  const handleCompartir = async () => {
    // El lead se registra ANTES del share: la intención ya cuenta como CPC
    void registrarLead(resultado.farmacia_id, "compartir", resultado.medicamento_id);
    onLeadRegistrado?.();

    const shareData = {
      title: "Encontrado en DosisYa",
      text: `Mira este precio: ${resultado.medicamento_nombre} a $${resultado.precio_usd.toFixed(2)} en ${resultado.farmacia_nombre}.`,
      url: window.location.href,
    };

    if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData);
      } catch {
        // Ignorar cancelación del usuario — no es un error
      }
    } else {
      // Fallback: copiar URL al portapapeles
      try {
        await navigator.clipboard.writeText(window.location.href);
        toast.success("🔗 Enlace copiado al portapapeles");
      } catch {
        toast.error("No se pudo copiar el enlace");
      }
    }
  };

  return (
    <article
      id={cardId}
      aria-label={`${resultado.farmacia_nombre} — ${resultado.medicamento_nombre}`}
      className={`shadow-sm rounded-xl p-4 bg-white ${
        esMasEconomico
          ? "border-2 border-emerald-400 ring-1 ring-emerald-100"
          : "border border-gray-100"
      }`}
    >
      {/* HEADER */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h2 className="font-semibold text-gray-900 text-base leading-tight">
            {resultado.farmacia_nombre}
          </h2>
          <div className="flex flex-wrap gap-1">
            {resultado.es_premium && <BadgePremium />}
            {resultado.tiene_delivery && <BadgeDelivery />}
          </div>
          <p className="text-gray-400 text-xs mt-1">
            {(resultado.distancia_m / 1000).toFixed(1)} km · {resultado.direccion}
          </p>
        </div>
      </div>

      {/* MEDICAMENTO */}
      <div className="mt-4">
        <p className="font-medium text-gray-800 leading-snug">
          {resultado.medicamento_nombre}
          {resultado.marca_comercial ? (
            <span className="text-gray-400 text-sm ml-1 font-normal">
              ({resultado.marca_comercial})
            </span>
          ) : (
            esGenerico && (
              <span className="ml-2 inline-flex items-center rounded-full bg-sky-100 text-sky-800 text-xs font-medium px-2 py-0.5 align-middle">
                Genérico
              </span>
            )
          )}
        </p>
        <p className="text-gray-500 text-sm mt-0.5">{resultado.presentacion}</p>
        {equivalenteDesde != null && (
          <p className="text-sky-700 text-xs mt-1.5 flex items-center gap-1">
            💊 Hay un equivalente del mismo principio activo desde $
            {equivalenteDesde.toFixed(2)}
          </p>
        )}
      </div>

      {/* PRECIOS */}
      <div className="mt-3 flex items-baseline flex-wrap gap-x-2 gap-y-1">
        <span className="text-emerald-700 font-bold text-lg">
          ${resultado.precio_usd.toFixed(2)} USD
        </span>
        <span className="text-gray-500 text-sm">
          Bs. {resultado.precio_ves.toLocaleString("es-VE", { minimumFractionDigits: 2 })} VES
        </span>
        {esMasEconomico && (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-semibold px-2 py-0.5">
            💰 Más económico
          </span>
        )}
      </div>

      {/* ACCIONES */}
      <div className="mt-4 flex flex-wrap gap-2">
        {/* Añadir a mi lista → sin lead; el CPC se cobra al contactar desde la lista */}
        <button
          id={`${cardId}-btn-agregar`}
          type="button"
          onClick={handleAgregar}
          aria-label={`Añadir ${resultado.medicamento_nombre} a tu lista médica`}
          className={`rounded-lg px-4 py-2 flex-[1_1_100%] sm:flex-1 flex justify-center items-center gap-2 text-center font-medium transition-all min-w-[120px] active:scale-[0.98] ${
            enLista
              ? "border border-emerald-300 bg-emerald-50 text-emerald-700"
              : "bg-primary text-primary-foreground hover:opacity-90"
          }`}
        >
          {enLista ? (
            <>
              <Check className="h-4 w-4" aria-hidden />
              En tu lista · {enLista.cantidad}
            </>
          ) : (
            <>
              <Plus className="h-4 w-4" aria-hidden />
              Añadir a mi lista
            </>
          )}
        </button>

        {/* Ver mapa → lead: ver_mapa */}
        <a
          id={`${cardId}-btn-mapa`}
          href={mapsUrl}
          onClick={handleMapa}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Ver ubicación de ${resultado.farmacia_nombre} en Google Maps`}
          className="border border-gray-200 text-gray-600 rounded-lg px-3 py-2 flex justify-center items-center text-center text-sm hover:bg-gray-50 transition-colors flex-1 sm:flex-initial"
        >
          📍 Ver mapa
        </a>

        {/* Guardar info → lead: capture_pantalla */}
        <button
          id={`${cardId}-btn-guardar`}
          onClick={handleGuardar}
          aria-label={`Copiar información de ${resultado.medicamento_nombre} al portapapeles`}
          className="border border-gray-200 text-gray-600 rounded-lg px-3 py-2 text-sm hover:bg-gray-50 transition-colors flex-1 sm:flex-initial"
        >
          💾 Guardar info
        </button>

        {/* Compartir → lead: compartir */}
        <button
          id={`${cardId}-btn-compartir`}
          onClick={handleCompartir}
          aria-label={`Compartir información de ${resultado.medicamento_nombre} en ${resultado.farmacia_nombre}`}
          className="border border-gray-200 text-gray-600 rounded-lg px-3 py-2 text-sm hover:bg-gray-50 transition-colors flex-1 sm:flex-initial"
        >
          🔗 Compartir
        </button>
      </div>
    </article>
  );
}

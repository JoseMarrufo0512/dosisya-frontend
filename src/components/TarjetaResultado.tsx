import { type ResultadoFarmacia } from "@/lib/api";
import { registrarLead } from "@/lib/leads";
import { BadgePremium } from "./BadgePremium";
import { BadgeDelivery } from "./BadgeDelivery";
import { toast } from "sonner";

interface TarjetaResultadoProps {
  resultado: ResultadoFarmacia;
  onLeadRegistrado?: () => void;
}

export function TarjetaResultado({ resultado, onLeadRegistrado }: TarjetaResultadoProps) {
  // Sanitizar número de WhatsApp: solo dígitos, con fallback seguro
  const phone = resultado.whatsapp?.replace(/\D/g, "") ?? "";
  const waText = `Hola, vi que tienen ${resultado.medicamento_nombre} (${resultado.presentacion}) en DosisYa. ¿Está disponible?`;
  const waUrl = phone
    ? `https://wa.me/${phone}?text=${encodeURIComponent(waText)}`
    : "#";
  const mapsUrl = `https://maps.google.com/?q=${resultado.lat},${resultado.lng}`;

  // ID base para elementos únicos en la tarjeta (requerido para testing y a11y)
  const cardId = `tarjeta-${resultado.farmacia_id}-${resultado.medicamento_id}`;

  // ─── Handlers de leads CPC ────────────────────────────────────────────────
  // Todos usan void (fire-and-forget) para no bloquear la navegación del usuario.
  // El backend registra el lead antes de responder al usuario.

  const handleWhatsApp = () => {
    // "clic_whatsapp" es el valor canónico del enum PostgreSQL (preferido sobre "click_whatsapp")
    void registrarLead(resultado.farmacia_id, "clic_whatsapp", resultado.medicamento_id);
    onLeadRegistrado?.();
  };

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
      className="shadow-sm border border-gray-100 rounded-xl p-4 bg-white"
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
          {resultado.marca_comercial && (
            <span className="text-gray-400 text-sm ml-1 font-normal">
              ({resultado.marca_comercial})
            </span>
          )}
        </p>
        <p className="text-gray-500 text-sm mt-0.5">{resultado.presentacion}</p>
      </div>

      {/* PRECIOS */}
      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-emerald-700 font-bold text-lg">
          ${resultado.precio_usd.toFixed(2)} USD
        </span>
        <span className="text-gray-500 text-sm">
          Bs. {resultado.precio_ves.toLocaleString("es-VE", { minimumFractionDigits: 2 })} VES
        </span>
      </div>

      {/* ACCIONES — cada clic dispara un lead CPC al backend */}
      <div className="mt-4 flex flex-wrap gap-2">
        {/* WhatsApp → lead: clic_whatsapp */}
        <a
          id={`${cardId}-btn-whatsapp`}
          href={waUrl}
          onClick={handleWhatsApp}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Contactar ${resultado.farmacia_nombre} por WhatsApp sobre ${resultado.medicamento_nombre}`}
          className="bg-[#25D366] text-white rounded-lg px-4 py-2 flex-[1_1_100%] sm:flex-1 flex justify-center items-center text-center font-medium transition-opacity hover:opacity-90 min-w-[120px]"
        >
          WhatsApp
        </a>

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

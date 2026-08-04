import { type ResultadoFarmacia } from "@/lib/api";
import { registrarLead } from "@/lib/leads";
import { construirMensajeProducto, construirUrlWhatsApp } from "@/lib/whatsapp";
import { useListaMedica } from "@/hooks/useListaMedica";
import { useFavoritos } from "@/hooks/useFavoritos";
import { MapPin, Star, Plus, Check, Heart, Pill, Share2, Scale } from "lucide-react";
import { toast } from "sonner";

interface TarjetaResultadoProps {
  resultado: ResultadoFarmacia;
  /** Marca esta tarjeta como la de menor precio entre los resultados mostrados. */
  esMasEconomico?: boolean;
  /** Al añadir, reporta el rect del botón "+" para la animación packFly. */
  onAgregado?: (desde: DOMRect) => void;
  /** La tarjeta está seleccionada para el comparador. */
  comparando?: boolean;
  /** Toggle de selección; si es undefined el botón Comparar no se muestra. */
  onToggleComparar?: () => void;
  /** true cuando ya se alcanzó el máximo de comparación y esta no es una de las seleccionadas. */
  compararDeshabilitado?: boolean;
}

/**
 * Glyph de marca de WhatsApp (no lucide) — el handoff exige el logotipo real
 * en el botón de acción, no un ícono genérico de chat.
 */
function IconoWhatsApp({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.611-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.71.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347zm-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.002-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884zm8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

/**
 * Tarjeta de resultado (rediseño handoff, versión compacta). Fila superior:
 * información (farmacia + medicamento + precio protagonista) a la izquierda e
 * imagen del producto con botón de favorito a la derecha. Debajo, la fila de
 * acciones (WhatsApp full-width + "+").
 *
 * Leads: el "+" (Añadir a la Lista Médica) NO registra lead — el CPC se cobra
 * al CONTACTAR desde la lista. WhatsApp registra un lead clic_whatsapp de un
 * solo producto (mismo patrón que ComparadorPanel) antes de abrir wa.me. El
 * favorito es local (localStorage), sin lead: guardar para después no es una
 * interacción con la farmacia.
 */
export function TarjetaResultado({
  resultado,
  esMasEconomico = false,
  onAgregado,
  comparando = false,
  onToggleComparar,
  compararDeshabilitado = false,
}: TarjetaResultadoProps) {
  const { agregar, estaEnLista } = useListaMedica();
  const enLista = estaEnLista(resultado.farmacia_id, resultado.medicamento_id);

  const { esFavorito, alternar } = useFavoritos();
  const favorito = esFavorito(resultado.farmacia_id, resultado.medicamento_id);

  // ID base para elementos únicos en la tarjeta (requerido para testing y a11y)
  const cardId = `tarjeta-${resultado.farmacia_id}-${resultado.medicamento_id}`;

  // ─── Añadir a la Lista Médica (spec receta-ia-y-carrito) ──────────────────
  const handleAgregar = (e: React.MouseEvent<HTMLButtonElement>) => {
    onAgregado?.(e.currentTarget.getBoundingClientRect());
    const item = agregar({
      medicamentoId: resultado.medicamento_id,
      nombre: resultado.medicamento_nombre,
      presentacion: resultado.presentacion,
      marcaComercial: resultado.marca_comercial ?? null,
      precioRefUsd: resultado.precio_usd,
      origen: "lista_medica",
      farmaciaId: resultado.farmacia_id,
      farmaciaNombre: resultado.farmacia_nombre,
      farmaciaWhatsapp: resultado.whatsapp,
    });
    toast.success(
      item.cantidad > 1
        ? `${resultado.medicamento_nombre} · cantidad: ${item.cantidad}`
        : "Añadido a tu lista",
      {
        description: item.cantidad > 1 ? undefined : "Elige farmacia cuando termines",
        style: { background: "#ecfdf5", color: "#065f46", borderColor: "#a7f3d0" },
      },
    );
  };

  // ─── WhatsApp de un solo producto → lead clic_whatsapp ────────────────────
  // Mismo patrón que ComparadorPanel: lead ANTES de navegar, con keepalive para
  // que la petición sobreviva al salto a wa.me.
  const handleWhatsApp = () => {
    const url = construirUrlWhatsApp(
      resultado.whatsapp,
      construirMensajeProducto(
        resultado.farmacia_nombre,
        resultado.medicamento_nombre,
        resultado.presentacion,
        resultado.precio_usd,
      ),
    );
    if (!url) {
      toast.error("Esta farmacia no tiene WhatsApp registrado");
      return;
    }
    void registrarLead(resultado.farmacia_id, "clic_whatsapp", resultado.medicamento_id, {
      keepalive: true,
    });
    window.open(url, "_blank", "noopener,noreferrer");
  };

  // ─── Compartir → lead "compartir" + enlace público /producto/... ──────────
  // Con Web Share API si el navegador la soporta (móvil); si no, copia al
  // portapapeles. El lead se registra igual en ambos casos.
  const handleCompartir = async () => {
    const url = `${window.location.origin}/producto/${resultado.farmacia_id}/${resultado.medicamento_id}`;
    void registrarLead(resultado.farmacia_id, "compartir", resultado.medicamento_id, {
      origen: "busqueda",
    });

    if (navigator.share) {
      try {
        await navigator.share({
          title: `${resultado.medicamento_nombre} en ${resultado.farmacia_nombre}`,
          text: `Encontré ${resultado.medicamento_nombre} a $${resultado.precio_usd.toFixed(2)} en ${resultado.farmacia_nombre} — DosisYa`,
          url,
        });
      } catch {
        // El usuario cerró el share sheet sin elegir nada — no es un error.
      }
      return;
    }

    try {
      await navigator.clipboard.writeText(url);
      toast.success("Enlace copiado");
    } catch {
      toast.error("No pudimos copiar el enlace");
    }
  };

  return (
    <article
      id={cardId}
      aria-label={`${resultado.medicamento_nombre} — ${resultado.farmacia_nombre}`}
      className={`flex flex-col gap-2.5 rounded-[16px] border bg-white p-3 shadow-[0_1px_2px_rgba(22,24,26,0.04)] ${
        esMasEconomico ? "border-[var(--verde-cruz)]" : "border-[var(--borde)]"
      }`}
    >
      <div className="flex items-stretch gap-3">
        <div className="min-w-0 flex-1">
          {/* farmacia + premium + "más barato"  ·  distancia */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-1.5">
              <h2 className="truncate text-[13px] font-semibold text-[color:var(--tinta)]">
                {resultado.farmacia_nombre}
              </h2>
              {resultado.es_premium && (
                <Star
                  size={14}
                  className="shrink-0 fill-[var(--verde-cruz)] text-[var(--verde-cruz)]"
                  aria-label="Farmacia premium"
                />
              )}
              {esMasEconomico && (
                <span className="shrink-0 rounded-full bg-[var(--disp-fondo)] px-1.5 py-0.5 text-[10px] font-semibold text-[color:var(--disp-text)]">
                  Más barato
                </span>
              )}
            </div>
            <span className="flex shrink-0 items-center gap-0.5 text-[11px] text-[color:var(--tinta-tenue)]">
              <MapPin size={12} aria-hidden="true" />
              <span className="tabular-nums">
                {(resultado.distancia_m / 1000).toFixed(1).replace(".", ",")} km
              </span>
            </span>
          </div>

          {/* medicamento + presentación */}
          <p className="mt-2 text-[14px] font-semibold leading-snug text-[color:var(--tinta)]">
            {resultado.medicamento_nombre}{" "}
            <span className="font-normal text-[color:var(--tinta-suave)]">
              {resultado.presentacion}
            </span>
          </p>

          {/* precio protagonista */}
          <div className="mt-2">
            <div className="text-[21px] font-bold leading-none tabular-nums tracking-tight text-[color:var(--verde-cruz)]">
              ${resultado.precio_usd.toFixed(2)}
            </div>
            <div className="mt-1 text-[12.5px] tabular-nums text-[color:var(--tinta-suave)]">
              Bs {resultado.precio_ves.toLocaleString("es-VE", { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>

        {/* imagen del producto (placeholder — sin foto en la API) + favorito */}
        <div className="relative w-[60px] shrink-0 self-start">
          <div className="flex h-[60px] w-[60px] items-center justify-center rounded-[12px] border border-[var(--borde)] bg-[var(--fondo-suave)] text-[#c3c6c0]">
            <Pill size={22} strokeWidth={1.5} aria-hidden="true" />
          </div>
          <button
            id={`${cardId}-btn-favorito`}
            type="button"
            onClick={() => alternar(resultado.farmacia_id, resultado.medicamento_id)}
            aria-pressed={favorito}
            aria-label={
              favorito
                ? `Quitar ${resultado.medicamento_nombre} de favoritos`
                : `Guardar ${resultado.medicamento_nombre} en favoritos`
            }
            className="absolute -right-1.5 -top-1.5 flex h-[24px] w-[24px] items-center justify-center rounded-full border border-[var(--borde)] bg-white shadow-[0_1px_3px_rgba(22,24,26,0.12)] transition-transform active:scale-90"
          >
            <Heart
              size={13}
              className={
                favorito
                  ? "fill-[var(--verde-cruz)] text-[var(--verde-cruz)]"
                  : "text-[color:var(--tinta-tenue)]"
              }
              aria-hidden="true"
            />
          </button>
        </div>
      </div>

      {/* acciones: WhatsApp full-width + compartir + añadir */}
      <div className="flex gap-2">
        <button
          id={`${cardId}-btn-whatsapp`}
          type="button"
          onClick={handleWhatsApp}
          aria-label={`Contactar a ${resultado.farmacia_nombre} por WhatsApp`}
          className="flex h-[40px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-[var(--whatsapp)] text-[13px] font-semibold text-white transition-transform active:scale-[0.98]"
        >
          <IconoWhatsApp className="h-[17px] w-[17px]" />
          WhatsApp
        </button>
        <button
          id={`${cardId}-btn-compartir`}
          type="button"
          onClick={handleCompartir}
          aria-label={`Compartir ${resultado.medicamento_nombre} en ${resultado.farmacia_nombre}`}
          className="flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-xl border border-[var(--borde)] bg-white text-[var(--tinta-suave)] transition-transform active:scale-[0.95]"
        >
          <Share2 size={18} aria-hidden="true" />
        </button>
        <button
          id={`${cardId}-btn-agregar`}
          type="button"
          onClick={handleAgregar}
          aria-label={
            enLista
              ? `${resultado.medicamento_nombre} ya está en tu lista (${enLista.cantidad}). Añadir otra`
              : `Añadir ${resultado.medicamento_nombre} a tu lista médica`
          }
          className={`flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-xl border text-[var(--verde-cruz)] transition-transform active:scale-[0.95] ${
            enLista
              ? "border-[var(--verde-cruz)] bg-[var(--disp-fondo)]"
              : "border-[var(--borde)] bg-white"
          }`}
        >
          {enLista ? <Check size={19} aria-hidden="true" /> : <Plus size={19} aria-hidden="true" />}
        </button>
        {onToggleComparar && (
          <button
            id={`${cardId}-btn-comparar`}
            type="button"
            onClick={onToggleComparar}
            disabled={compararDeshabilitado}
            aria-pressed={comparando}
            aria-label={`${comparando ? "Quitar de" : "Añadir a"} comparación: ${resultado.medicamento_nombre} en ${resultado.farmacia_nombre}`}
            className={`flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-xl border transition-transform active:scale-[0.95] disabled:opacity-40 disabled:active:scale-100 ${
              comparando
                ? "border-sky-300 bg-sky-50 text-sky-700"
                : "border-[var(--borde)] bg-white text-[var(--tinta-suave)]"
            }`}
          >
            <Scale size={18} aria-hidden="true" />
          </button>
        )}
      </div>
    </article>
  );
}

import { useState } from "react";
import { MapPin } from "lucide-react";
import type { Resultado } from "@/lib/api";
import { registrarLead } from "@/lib/leads";
import { BadgePremium } from "./BadgePremium";
import { BadgeDelivery } from "./BadgeDelivery";

const formatDistancia = (m: number) =>
  m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;

const formatVes = (v: number) =>
  new Intl.NumberFormat("es-VE", { maximumFractionDigits: 2 }).format(v);

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0 0 20.464 3.488" />
    </svg>
  );
}

export function TarjetaResultado({ item, index }: { item: Resultado; index: number }) {
  const [expanded, setExpanded] = useState(false);

  const phone = item.whatsapp.replace(/[^0-9]/g, "");
  const medLabel = item.marca_comercial
    ? `${item.marca_comercial} (${item.medicamento_nombre})`
    : item.medicamento_nombre;
  const waText = `Hola, ¿tienen disponible ${medLabel} ${item.presentacion}?`;
  const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(waText)}`;
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.direccion)}`;

  const onWhatsApp = () => {
    void registrarLead(item.farmacia_id, "click_whatsapp", item.medicamento_id);
  };
  const onMap = () => {
    void registrarLead(item.farmacia_id, "ver_mapa", item.medicamento_id);
  };
  const onExpand = () => {
    setExpanded((v) => !v);
  };

  return (
    <article
      className="animate-fade-in-up overflow-hidden rounded-2xl border border-border bg-card p-5 backdrop-blur"
      style={{
        boxShadow: "var(--shadow-card)",
        background: "var(--glass-bg)",
        animationDelay: `${index * 60}ms`,
      }}
    >
      <div className="flex flex-wrap items-center gap-2">
        {item.nivel_suscripcion === "premium" && <BadgePremium />}
        {item.tiene_delivery && <BadgeDelivery />}
        {!item.stock_disponible && (
          <span className="inline-flex items-center rounded-md bg-destructive/10 px-2 py-0.5 text-[11px] font-bold text-destructive">
            Sin stock
          </span>
        )}
      </div>

      <h2 className="mt-2 text-lg font-bold capitalize leading-tight text-foreground">
        {item.marca_comercial ?? item.medicamento_nombre}
      </h2>
      {item.marca_comercial && (
        <p className="text-xs text-muted-foreground">{item.medicamento_nombre}</p>
      )}
      <p className="mt-0.5 text-sm text-muted-foreground">{item.presentacion}</p>

      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-2xl font-extrabold text-foreground">
          ${item.precio_usd.toFixed(2)}
        </span>
        <span className="text-sm text-muted-foreground">Bs. {formatVes(item.precio_ves)}</span>
      </div>

      <button
        type="button"
        onClick={onExpand}
        className="mt-4 w-full border-t border-border pt-3 text-left"
        aria-expanded={expanded}
      >
        <p className="text-sm font-semibold text-foreground">{item.farmacia_nombre}</p>
        <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="h-3.5 w-3.5" />
          {formatDistancia(item.distancia_m)} · {expanded ? "Ocultar" : "Ver dirección"}
        </p>
        {expanded && (
          <p className="mt-2 text-xs text-muted-foreground">{item.direccion}</p>
        )}
      </button>

      <div className="mt-4 grid grid-cols-[1fr_auto] gap-2">
        <a
          href={waUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onWhatsApp}
          className="flex h-11 items-center justify-center gap-2 rounded-xl bg-whatsapp font-semibold text-whatsapp-foreground transition-all hover:opacity-90 active:scale-[0.99]"
        >
          <WhatsAppIcon className="h-5 w-5" />
          WhatsApp
        </a>
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onMap}
          className="flex h-11 items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-4 text-sm font-semibold text-primary transition-all hover:bg-accent active:scale-[0.99]"
          aria-label="Ver en mapa"
        >
          <MapPin className="h-4 w-4" />
          Mapa
        </a>
      </div>
    </article>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Search,
  MapPin,
  Loader2,
  PackageSearch,
  Sparkles,
  Bike,
  Pill,
  Navigation,
  AlertCircle,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "DosisYa — Encuentra tu medicamento cerca de ti" },
      {
        name: "description",
        content:
          "Busca medicamentos en farmacias cercanas en Venezuela. Compara precios en USD y Bs., y contacta por WhatsApp al instante.",
      },
    ],
  }),
  component: Index,
});

// ============ Types ============
type Resultado = {
  farmacia_id: string;
  farmacia_nombre: string;
  direccion: string;
  telefono_whatsapp: string;
  nivel_suscripcion: "premium" | "gratuita";
  tiene_delivery: boolean;
  medicamento_id: string;
  principio_activo: string;
  marca_comercial: string | null;
  presentacion: string;
  precio_usd: number;
  precio_ves: number;
  stock_disponible: boolean;
  distancia_metros: number;
  score_similitud: number;
};

type ApiResponse<T> = {
  status: "success" | "error";
  message: string;
  data: T | null;
};

type BusquedaData = { total: number; resultados: Resultado[] };

type View = "idle" | "loading" | "results" | "empty" | "error";

type Coords = { lat: number; lon: number };

type TipoInteraccion =
  | "clic_whatsapp"
  | "clic_llamar"
  | "ver_mapa"
  | "ver_detalle"
  | "compartir"
  | "capture_pantalla";

// ============ Config ============
const API_BASE =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ??
  "https://proyecto-dosis-ya.vercel.app";

// Fallback: Barquisimeto, Venezuela
const FALLBACK_COORDS: Coords = { lat: 10.0647, lon: -69.3471 };

// ============ Helpers ============
const formatDistancia = (m: number) =>
  m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;

const formatVes = (v: number) =>
  new Intl.NumberFormat("es-VE", { maximumFractionDigits: 2 }).format(v);

async function buscarMedicamentos(
  q: string,
  coords: Coords,
  radio: number,
  conDelivery: boolean,
): Promise<BusquedaData> {
  const params = new URLSearchParams({
    q,
    lat: String(coords.lat),
    lon: String(coords.lon),
    radio: String(radio),
    con_delivery: String(conDelivery),
  });
  const res = await fetch(`${API_BASE}/api/v1/medicamentos/buscar?${params}`);
  const json: ApiResponse<BusquedaData> = await res.json();
  if (json.status === "error" || !json.data) {
    throw new Error(json.message || `HTTP ${res.status}`);
  }
  return json.data;
}

async function registrarLead(
  farmaciaId: string,
  medicamentoId: string,
  tipo: TipoInteraccion,
): Promise<void> {
  try {
    await fetch(`${API_BASE}/api/v1/leads/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        farmacia_id: farmaciaId,
        medicamento_buscado_id: medicamentoId,
        tipo_interaccion: tipo,
      }),
    });
  } catch {
    // Silent — analytics no debe romper UX
  }
}

// ============ Component ============
function Index() {
  const [query, setQuery] = useState("");
  const [view, setView] = useState<View>("idle");
  const [results, setResults] = useState<Resultado[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [coords, setCoords] = useState<Coords | null>(null);
  const [geoStatus, setGeoStatus] = useState<"idle" | "loading" | "ok" | "denied">("idle");
  const [radio, setRadio] = useState(5000);
  const [conDelivery, setConDelivery] = useState(false);
  const [manualLat, setManualLat] = useState("");
  const [manualLon, setManualLon] = useState("");

  const requestGeo = () => {
    if (!("geolocation" in navigator)) {
      setGeoStatus("denied");
      return;
    }
    setGeoStatus("loading");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        setGeoStatus("ok");
      },
      () => setGeoStatus("denied"),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  useEffect(() => {
    requestGeo();
  }, []);

  const handleManualCoords = () => {
    const lat = parseFloat(manualLat);
    const lon = parseFloat(manualLon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
    setCoords({ lat, lon });
    setGeoStatus("ok");
  };

  const useFallback = () => {
    setCoords(FALLBACK_COORDS);
    setGeoStatus("ok");
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (q.length < 2) {
      setErrorMsg("Escribe al menos 2 caracteres.");
      setView("error");
      return;
    }
    const c = coords ?? FALLBACK_COORDS;
    setView("loading");
    setErrorMsg("");
    try {
      const data = await buscarMedicamentos(q, c, radio, conDelivery);
      setResults(data.resultados);
      setView(data.total === 0 ? "empty" : "results");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Error desconocido");
      setView("error");
    }
  };

  return (
    <main
      className="min-h-screen"
      style={{
        background:
          "radial-gradient(1200px 600px at 50% -200px, #e8fbf2 0%, transparent 60%), #ffffff",
      }}
    >
      <div className="mx-auto flex min-h-screen max-w-2xl flex-col px-5 pb-12 pt-8 md:pt-12">
        {/* Header */}
        <header className="flex flex-col items-center text-center">
          <div className="flex items-center gap-2.5">
            <div
              className="grid h-11 w-11 place-items-center rounded-2xl text-white shadow-lg"
              style={{ background: "var(--gradient-hero)" }}
            >
              <Pill className="h-5 w-5" />
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-primary md:text-4xl">
              Dosis<span style={{ color: "#3ddc97" }}>Ya</span>
            </h1>
          </div>
          {view === "idle" && (
            <p className="mt-3 max-w-md text-balance text-sm text-muted-foreground md:text-base">
              Encuentra tu medicamento en farmacias cercanas. Precio, distancia y WhatsApp en un toque.
            </p>
          )}
        </header>

        {/* Geo banner */}
        <GeoBanner
          status={geoStatus}
          coords={coords}
          onRetry={requestGeo}
          onUseFallback={useFallback}
          manualLat={manualLat}
          manualLon={manualLon}
          setManualLat={setManualLat}
          setManualLon={setManualLon}
          onManualSubmit={handleManualCoords}
        />

        {/* Search */}
        <form onSubmit={handleSearch} className="mt-5">
          <div className="group relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ej: Losartán, Atamel, Ibuprofeno..."
              className="h-14 w-full rounded-xl border border-border bg-card pl-12 pr-4 text-base text-foreground shadow-sm outline-none transition-all placeholder:text-muted-foreground focus:border-primary focus:ring-4 focus:ring-primary/15"
              aria-label="Buscar medicamento"
            />
          </div>

          {/* Filters */}
          <div className="mt-4 rounded-xl border border-border bg-card/60 p-4 backdrop-blur">
            <div className="flex items-center justify-between gap-3">
              <label htmlFor="radio" className="text-sm font-medium text-foreground">
                Radio de búsqueda
              </label>
              <span className="text-sm font-semibold text-primary">{formatDistancia(radio)}</span>
            </div>
            <input
              id="radio"
              type="range"
              min={100}
              max={50000}
              step={100}
              value={radio}
              onChange={(e) => setRadio(parseInt(e.target.value, 10))}
              className="mt-2 w-full accent-[color:var(--secondary)]"
            />
            <label className="mt-3 flex cursor-pointer items-center justify-between gap-3 text-sm">
              <span className="flex items-center gap-2 text-foreground">
                <Bike className="h-4 w-4 text-primary" />
                Solo con delivery
              </span>
              <span
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${conDelivery ? "bg-[color:var(--secondary)]" : "bg-muted"}`}
              >
                <input
                  type="checkbox"
                  checked={conDelivery}
                  onChange={(e) => setConDelivery(e.target.checked)}
                  className="sr-only"
                />
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${conDelivery ? "translate-x-5" : "translate-x-0.5"}`}
                />
              </span>
            </label>
          </div>

          <button
            type="submit"
            className="mt-4 h-12 w-full rounded-xl text-sm font-semibold text-white shadow-lg transition-all hover:opacity-95 active:scale-[0.99]"
            style={{ background: "var(--gradient-hero)" }}
          >
            Buscar farmacias
          </button>
        </form>

        {/* States */}
        <section className="mt-8 flex-1">
          {view === "loading" && <LoadingState />}
          {view === "empty" && <EmptyState />}
          {view === "error" && <ErrorState message={errorMsg} />}
          {view === "results" && (
            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {results.length} resultado{results.length !== 1 && "s"}
              </p>
              {results.map((item, i) => (
                <ResultCard key={`${item.farmacia_id}-${item.medicamento_id}`} item={item} index={i} />
              ))}
            </div>
          )}
          {view === "idle" && (
            <p className="mt-8 text-center text-xs text-muted-foreground">
              Tip: busca por el principio activo (ej: Paracetamol) para más resultados.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}

// ============ Subcomponents ============

function GeoBanner({
  status,
  coords,
  onRetry,
  onUseFallback,
  manualLat,
  manualLon,
  setManualLat,
  setManualLon,
  onManualSubmit,
}: {
  status: "idle" | "loading" | "ok" | "denied";
  coords: Coords | null;
  onRetry: () => void;
  onUseFallback: () => void;
  manualLat: string;
  manualLon: string;
  setManualLat: (v: string) => void;
  setManualLon: (v: string) => void;
  onManualSubmit: () => void;
}) {
  if (status === "ok" && coords) {
    return (
      <div className="mt-6 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
        <Navigation className="h-3.5 w-3.5 text-[color:var(--secondary)]" />
        Ubicación: {coords.lat.toFixed(4)}, {coords.lon.toFixed(4)}
      </div>
    );
  }
  if (status === "loading") {
    return (
      <div className="mt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Solicitando tu ubicación...
      </div>
    );
  }
  if (status === "denied") {
    return (
      <div className="mt-6 rounded-xl border border-border bg-muted/40 p-4">
        <div className="flex items-start gap-2">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">No pudimos detectar tu ubicación</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Ingresa coordenadas manualmente o usa Barquisimeto como referencia.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <input
                inputMode="decimal"
                value={manualLat}
                onChange={(e) => setManualLat(e.target.value)}
                placeholder="Latitud"
                className="h-9 rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-primary"
              />
              <input
                inputMode="decimal"
                value={manualLon}
                onChange={(e) => setManualLon(e.target.value)}
                placeholder="Longitud"
                className="h-9 rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-primary"
              />
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onManualSubmit}
                className="h-8 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground"
              >
                Usar coordenadas
              </button>
              <button
                type="button"
                onClick={onRetry}
                className="h-8 rounded-md border border-border bg-card px-3 text-xs font-medium text-foreground"
              >
                Reintentar GPS
              </button>
              <button
                type="button"
                onClick={onUseFallback}
                className="h-8 rounded-md border border-border bg-card px-3 text-xs font-medium text-foreground"
              >
                Usar Barquisimeto
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
  return null;
}

function ResultCard({ item, index }: { item: Resultado; index: number }) {
  const [expanded, setExpanded] = useState(false);

  const phone = item.telefono_whatsapp.replace(/[^0-9]/g, "");
  const medLabel = item.marca_comercial
    ? `${item.marca_comercial} (${item.principio_activo})`
    : item.principio_activo;
  const waText = `Hola, ¿tienen disponible ${medLabel} ${item.presentacion}?`;
  const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(waText)}`;
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.direccion)}`;

  const onWhatsApp = () => {
    void registrarLead(item.farmacia_id, item.medicamento_id, "clic_whatsapp");
  };
  const onMap = () => {
    void registrarLead(item.farmacia_id, item.medicamento_id, "ver_mapa");
  };
  const onExpand = () => {
    if (!expanded) void registrarLead(item.farmacia_id, item.medicamento_id, "ver_detalle");
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
      {/* Badges */}
      <div className="flex flex-wrap items-center gap-2">
        {item.nivel_suscripcion === "premium" && (
          <span
            className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold text-premium-foreground shadow-sm"
            style={{ background: "var(--gradient-premium)" }}
          >
            <Sparkles className="h-3 w-3" />
            Premium
          </span>
        )}
        {item.tiene_delivery && (
          <span className="inline-flex items-center gap-1 rounded-md bg-[color:var(--secondary)]/20 px-2 py-0.5 text-[11px] font-bold text-primary">
            <Bike className="h-3 w-3" />
            Delivery
          </span>
        )}
        {!item.stock_disponible && (
          <span className="inline-flex items-center rounded-md bg-destructive/10 px-2 py-0.5 text-[11px] font-bold text-destructive">
            Sin stock
          </span>
        )}
      </div>

      {/* Med */}
      <h2 className="mt-2 text-lg font-bold capitalize leading-tight text-foreground">
        {item.marca_comercial ?? item.principio_activo}
      </h2>
      {item.marca_comercial && (
        <p className="text-xs text-muted-foreground">{item.principio_activo}</p>
      )}
      <p className="mt-0.5 text-sm text-muted-foreground">{item.presentacion}</p>

      {/* Price */}
      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-2xl font-extrabold text-foreground">
          ${item.precio_usd.toFixed(2)}
        </span>
        <span className="text-sm text-muted-foreground">Bs. {formatVes(item.precio_ves)}</span>
      </div>

      {/* Pharmacy */}
      <button
        type="button"
        onClick={onExpand}
        className="mt-4 w-full border-t border-border pt-3 text-left"
        aria-expanded={expanded}
      >
        <p className="text-sm font-semibold text-foreground">{item.farmacia_nombre}</p>
        <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="h-3.5 w-3.5" />
          {formatDistancia(item.distancia_metros)} · {expanded ? "Ocultar" : "Ver dirección"}
        </p>
        {expanded && (
          <p className="mt-2 text-xs text-muted-foreground">{item.direccion}</p>
        )}
      </button>

      {/* Actions */}
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

function LoadingState() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-center gap-2 py-2 text-sm font-medium text-foreground">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        Rastreando farmacias cercanas...
      </div>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="animate-pulse rounded-2xl border border-border bg-card p-5"
          style={{ boxShadow: "var(--shadow-card)" }}
        >
          <div className="h-3 w-20 rounded bg-muted" />
          <div className="mt-3 h-5 w-2/3 rounded bg-muted" />
          <div className="mt-2 h-4 w-1/3 rounded bg-muted" />
          <div className="mt-4 h-10 w-full rounded-xl bg-muted" />
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
      <div className="grid h-16 w-16 place-items-center rounded-full bg-accent">
        <PackageSearch className="h-8 w-8 text-primary" />
      </div>
      <p className="mt-4 max-w-xs text-balance text-sm text-muted-foreground">
        No encontramos ese medicamento cerca. Intenta ampliar el radio o buscar el principio activo genérico.
      </p>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-full bg-destructive/10">
        <AlertCircle className="h-7 w-7 text-destructive" />
      </div>
      <p className="mt-3 max-w-xs text-balance text-sm text-destructive">{message}</p>
    </div>
  );
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0 0 20.464 3.488" />
    </svg>
  );
}

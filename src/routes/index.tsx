import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  Loader2,
  Pill,
  Navigation,
  AlertCircle,
} from "lucide-react";
import { BarraBusqueda } from "@/components/BarraBusqueda";
import { TarjetaResultado } from "@/components/TarjetaResultado";
import { EstadoCargando } from "@/components/EstadoCargando";
import { EstadoVacio } from "@/components/EstadoVacio";
import { useBuscarMedicamentos } from "@/hooks/useBuscarMedicamentos";
import {
  FALLBACK_COORDS,
  useGeolocalizacion,
  type GeoStatus,
} from "@/hooks/useGeolocalizacion";
import type { Coords } from "@/lib/api";

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

function Index() {
  const [query, setQuery] = useState("");
  const [radio, setRadio] = useState(5000);
  const [conDelivery, setConDelivery] = useState(false);
  const [manualLat, setManualLat] = useState("");
  const [manualLon, setManualLon] = useState("");

  const geo = useGeolocalizacion();
  const { view, results, error, search } = useBuscarMedicamentos();

  const handleManualCoords = () => {
    const lat = parseFloat(manualLat);
    const lon = parseFloat(manualLon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
    geo.setManual({ lat, lon });
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    void search(query, geo.coords ?? FALLBACK_COORDS, radio, conDelivery);
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

        <GeoBanner
          status={geo.status}
          coords={geo.coords}
          onRetry={geo.request}
          onUseFallback={geo.useFallback}
          manualLat={manualLat}
          manualLon={manualLon}
          setManualLat={setManualLat}
          setManualLon={setManualLon}
          onManualSubmit={handleManualCoords}
        />

        <BarraBusqueda
          query={query}
          onQueryChange={setQuery}
          radio={radio}
          onRadioChange={setRadio}
          conDelivery={conDelivery}
          onDeliveryChange={setConDelivery}
          onSubmit={handleSearch}
        />

        <section className="mt-8 flex-1">
          {view === "loading" && <EstadoCargando />}
          {view === "empty" && <EstadoVacio />}
          {view === "error" && <ErrorState message={error} />}
          {view === "results" && (
            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {results.length} resultado{results.length !== 1 && "s"}
              </p>
              {results.map((item, i) => (
                <TarjetaResultado
                  key={`${item.farmacia_id}-${item.medicamento_id}`}
                  item={item}
                  index={i}
                />
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
  status: GeoStatus;
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

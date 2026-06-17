import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2, Pill, Navigation, AlertCircle, Clock, X } from "lucide-react";
import { BarraBusqueda } from "@/components/BarraBusqueda";
import { TarjetaResultado } from "@/components/TarjetaResultado";
import { EstadoCargando } from "@/components/EstadoCargando";
import { EstadoVacio } from "@/components/EstadoVacio";
import { useBuscarMedicamentos } from "@/hooks/useBuscarMedicamentos";
import { useGeolocalizacion } from "@/hooks/useGeolocalizacion";
import { useBusquedasRecientes } from "@/hooks/useLocalStorage";

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

  const geo = useGeolocalizacion();
  const { resultados, cargando, error, totalResultados, buscar } =
    useBuscarMedicamentos();
  const { busquedas, agregar, limpiar } = useBusquedasRecientes();

  const yaBuscaste = totalResultados > 0 || (!cargando && resultados.length >= 0 && query !== "" && error === null && hasSearched);

  // simple flag: track if user has searched at least once
  const [hasSearched, setHasSearched] = useState(false);

  const doSearch = (term: string) => {
    if (term.trim().length < 2) return;
    const lat = geo.lat ?? 9.5569;
    const lng = geo.lng ?? -69.1982;
    setHasSearched(true);
    agregar(term);
    void buscar(term, lat, lng, conDelivery);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    doSearch(query);
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
          {!hasSearched && (
            <p className="mt-3 max-w-md text-balance text-sm text-muted-foreground md:text-base">
              Encuentra tu medicamento en farmacias cercanas. Precio, distancia y WhatsApp en un toque.
            </p>
          )}
        </header>

        <GeoBanner
          cargando={geo.cargando}
          lat={geo.lat}
          lng={geo.lng}
          error={geo.error}
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

        {!hasSearched && busquedas.length > 0 && (
          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <Clock className="h-3.5 w-3.5" /> Búsquedas recientes
              </p>
              <button
                type="button"
                onClick={limpiar}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Limpiar
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {busquedas.map((b) => (
                <button
                  key={b}
                  type="button"
                  onClick={() => {
                    setQuery(b);
                    doSearch(b);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs text-foreground hover:bg-accent"
                >
                  {b}
                </button>
              ))}
            </div>
          </div>
        )}

        <section className="mt-8 flex-1">
          {cargando && <EstadoCargando />}
          {!cargando && error && <ErrorState message={error} />}
          {!cargando && !error && hasSearched && resultados.length === 0 && (
            <EstadoVacio />
          )}
          {!cargando && !error && resultados.length > 0 && (
            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {totalResultados} resultado{totalResultados !== 1 && "s"}
              </p>
              {resultados.map((item, i) => (
                <TarjetaResultado
                  key={`${item.farmacia_id}-${item.medicamento_id}`}
                  item={item}
                  index={i}
                />
              ))}
            </div>
          )}
          {!hasSearched && !cargando && (
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
  cargando,
  lat,
  lng,
  error,
}: {
  cargando: boolean;
  lat: number | null;
  lng: number | null;
  error: string | null;
}) {
  if (cargando) {
    return (
      <div className="mt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Solicitando tu ubicación...
      </div>
    );
  }
  if (error && lat !== null && lng !== null) {
    return (
      <div className="mt-6 flex items-start gap-2 rounded-xl border border-border bg-muted/40 p-3">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <p className="text-xs text-muted-foreground">{error}</p>
      </div>
    );
  }
  if (lat !== null && lng !== null) {
    return (
      <div className="mt-6 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
        <Navigation className="h-3.5 w-3.5 text-[color:var(--secondary)]" />
        Ubicación: {lat.toFixed(4)}, {lng.toFixed(4)}
      </div>
    );
  }
  return null;
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-full bg-destructive/10">
        <X className="h-7 w-7 text-destructive" />
      </div>
      <p className="mt-3 max-w-xs text-balance text-sm text-destructive">{message}</p>
    </div>
  );
}

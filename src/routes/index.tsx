import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Search, MapPin, Loader2, PackageSearch, Sparkles } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "DosisYa — Encuentra tu medicamento al mejor precio" },
      { name: "description", content: "Busca medicamentos en farmacias cercanas y contacta al instante por WhatsApp." },
    ],
  }),
  component: Index,
});

type ResultItem = {
  id_inventario: string;
  medicamento: { nombre_normalizado: string };
  precio: { usd: number; ves: number };
  farmacia: {
    id_farmacia: string;
    nombre: string;
    es_premium: boolean;
    whatsapp_contacto: string;
  };
  ubicacion: { distancia_km: number };
};

type View = "idle" | "loading" | "results" | "empty" | "error";

const API_URL = "https://proyecto-dosis-ya.vercel.app/api/v1/medicamentos/buscar";
const LAT = 9.5597;
const LON = -69.2019;

function Index() {
  const [query, setQuery] = useState("");
  const [view, setView] = useState<View>("idle");
  const [results, setResults] = useState<ResultItem[]>([]);
  const [errorMsg, setErrorMsg] = useState<string>("");

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    setView("loading");
    setErrorMsg("");
    try {
      const url = `${API_URL}?query=${encodeURIComponent(q)}&lat=${LAT}&lon=${LON}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const data: ResultItem[] = Array.isArray(json?.data) ? json.data : [];
      setResults(data);
      setView(data.length === 0 ? "empty" : "results");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Error desconocido");
      setView("error");
    }
  };

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen max-w-md flex-col px-5 pb-10 pt-12">
        {/* Header */}
        <header className={`flex flex-col items-center text-center transition-all ${view === "idle" ? "mt-16" : "mt-2"}`}>

          <div className="flex items-center gap-2">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary text-primary-foreground">
              <Sparkles className="h-5 w-5" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Dosis<span className="text-primary">Ya</span>
            </h1>
          </div>
          {view === "idle" && (
            <p className="mt-3 text-balance text-sm text-muted-foreground">
              Encuentra tu medicamento al mejor precio en farmacias cerca de ti.
            </p>
          )}
        </header>

        {/* Search */}
        <form onSubmit={handleSearch} className="mt-8">
          <div className="group relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar medicamento..."
              className="h-14 w-full rounded-lg border border-border bg-card pl-12 pr-4 text-base text-foreground shadow-sm outline-none transition-all placeholder:text-muted-foreground focus:border-primary focus:ring-4 focus:ring-primary/15"
              aria-label="Buscar medicamento"
            />
          </div>
          <button
            type="submit"
            className="mt-3 h-12 w-full rounded-lg bg-primary text-sm font-semibold text-primary-foreground transition-all hover:opacity-90 active:scale-[0.99]"
          >
            Buscar
          </button>
        </form>

        {/* States */}
        <section className="mt-8 flex-1">
          {view === "loading" && <LoadingState />}
          {view === "empty" && <EmptyState />}
          {view === "error" && (
            <p className="mt-8 text-center text-sm text-destructive">
              Ocurrió un error al buscar: {errorMsg}
            </p>
          )}
          {view === "results" && (
            <div className="space-y-4">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {results.length} resultado{results.length !== 1 && "s"}
              </p>
              {results.map((item) => (
                <ResultCard key={item.id_inventario} item={item} />
              ))}
            </div>
          )}
          {view === "idle" && (
            <p className="mt-12 text-center text-xs text-muted-foreground">
              Tip: prueba escribiendo el nombre de un medicamento.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}

function ResultCard({ item }: { item: ResultItem }) {

  const { medicamento, precio, farmacia, ubicacion } = item;
  const waUrl = `https://wa.me/${farmacia.whatsapp_contacto.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(
    `Hola, ¿tienen ${medicamento.nombre_normalizado} disponible?`
  )}`;

  return (
    <article
      className="overflow-hidden rounded-lg border border-border bg-card p-5"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-xl font-bold capitalize leading-tight text-foreground">
          {medicamento.nombre_normalizado}
        </h2>
        {farmacia.es_premium && (
          <span
            className="inline-flex shrink-0 items-center gap-1 rounded-md px-2.5 py-1 text-xs font-bold text-premium-foreground shadow-sm"
            style={{ background: "var(--gradient-premium)" }}
          >
            <Sparkles className="h-3 w-3" />
            Premium
          </span>
        )}
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-3xl font-extrabold text-foreground">${precio.usd.toFixed(2)}</span>
        <span className="text-sm text-muted-foreground">Bs. {precio.ves.toFixed(2)}</span>
      </div>

      <div className="mt-4 border-t border-border pt-3">
        <p className="text-sm font-semibold text-foreground">{farmacia.nombre}</p>
        <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="h-3.5 w-3.5" />
          A {ubicacion.distancia_km} km de ti
        </p>
      </div>

      <a
        href={waUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-whatsapp font-semibold text-whatsapp-foreground transition-all hover:opacity-90 active:scale-[0.99]"
      >
        <WhatsAppIcon className="h-5 w-5" />
        Contactar por WhatsApp
      </a>
    </article>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <Loader2 className="h-10 w-10 animate-spin text-primary" />
      <p className="mt-4 text-sm font-medium text-foreground">Rastreando farmacias cercanas...</p>
      <div className="mt-6 w-full space-y-3">
        <div className="h-28 animate-pulse rounded-lg bg-muted" />
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
      <div className="grid h-16 w-16 place-items-center rounded-full bg-muted">
        <PackageSearch className="h-8 w-8 text-muted-foreground" />
      </div>
      <p className="mt-4 max-w-xs text-balance text-sm text-muted-foreground">
        No encontramos este medicamento cerca de ti. Revisa si el nombre está bien escrito o intenta con un radio más amplio.
      </p>
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

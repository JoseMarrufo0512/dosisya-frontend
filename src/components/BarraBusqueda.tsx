import { Bike, Search } from "lucide-react";

const formatDistancia = (m: number) =>
  m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;

type Props = {
  query: string;
  onQueryChange: (v: string) => void;
  radio: number;
  onRadioChange: (v: number) => void;
  conDelivery: boolean;
  onDeliveryChange: (v: boolean) => void;
  onSubmit: (e: React.FormEvent) => void;
};

export function BarraBusqueda({
  query,
  onQueryChange,
  radio,
  onRadioChange,
  conDelivery,
  onDeliveryChange,
  onSubmit,
}: Props) {
  return (
    <form onSubmit={onSubmit} className="mt-5">
      <div className="group relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
        <input
          type="text"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Ej: Losartán, Atamel, Ibuprofeno..."
          className="h-14 w-full rounded-xl border border-border bg-card pl-12 pr-4 text-base text-foreground shadow-sm outline-none transition-all placeholder:text-muted-foreground focus:border-primary focus:ring-4 focus:ring-primary/15"
          aria-label="Buscar medicamento"
        />
      </div>

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
          onChange={(e) => onRadioChange(parseInt(e.target.value, 10))}
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
              onChange={(e) => onDeliveryChange(e.target.checked)}
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
  );
}

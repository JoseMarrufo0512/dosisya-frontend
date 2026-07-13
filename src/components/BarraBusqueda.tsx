import { Search, Loader2, Clock, Camera } from "lucide-react";

interface BarraBusquedaProps {
  query: string;
  onQueryChange: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  cargando: boolean;
  onRecalcularUbicacion: () => void;
  busquedasRecientes: string[];
  onBusquedaRecienteClick: (termino: string) => void;
  compacta?: boolean;
  /** Callback para abrir el escáner de récipe médico con IA. */
  onEscanearRecipe?: () => void;
}

export function BarraBusqueda({
  query,
  onQueryChange,
  onSubmit,
  cargando,
  onRecalcularUbicacion,
  busquedasRecientes,
  onBusquedaRecienteClick,
  compacta = false,
  onEscanearRecipe,
}: BarraBusquedaProps) {
  return (
    <div className={`w-full ${compacta ? "" : "max-w-xl mx-auto"}`}>
      <form onSubmit={onSubmit} className="relative flex items-center w-full">
        <div className="absolute left-4 text-gray-400">
          {cargando ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="¿Qué medicamento necesitas? (ej: Losartán, Amoxicilina...)"
          className={`w-full rounded-full border border-gray-200 bg-white text-gray-900 shadow-md outline-none transition-all focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 ${
            compacta ? "h-10 pl-10 pr-20 text-sm" : "h-14 pl-12 pr-24 text-base"
          }`}
        />
        {/* Botón de escaneo de récipe (cámara IA) */}
        {onEscanearRecipe && (
          <button
            type="button"
            onClick={onEscanearRecipe}
            className={`absolute flex items-center justify-center rounded-full text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 transition-colors ${
              compacta ? "right-9 h-6 w-6" : "right-12 h-10 w-10"
            }`}
            title="Escanear récipe médico"
            aria-label="Escanear récipe médico con IA"
          >
            <Camera className={compacta ? "h-4 w-4" : "h-5 w-5"} />
          </button>
        )}
        <button
          type="button"
          onClick={onRecalcularUbicacion}
          className={`absolute right-2 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500 transition-colors ${
            compacta ? "h-6 w-6 text-sm" : "h-10 w-10 text-xl"
          }`}
          title="Recalcular ubicación"
        >
          📍
        </button>
      </form>
      
      {!compacta && busquedasRecientes.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          {busquedasRecientes.slice(0, 3).map((term) => (
            <button
              key={term}
              onClick={() => onBusquedaRecienteClick(term)}
              className="flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-500 hover:bg-gray-200 transition-colors"
            >
              <Clock className="h-3 w-3" />
              {term}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}


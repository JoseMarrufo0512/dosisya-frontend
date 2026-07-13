import { type FormEvent } from "react";
import { BarraBusqueda } from "./BarraBusqueda";
import { CATEGORIAS } from "@/lib/categorias";
import type { Recordatorio } from "@/hooks/useLocalStorage";

interface HeroBusquedaProps {
  query: string;
  onQueryChange: (q: string) => void;
  onSubmit: (e: FormEvent) => void;
  cargando: boolean;
  onRecalcularUbicacion: () => void;
  busquedasRecientes: string[];
  /** Ejecuta una búsqueda con un término dado (chips de categoría/recientes). */
  onBuscarTermino: (termino: string) => void;
  /** Recordatorios ya vencidos (evaluados tras montar — SSR-safe en App). */
  resurtidosVencidos: Recordatorio[];
  /** Re-arma el ciclo del recordatorio y busca el término. */
  onResurtir: (termino: string) => void;
  geoError: string | null;
  geoCargando: boolean;
  conDelivery: boolean;
  onToggleDelivery: () => void;
}

/**
 * Hero variante "accesos rápidos + confianza" (spec busqueda-v2 §2.2):
 * buscador, chips de categorías, resurtidos vencidos, recientes y fila
 * de señales de confianza. Sin estado propio: todo llega por props.
 */
export function HeroBusqueda({
  query,
  onQueryChange,
  onSubmit,
  cargando,
  onRecalcularUbicacion,
  busquedasRecientes,
  onBuscarTermino,
  resurtidosVencidos,
  onResurtir,
  geoError,
  geoCargando,
  conDelivery,
  onToggleDelivery,
}: HeroBusquedaProps) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gray-50">
      <div className="text-center mb-6">
        <h1 className="font-black text-4xl">
          <span className="text-gray-900">Dosis</span>
          <span className="text-emerald-600">Ya</span>
        </h1>
        <p className="text-gray-400 text-sm mt-1">
          Encuentra tu medicamento en Acarigua/Araure
        </p>
      </div>

      <BarraBusqueda
        query={query}
        onQueryChange={onQueryChange}
        onSubmit={onSubmit}
        cargando={cargando}
        onRecalcularUbicacion={onRecalcularUbicacion}
        busquedasRecientes={busquedasRecientes}
        onBusquedaRecienteClick={onBuscarTermino}
        compacta={false}
      />

      {/* Chips de categorías — cada uno dispara una búsqueda real */}
      <div className="mt-4 w-full max-w-xl mx-auto flex flex-wrap justify-center gap-2">
        {CATEGORIAS.map((c) => (
          <button
            key={c.termino}
            type="button"
            onClick={() => onBuscarTermino(c.termino)}
            className="rounded-full bg-white border border-gray-200 text-gray-700 text-sm px-3 py-1.5 hover:border-emerald-300 hover:bg-emerald-50 transition-colors"
          >
            <span aria-hidden="true">{c.emoji}</span> {c.etiqueta}
          </button>
        ))}
      </div>

      {/* Recordatorio de resurtido — "welcome back" para crónicos */}
      {resurtidosVencidos.length > 0 && (
        <div className="mt-4 w-full max-w-xl mx-auto rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3">
          <p className="text-sm font-medium text-emerald-800 flex items-center gap-2">
            <span aria-hidden="true">🔔</span> Es hora de resurtir
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {resurtidosVencidos.map((r) => (
              <button
                key={r.termino}
                type="button"
                onClick={() => onResurtir(r.termino)}
                className="rounded-full bg-white border border-emerald-300 text-emerald-800 text-sm px-3 py-1 hover:bg-emerald-100 transition-colors"
              >
                Buscar {r.termino}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-2 text-center text-xs text-gray-400">
        {geoError ? (
          <p className="text-amber-600">⚠️ {geoError}</p>
        ) : geoCargando ? (
          <p>Obteniendo ubicación...</p>
        ) : (
          <p>📍 Usando tu ubicación actual</p>
        )}
      </div>

      {/* Señales de confianza (mezcla aprobada: hero C + fila de B) */}
      <div className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-1 text-xs text-gray-500">
        <span>✅ Farmacias verificadas</span>
        <span>💵 Precios en $ y Bs</span>
        <span>🛵 Delivery local</span>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <label className="text-sm text-gray-600 font-medium">
          Solo con delivery 🛵
        </label>
        <button
          type="button"
          onClick={onToggleDelivery}
          role="switch"
          aria-checked={conDelivery}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            conDelivery ? "bg-emerald-500" : "bg-gray-300"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              conDelivery ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>
    </div>
  );
}

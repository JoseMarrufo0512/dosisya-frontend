import { useMemo } from "react";
import { Slider } from "@/components/ui/slider";
import { type Filtros, FILTROS_INICIALES, hayFiltrosActivos, rangoPrecios } from "@/lib/filtros";
import type { ResultadoFarmacia } from "@/lib/api";

interface BarraFiltrosProps {
  /** Resultados SIN filtrar (para calcular rangos de los sliders). */
  resultados: ResultadoFarmacia[];
  filtros: Filtros;
  onFiltrosChange: (f: Filtros) => void;
  orden: "relevancia" | "precio";
  onOrdenChange: (o: "relevancia" | "precio") => void;
  /** Radio de búsqueda actual en metros (tope del slider de distancia). */
  radioM: number;
}

/**
 * Barra de filtros client-side (spec busqueda-v2 §2.3). Solo se muestra con
 * ≥2 resultados. Emite un objeto Filtros; el filtrado vive en App (useMemo
 * puro con aplicarFiltros) — esta barra no filtra nada por sí misma.
 */
export function BarraFiltros({
  resultados,
  filtros,
  onFiltrosChange,
  orden,
  onOrdenChange,
  radioM,
}: BarraFiltrosProps) {
  const rango = useMemo(() => rangoPrecios(resultados), [resultados]);
  if (resultados.length < 2 || !rango) return null;

  const precioMin = filtros.precioMin ?? rango.min;
  const precioMax = filtros.precioMax ?? rango.max;
  const distanciaM = filtros.distanciaMaxM ?? radioM;
  const rangoDegenerado = rango.min === rango.max;

  const set = (parcial: Partial<Filtros>) => onFiltrosChange({ ...filtros, ...parcial });

  const botonTipo = (valor: Filtros["tipo"], etiqueta: string) => (
    <button
      type="button"
      onClick={() => set({ tipo: valor })}
      aria-pressed={filtros.tipo === valor}
      className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
        filtros.tipo === valor
          ? "bg-primary text-primary-foreground"
          : "text-gray-600 hover:bg-gray-100"
      }`}
    >
      {etiqueta}
    </button>
  );

  return (
    <div className="rounded-xl bg-white border border-gray-100 shadow-sm px-3 py-2.5 space-y-2.5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {/* Orden (movido desde el bloque anterior de App) */}
        <div className="flex items-center gap-1.5 text-sm">
          <span className="text-gray-500 text-xs">Ordenar:</span>
          <div className="inline-flex rounded-lg border border-gray-200 p-0.5">
            <button
              type="button"
              onClick={() => onOrdenChange("relevancia")}
              aria-pressed={orden === "relevancia"}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                orden === "relevancia"
                  ? "bg-primary text-primary-foreground"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              Relevancia
            </button>
            <button
              type="button"
              onClick={() => onOrdenChange("precio")}
              aria-pressed={orden === "precio"}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                orden === "precio"
                  ? "bg-primary text-primary-foreground"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              Precio ↑
            </button>
          </div>
        </div>

        {/* Genérico / marca / todos */}
        <div className="inline-flex rounded-lg border border-gray-200 p-0.5">
          {botonTipo("todos", "Todos")}
          {botonTipo("generico", "Genéricos")}
          {botonTipo("marca", "De marca")}
        </div>

        {/* Delivery client-side */}
        <button
          type="button"
          onClick={() => set({ soloDelivery: !filtros.soloDelivery })}
          aria-pressed={filtros.soloDelivery}
          className={`rounded-md px-2.5 py-1 text-xs font-medium border transition-colors ${
            filtros.soloDelivery
              ? "bg-emerald-50 border-emerald-300 text-emerald-800"
              : "border-gray-200 text-gray-600 hover:bg-gray-100"
          }`}
        >
          🛵 Con delivery
        </button>

        {hayFiltrosActivos(filtros) && (
          <button
            type="button"
            onClick={() => onFiltrosChange(FILTROS_INICIALES)}
            className="ml-auto text-xs font-medium text-emerald-700 hover:underline"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
        {/* Precio — slider doble. Oculto si todos cuestan lo mismo. */}
        {!rangoDegenerado && (
          <div>
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>Precio (USD)</span>
              <span className="font-medium text-gray-700">
                ${precioMin.toFixed(2)} – ${precioMax.toFixed(2)}
              </span>
            </div>
            <Slider
              min={rango.min}
              max={rango.max}
              step={0.1}
              value={[precioMin, precioMax]}
              onValueChange={([lo, hi]) =>
                set({
                  precioMin: lo <= rango.min ? null : lo,
                  precioMax: hi >= rango.max ? null : hi,
                })
              }
              aria-label="Rango de precio en dólares"
            />
          </div>
        )}

        {/* Distancia — refina DENTRO del radio ya buscado, sin nueva llamada */}
        <div>
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>Distancia máx.</span>
            <span className="font-medium text-gray-700">{(distanciaM / 1000).toFixed(1)} km</span>
          </div>
          <Slider
            min={500}
            max={radioM}
            step={500}
            value={[distanciaM]}
            onValueChange={([d]) => set({ distanciaMaxM: d >= radioM ? null : d })}
            aria-label="Distancia máxima en metros"
          />
        </div>
      </div>
    </div>
  );
}

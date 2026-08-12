import { FormEvent } from "react";
import { ChevronLeft, Search, X, SlidersHorizontal, ChevronDown, Info } from "lucide-react";
import { EstadoCargando } from "../EstadoCargando";
import { EstadoVacio } from "../EstadoVacio";
import { BarraFiltros } from "../BarraFiltros";
import { TarjetaResultado } from "../TarjetaResultado";
import { type Filtros, FILTROS_INICIALES, hayFiltrosActivos, claveResultado } from "@/lib/filtros";
import type { ResultadoFarmacia } from "@/lib/api";

interface VistaResultadosProps {
  query: string;
  setQuery: (q: string) => void;
  handleSubmit: (e: FormEvent) => void;
  setEstado: (e: "hero" | "resultados") => void;
  terminoBuscado: string;
  setTerminoBuscado: (t: string) => void;
  cargando: boolean;
  totalResultados: number;
  resultados: ResultadoFarmacia[]; // Original results
  resultadosOrdenados: ResultadoFarmacia[];
  resultadosVisibles: ResultadoFarmacia[];
  filtrosAbiertos: boolean;
  setFiltrosAbiertos: React.Dispatch<React.SetStateAction<boolean>>;
  orden: "relevancia" | "precio";
  setOrden: (o: "relevancia" | "precio") => void;
  filtros: Filtros;
  setFiltros: (f: Filtros) => void;
  radio: number;
  totalDistintos: number;
  recordatoriosActivo: boolean;
  onEliminarRecordatorio: (term: string) => void;
  onAgregarRecordatorio: (term: string) => void;
  claveEconomico: string | null;
  compararClaves: string[];
  MAX_COMPARAR: number;
  volarAlCarrito: (desde: DOMRect) => void;
  toggleComparar: (clave: string) => void;
  alLimpiarBusqueda: () => { estado: "hero" | "resultados"; query: string; terminoBuscado: string };
  montado: boolean;
}

export function VistaResultados({
  query,
  setQuery,
  handleSubmit,
  setEstado,
  terminoBuscado,
  setTerminoBuscado,
  cargando,
  totalResultados,
  resultados,
  resultadosOrdenados,
  resultadosVisibles,
  filtrosAbiertos,
  setFiltrosAbiertos,
  orden,
  setOrden,
  filtros,
  setFiltros,
  radio,
  totalDistintos,
  recordatoriosActivo,
  onEliminarRecordatorio,
  onAgregarRecordatorio,
  claveEconomico,
  compararClaves,
  MAX_COMPARAR,
  volarAlCarrito,
  toggleComparar,
  alLimpiarBusqueda,
  montado,
}: VistaResultadosProps) {
  return (
    <div className="min-h-screen bg-[var(--papel)] flex flex-col">
      <header className="sticky top-0 z-10 bg-[var(--papel)] px-4 pt-2.5 pb-2">
        <div className="mx-auto max-w-2xl">
          {/* input activo con volver + limpiar (handoff) */}
          <form onSubmit={handleSubmit} className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setEstado("hero")}
              aria-label="Volver a la pantalla de inicio"
              className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-xl border border-[var(--borde)] bg-[var(--fondo-suave)] text-[color:var(--tinta)]"
            >
              <ChevronLeft size={19} />
            </button>
            <div className="flex h-[46px] flex-1 items-center gap-2.5 rounded-[14px] border-[1.5px] border-[var(--verde-cruz)] bg-white px-3 shadow-[0_4px_14px_-8px_rgba(15,76,58,0.4)]">
              <Search size={19} className="shrink-0 text-[var(--verde-cruz)]" aria-hidden="true" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Buscar medicamento"
                className="min-w-0 flex-1 bg-transparent text-[14.5px] text-[color:var(--tinta)] outline-none"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => {
                    const limpio = alLimpiarBusqueda();
                    setEstado(limpio.estado);
                    setQuery(limpio.query);
                    setTerminoBuscado(limpio.terminoBuscado);
                  }}
                  aria-label="Borrar búsqueda"
                  className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-[var(--fondo-suave)] text-[color:var(--tinta-tenue)]"
                >
                  <X size={15} />
                </button>
              )}
            </div>
          </form>

          {/* conteo + filtro discreto + orden */}
          <div className="mt-2.5 flex items-center justify-between">
            <span className="text-[13px] font-semibold text-[color:var(--tinta)]">
              {totalResultados} resultado{totalResultados === 1 ? "" : "s"} cerca
            </span>
            <div className="flex items-center gap-3.5">
              {resultadosOrdenados.length >= 2 && (
                <button
                  type="button"
                  onClick={() => setFiltrosAbiertos((v) => !v)}
                  aria-expanded={filtrosAbiertos}
                  aria-label="Filtros"
                  className={`relative flex items-center gap-1 text-xs ${
                    filtrosAbiertos
                      ? "text-[color:var(--verde-cruz)]"
                      : "text-[color:var(--tinta-suave)]"
                  }`}
                >
                  <SlidersHorizontal size={15} aria-hidden="true" />
                  Filtrar
                  {hayFiltrosActivos(filtros) && (
                    <span
                      className="absolute -right-1 -top-0.5 h-1.5 w-1.5 rounded-full bg-[var(--verde-cruz)]"
                      aria-hidden="true"
                    />
                  )}
                </button>
              )}
              <button
                type="button"
                onClick={() => setOrden(orden === "precio" ? "relevancia" : "precio")}
                aria-label={`Ordenar por ${orden === "precio" ? "relevancia" : "precio"}`}
                className="flex items-center gap-1 text-xs text-[color:var(--tinta-suave)]"
              >
                Ordenar:{" "}
                <span className="font-semibold text-[color:var(--verde-cruz)]">
                  {orden === "precio" ? "precio" : "relevancia"}
                </span>
                <ChevronDown size={13} className="text-[var(--verde-cruz)]" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        <div
          className={`max-w-2xl mx-auto px-4 py-4 space-y-3 ${totalDistintos > 0 ? "pb-44" : "pb-24"}`}
        >
          {cargando && <EstadoCargando />}

          {!cargando && resultados.length === 0 && <EstadoVacio termino={terminoBuscado} />}

          {!cargando && resultadosOrdenados.length > 0 && (
            <div
              role="note"
              className="flex items-start gap-2 rounded-xl border border-[#f3dcc0] bg-[var(--ambar-fondo)] px-2.5 py-2 text-xs leading-snug text-[color:var(--ambar-receta)]"
            >
              <Info size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
              <p>
                Algunos medicamentos requieren <strong>récipe médico</strong>. La farmacia te lo
                pedirá al momento de la compra.
              </p>
            </div>
          )}

          {!cargando && resultadosOrdenados.length > 0 && terminoBuscado && (
            <div className="flex justify-end">
              {montado && recordatoriosActivo ? (
                <button
                  type="button"
                  onClick={() => onEliminarRecordatorio(terminoBuscado)}
                  className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-medium px-3 py-1.5 hover:bg-emerald-100 transition-colors"
                >
                  🔔 Te recordaré resurtir · quitar
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onAgregarRecordatorio(terminoBuscado)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 text-gray-600 text-xs font-medium px-3 py-1.5 hover:bg-gray-50 transition-colors"
                >
                  🔔 Recordarme resurtir en 30 días
                </button>
              )}
            </div>
          )}

          {!cargando && filtrosAbiertos && resultadosOrdenados.length >= 2 && (
            <BarraFiltros
              resultados={resultadosOrdenados}
              filtros={filtros}
              onFiltrosChange={setFiltros}
              radioM={radio}
            />
          )}

          {!cargando &&
            resultadosVisibles.map((res, i) => {
              const clave = claveResultado(res);
              const comparando = compararClaves.includes(clave);
              return (
                <TarjetaResultado
                  key={`${clave}-${i}`}
                  resultado={res}
                  esMasEconomico={clave === claveEconomico}
                  onAgregado={volarAlCarrito}
                  comparando={comparando}
                  onToggleComparar={() => toggleComparar(clave)}
                  compararDeshabilitado={!comparando && compararClaves.length >= MAX_COMPARAR}
                />
              );
            })}

          {!cargando &&
            resultados.length > 0 &&
            resultadosVisibles.length === 0 &&
            hayFiltrosActivos(filtros) && (
              <div className="rounded-xl bg-white border border-gray-100 p-8 text-center">
                <p className="text-sm text-gray-600">Ningún resultado cumple los filtros.</p>
                <button
                  type="button"
                  onClick={() => setFiltros(FILTROS_INICIALES)}
                  className="mt-3 rounded-lg bg-primary text-primary-foreground text-sm font-medium px-4 py-2 hover:opacity-90 transition-opacity"
                >
                  Limpiar filtros
                </button>
              </div>
            )}

          {!cargando && resultadosOrdenados.length > 0 && (
            <p className="flex items-center justify-center gap-1.5 text-center text-xs text-gray-400 pt-1">
              <span aria-hidden="true">✅</span>
              Farmacias afiliadas y verificadas por DosisYa
            </p>
          )}
        </div>
      </main>
    </div>
  );
}

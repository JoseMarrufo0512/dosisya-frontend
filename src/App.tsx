import { useMemo, useState, FormEvent } from "react";
import { useGeolocalizacion } from "./hooks/useGeolocalizacion";
import { useBuscarMedicamentos } from "./hooks/useBuscarMedicamentos";
import { useBusquedasRecientes } from "./hooks/useLocalStorage";
import { useListaMedica } from "./hooks/useListaMedica";
import { BarraBusqueda } from "./components/BarraBusqueda";
import { TarjetaResultado } from "./components/TarjetaResultado";
import { EstadoCargando } from "./components/EstadoCargando";
import { EstadoVacio } from "./components/EstadoVacio";
import { CartSummary } from "./components/lista/CartSummary";
import { ListaMedicaDrawer } from "./components/lista/ListaMedicaDrawer";

// Fallback: centro de Acarigua (mismo criterio que la versión anterior)
const LAT_ACARIGUA = 9.5569;
const LNG_ACARIGUA = -69.1982;

export default function App() {
  const geo = useGeolocalizacion();
  const api = useBuscarMedicamentos();
  const recientes = useBusquedasRecientes();
  const { totalDistintos } = useListaMedica();

  const [estado, setEstado] = useState<"hero" | "resultados">("hero");
  const [query, setQuery] = useState("");
  const [conDelivery, setConDelivery] = useState(false);
  const [radio, setRadio] = useState(5000);
  const [terminoBuscado, setTerminoBuscado] = useState("");
  const [listaAbierta, setListaAbierta] = useState(false);
  // Orden de resultados. "relevancia" = orden del backend (proximidad + boost
  // premium; NO tocar por defecto, es parte de la monetización). "precio" =
  // orden ascendente por precio_usd, solo del lado del cliente y opt-in.
  const [orden, setOrden] = useState<"relevancia" | "precio">("relevancia");

  // Resultados ordenados según el toggle, sin mutar el array original.
  const resultadosOrdenados = useMemo(() => {
    if (orden === "precio") {
      return [...api.resultados].sort((a, b) => a.precio_usd - b.precio_usd);
    }
    return api.resultados;
  }, [api.resultados, orden]);

  // Índice del resultado de menor precio (para el badge "Más económico").
  // Independiente del orden mostrado. Solo con ≥2 resultados tiene sentido.
  const idxMasEconomico = useMemo(() => {
    if (resultadosOrdenados.length < 2) return -1;
    let idx = 0;
    for (let i = 1; i < resultadosOrdenados.length; i++) {
      if (resultadosOrdenados[i].precio_usd < resultadosOrdenados[idx].precio_usd) {
        idx = i;
      }
    }
    return idx;
  }, [resultadosOrdenados]);

  // Genéricos equivalentes: por cada producto, el precio del equivalente más
  // barato = mismo principio activo (medicamento_nombre) pero DISTINTO producto
  // (medicamento_id). Ojo: mismo producto en otra farmacia NO cuenta (eso es
  // comparación de precio, no equivalencia). key = medicamento_id.
  const equivMasBaratoPorProducto = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of resultadosOrdenados) {
      let min = Infinity;
      for (const b of resultadosOrdenados) {
        if (
          b.medicamento_nombre === a.medicamento_nombre &&
          b.medicamento_id !== a.medicamento_id &&
          b.precio_usd < min
        ) {
          min = b.precio_usd;
        }
      }
      if (min < Infinity) m.set(a.medicamento_id, min);
    }
    return m;
  }, [resultadosOrdenados]);

  // Coordenadas efectivas: geolocalización real o fallback a Acarigua.
  // Se comparten entre la búsqueda y el selector de farmacia de la lista.
  const latEfectiva = geo.lat ?? LAT_ACARIGUA;
  const lngEfectiva = geo.lng ?? LNG_ACARIGUA;

  const ejecutarBusqueda = async (termino: string, radioKm: number = 5) => {
    if (!termino.trim()) return;

    setEstado("resultados");
    setTerminoBuscado(termino);
    setQuery(termino);
    recientes.agregar(termino);
    setRadio(radioKm * 1000);

    await api.buscar(termino, latEfectiva, lngEfectiva, conDelivery, radioKm * 1000);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    ejecutarBusqueda(query, 5);
  };

  const handleRecalcular = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        () => {
          // El hook global normalmente reacciona, pero forzamos un refresh visual si fuera necesario.
        },
        () => {}
      );
    }
  };

  const vistaHero = (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gray-50">
      <div className="text-center mb-8">
        <h1 className="font-black text-4xl">
          <span className="text-gray-900">Dosis</span>
          <span className="text-emerald-600">Ya</span>
        </h1>
        <p className="text-gray-400 text-sm mt-1">Encuentra tu medicamento en Acarigua/Araure</p>
      </div>

      <BarraBusqueda
        query={query}
        onQueryChange={setQuery}
        onSubmit={handleSubmit}
        cargando={api.cargando}
        onRecalcularUbicacion={handleRecalcular}
        busquedasRecientes={recientes.busquedas}
        onBusquedaRecienteClick={(term) => ejecutarBusqueda(term, 5)}
        compacta={false}
      />

      <div className="mt-2 text-center text-xs text-gray-400">
        {geo.error ? (
          <p className="text-amber-600">⚠️ {geo.error}</p>
        ) : geo.cargando ? (
          <p>Obteniendo ubicación...</p>
        ) : (
          <p>📍 Usando tu ubicación actual</p>
        )}
      </div>

      <div className="mt-8 flex items-center gap-3">
        <label className="text-sm text-gray-600 font-medium">Solo con delivery 🛵</label>
        <button
          type="button"
          onClick={() => setConDelivery(!conDelivery)}
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

  const vistaResultados = (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="sticky top-0 bg-white shadow-sm z-10 py-3 px-4">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center gap-4">
          <div className="flex-1 w-full">
            <BarraBusqueda
              query={query}
              onQueryChange={setQuery}
              onSubmit={handleSubmit}
              cargando={api.cargando}
              onRecalcularUbicacion={handleRecalcular}
              busquedasRecientes={recientes.busquedas}
              onBusquedaRecienteClick={(term) => ejecutarBusqueda(term, radio / 1000)}
              compacta={true}
            />
          </div>
        </div>

        <div className="max-w-4xl mx-auto mt-3 flex items-center justify-between text-sm text-gray-600">
          <p>
            <span className="font-semibold text-gray-900">{api.totalResultados}</span> resultado(s) para '{terminoBuscado}'
          </p>
          <div className="flex items-center gap-2">
            <span>Radio: {radio / 1000}km</span>
            {radio < 10000 && (
              <button
                onClick={() => ejecutarBusqueda(terminoBuscado, 10)}
                className="text-emerald-600 font-medium hover:underline"
              >
                Ampliar
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        {/* pb-28 evita que la barra flotante de la lista tape la última tarjeta */}
        <div
          className={`max-w-2xl mx-auto px-4 py-4 space-y-3 ${totalDistintos > 0 ? "pb-28" : ""}`}
        >
          {api.cargando && <EstadoCargando />}

          {!api.cargando && api.resultados.length === 0 && (
            <EstadoVacio termino={terminoBuscado} />
          )}

          {/* Toggle de orden — solo con ≥2 resultados. Default "relevancia"
              preserva el orden del backend (boost premium). */}
          {!api.cargando && resultadosOrdenados.length >= 2 && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-500">Ordenar:</span>
              <div className="inline-flex rounded-lg border border-gray-200 p-0.5">
                <button
                  type="button"
                  onClick={() => setOrden("relevancia")}
                  aria-pressed={orden === "relevancia"}
                  className={`rounded-md px-3 py-1 font-medium transition-colors ${
                    orden === "relevancia"
                      ? "bg-primary text-primary-foreground"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  Relevancia
                </button>
                <button
                  type="button"
                  onClick={() => setOrden("precio")}
                  aria-pressed={orden === "precio"}
                  className={`rounded-md px-3 py-1 font-medium transition-colors ${
                    orden === "precio"
                      ? "bg-primary text-primary-foreground"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  Precio ↑
                </button>
              </div>
            </div>
          )}

          {!api.cargando && resultadosOrdenados.map((res, i) => {
            // Solo avisamos si el equivalente más barato del mismo principio
            // activo cuesta MENOS que este producto.
            const equivMin = equivMasBaratoPorProducto.get(res.medicamento_id);
            const equivalenteDesde =
              equivMin !== undefined && equivMin < res.precio_usd ? equivMin : null;
            return (
              <TarjetaResultado
                key={`${res.farmacia_id}-${res.medicamento_id}-${i}`}
                resultado={res}
                esMasEconomico={i === idxMasEconomico}
                equivalenteDesde={equivalenteDesde}
              />
            );
          })}
        </div>
      </main>
    </div>
  );

  return (
    <>
      {estado === "hero" ? vistaHero : vistaResultados}

      {/* Lista Médica — visible sobre ambas vistas (spec receta-ia-y-carrito) */}
      <CartSummary onVerLista={() => setListaAbierta(true)} />
      <ListaMedicaDrawer
        abierta={listaAbierta}
        onOpenChange={setListaAbierta}
        lat={latEfectiva}
        lng={lngEfectiva}
      />
    </>
  );
}

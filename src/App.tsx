import { useEffect, useMemo, useState, FormEvent } from "react";
import { useGeolocalizacion } from "./hooks/useGeolocalizacion";
import { useBuscarMedicamentos } from "./hooks/useBuscarMedicamentos";
import { useBusquedasRecientes, useRecordatorios } from "./hooks/useLocalStorage";
import { useListaMedica } from "./hooks/useListaMedica";
import { HeroBusqueda } from "./components/HeroBusqueda";
import { BarraBusqueda } from "./components/BarraBusqueda";
import { TarjetaResultado } from "./components/TarjetaResultado";
import { EstadoCargando } from "./components/EstadoCargando";
import { EstadoVacio } from "./components/EstadoVacio";
import { CartSummary } from "./components/lista/CartSummary";
import { ListaMedicaDrawer } from "./components/lista/ListaMedicaDrawer";
import { EscanerRecipe } from "./components/EscanerRecipe";

// Fallback: centro de Acarigua (mismo criterio que la versión anterior)
const LAT_ACARIGUA = 9.5569;
const LNG_ACARIGUA = -69.1982;

export default function App() {
  const geo = useGeolocalizacion();
  const api = useBuscarMedicamentos();
  const recientes = useBusquedasRecientes();
  const recordatorios = useRecordatorios();
  const { totalDistintos } = useListaMedica();

  // Los recordatorios dependen de la fecha actual → solo evaluarlos tras montar
  // en el cliente, para no romper la hidratación SSR.
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);
  const resurtidosVencidos = montado ? recordatorios.vencidos() : [];

  const [estado, setEstado] = useState<"hero" | "resultados">("hero");
  const [query, setQuery] = useState("");
  const [conDelivery, setConDelivery] = useState(false);
  const [radio, setRadio] = useState(5000);
  const [terminoBuscado, setTerminoBuscado] = useState("");
  const [listaAbierta, setListaAbierta] = useState(false);
  const [escanerAbierto, setEscanerAbierto] = useState(false);
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
    <HeroBusqueda
      query={query}
      onQueryChange={setQuery}
      onSubmit={handleSubmit}
      cargando={api.cargando}
      onRecalcularUbicacion={handleRecalcular}
      busquedasRecientes={recientes.busquedas}
      onBuscarTermino={(term) => ejecutarBusqueda(term, 5)}
      resurtidosVencidos={resurtidosVencidos}
      onResurtir={(term) => {
        recordatorios.agregar(term); // re-arma otro ciclo de 30 días
        ejecutarBusqueda(term, 5);
      }}
      geoError={geo.error}
      geoCargando={geo.cargando}
      conDelivery={conDelivery}
      onToggleDelivery={() => setConDelivery(!conDelivery)}
    />
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
              onEscanearRecipe={() => setEscanerAbierto(true)}
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

          {/* Aviso de récipe — señal de legitimidad. Los medicamentos
              controlados exigen récipe médico; DosisYa no vende, solo conecta. */}
          {!api.cargando && resultadosOrdenados.length > 0 && (
            <div
              role="note"
              className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800"
            >
              <span aria-hidden="true">📋</span>
              <p>
                Algunos medicamentos requieren <strong>récipe médico</strong>. La
                farmacia te lo pedirá al momento de la compra.
              </p>
            </div>
          )}

          {/* Recordatorio de resurtido — opt-in para el término buscado. */}
          {!api.cargando && resultadosOrdenados.length > 0 && terminoBuscado && (
            <div className="flex justify-end">
              {montado && recordatorios.estaActivo(terminoBuscado) ? (
                <button
                  type="button"
                  onClick={() => recordatorios.eliminar(terminoBuscado)}
                  className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-medium px-3 py-1.5 hover:bg-emerald-100 transition-colors"
                >
                  🔔 Te recordaré resurtir · quitar
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => recordatorios.agregar(terminoBuscado)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 text-gray-600 text-xs font-medium px-3 py-1.5 hover:bg-gray-50 transition-colors"
                >
                  🔔 Recordarme resurtir en 30 días
                </button>
              )}
            </div>
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

          {/* Sello de confianza — todas las farmacias en resultados están
              afiliadas y activas (estado_afiliacion = 'activa' en el backend). */}
          {!api.cargando && resultadosOrdenados.length > 0 && (
            <p className="flex items-center justify-center gap-1.5 text-center text-xs text-gray-400 pt-1">
              <span aria-hidden="true">✅</span>
              Farmacias afiliadas y verificadas por DosisYa
            </p>
          )}
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
      <EscanerRecipe
        abierto={escanerAbierto}
        onOpenChange={setEscanerAbierto}
      />
    </>
  );
}

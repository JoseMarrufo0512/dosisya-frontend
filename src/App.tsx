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
import { BarraFiltros } from "./components/BarraFiltros";
import { ComparadorBar } from "./components/ComparadorBar";
import { ComparadorPanel } from "./components/ComparadorPanel";
import {
  type Filtros,
  FILTROS_INICIALES,
  aplicarFiltros,
  claveMasEconomico,
  claveResultado,
  hayFiltrosActivos,
} from "./lib/filtros";

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
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_INICIALES);

  const MAX_COMPARAR = 3;
  const [compararClaves, setCompararClaves] = useState<string[]>([]);
  const [comparadorAbierto, setComparadorAbierto] = useState(false);

  const toggleComparar = (clave: string) => {
    setCompararClaves((prev) =>
      prev.includes(clave)
        ? prev.filter((c) => c !== clave)
        : prev.length >= MAX_COMPARAR
          ? prev
          : [...prev, clave],
    );
  };

  // Resultados seleccionados, resueltos contra la respuesta actual de la API.
  const seleccionados = useMemo(
    () =>
      compararClaves
        .map((c) => api.resultados.find((r) => claveResultado(r) === c))
        .filter((r): r is NonNullable<typeof r> => r !== undefined),
    [compararClaves, api.resultados],
  );

  // Resultados ordenados según el toggle, sin mutar el array original.
  const resultadosOrdenados = useMemo(() => {
    if (orden === "precio") {
      return [...api.resultados].sort((a, b) => a.precio_usd - b.precio_usd);
    }
    return api.resultados;
  }, [api.resultados, orden]);

  // Resultados visibles = ordenados + filtros client-side (funciones puras).
  const resultadosVisibles = useMemo(
    () => aplicarFiltros(resultadosOrdenados, filtros),
    [resultadosOrdenados, filtros],
  );

  // Clave del más barato ENTRE LOS VISIBLES (badge "Más económico").
  // Por clave y no por índice: los filtros reordenan/ocultan posiciones.
  const claveEconomico = useMemo(() => claveMasEconomico(resultadosVisibles), [resultadosVisibles]);

  // Genéricos equivalentes: por cada producto, el precio del equivalente más
  // barato = mismo principio activo (medicamento_nombre) pero DISTINTO producto
  // (medicamento_id). Ojo: mismo producto en otra farmacia NO cuenta (eso es
  // comparación de precio, no equivalencia). key = medicamento_id.
  const equivMasBaratoPorProducto = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of resultadosVisibles) {
      let min = Infinity;
      for (const b of resultadosVisibles) {
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
  }, [resultadosVisibles]);

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
    setFiltros(FILTROS_INICIALES); // cada búsqueda arranca sin filtros
    setCompararClaves([]);
    setComparadorAbierto(false);

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
        () => {},
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
      onEscanearRecipe={() => setEscanerAbierto(true)}
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
            <span className="font-semibold text-gray-900">{api.totalResultados}</span> resultado(s)
            para '{terminoBuscado}'
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

          {!api.cargando && api.resultados.length === 0 && <EstadoVacio termino={terminoBuscado} />}

          {/* Aviso de récipe — señal de legitimidad. Los medicamentos
              controlados exigen récipe médico; DosisYa no vende, solo conecta. */}
          {!api.cargando && resultadosOrdenados.length > 0 && (
            <div
              role="note"
              className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800"
            >
              <span aria-hidden="true">📋</span>
              <p>
                Algunos medicamentos requieren <strong>récipe médico</strong>. La farmacia te lo
                pedirá al momento de la compra.
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

          {!api.cargando && resultadosOrdenados.length >= 2 && (
            <BarraFiltros
              resultados={resultadosOrdenados}
              filtros={filtros}
              onFiltrosChange={setFiltros}
              orden={orden}
              onOrdenChange={setOrden}
              radioM={radio}
            />
          )}

          {!api.cargando &&
            resultadosVisibles.map((res, i) => {
              // Solo avisamos si el equivalente más barato del mismo principio
              // activo cuesta MENOS que este producto.
              const equivMin = equivMasBaratoPorProducto.get(res.medicamento_id);
              const equivalenteDesde =
                equivMin !== undefined && equivMin < res.precio_usd ? equivMin : null;
              return (
                <TarjetaResultado
                  key={`${claveResultado(res)}-${i}`}
                  resultado={res}
                  esMasEconomico={claveResultado(res) === claveEconomico}
                  equivalenteDesde={equivalenteDesde}
                  comparando={compararClaves.includes(claveResultado(res))}
                  onToggleComparar={() => toggleComparar(claveResultado(res))}
                  compararDeshabilitado={
                    compararClaves.length >= MAX_COMPARAR &&
                    !compararClaves.includes(claveResultado(res))
                  }
                />
              );
            })}

          {/* Había resultados pero los filtros los ocultan todos */}
          {!api.cargando &&
            api.resultados.length > 0 &&
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
      <EscanerRecipe abierto={escanerAbierto} onOpenChange={setEscanerAbierto} />

      <ComparadorBar
        cantidad={seleccionados.length}
        onComparar={() => setComparadorAbierto(true)}
        onLimpiar={() => setCompararClaves([])}
        elevada={totalDistintos > 0}
      />
      <ComparadorPanel
        abierto={comparadorAbierto}
        onOpenChange={setComparadorAbierto}
        seleccionados={seleccionados}
      />
    </>
  );
}

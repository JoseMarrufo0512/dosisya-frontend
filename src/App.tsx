import { useEffect, useMemo, useRef, useState, FormEvent } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useGeolocalizacion } from "./hooks/useGeolocalizacion";
import { useBuscarMedicamentos } from "./hooks/useBuscarMedicamentos";
import { useDebounce } from "./hooks/useDebounce";
import { useBackDismiss } from "./hooks/useBackDismiss";
import { useTasa } from "./hooks/useTasa";
import { useBusquedasRecientes, useRecordatorios } from "./hooks/useLocalStorage";
import { useListaMedica } from "./hooks/useListaMedica";
import { HeroBusqueda } from "./components/HeroBusqueda";
import { SplashScreen } from "./components/SplashScreen";
import { TarjetaResultado } from "./components/TarjetaResultado";
import { EstadoCargando } from "./components/EstadoCargando";
import { EstadoVacio } from "./components/EstadoVacio";
import { CartSummary } from "./components/lista/CartSummary";
import { ListaMedicaDrawer } from "./components/lista/ListaMedicaDrawer";
import { EscanerRecipe } from "./components/EscanerRecipe";
import { BarraFiltros } from "./components/BarraFiltros";
import { ComparadorBar } from "./components/ComparadorBar";
import { ComparadorPanel } from "./components/ComparadorPanel";
import NavegacionPaciente, { type TabPaciente } from "@/components/navegacion/NavegacionPaciente";
import { MenuMasPaciente } from "@/components/paciente/MenuMasPaciente";
import { HojaLoginPaciente } from "@/components/paciente/HojaLoginPaciente";
import { HojaChatIA } from "@/components/paciente/HojaChatIA";
import { BurbujaAsistenteIA } from "@/components/paciente/BurbujaAsistenteIA";
import {
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  MapPin,
  Pill,
  Search,
  X,
  Info,
  SlidersHorizontal,
} from "lucide-react";
import {
  type Filtros,
  FILTROS_INICIALES,
  alternarComparacion,
  aplicarFiltros,
  claveMasEconomico,
  claveResultado,
  hayFiltrosActivos,
  resolverSeleccionados,
} from "./lib/filtros";
import { alLimpiarBusqueda } from "./lib/estadoResultados";

// Fallback: centro de Acarigua (mismo criterio que la versión anterior)
const LAT_ACARIGUA = 9.5569;
const LNG_ACARIGUA = -69.1982;

export default function App() {
  const geo = useGeolocalizacion();
  const api = useBuscarMedicamentos();
  const recientes = useBusquedasRecientes();
  const recordatorios = useRecordatorios();
  const { totalDistintos } = useListaMedica();
  const tasa = useTasa();

  // Splash de carga (logo + señales de confianza): visible por defecto para
  // que coincida en SSR y en el primer render del cliente, sin parpadeo.
  const [splashVisible, setSplashVisible] = useState(true);

  // Los recordatorios dependen de la fecha actual → solo evaluarlos tras montar
  // en el cliente, para no romper la hidratación SSR.
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);
  const resurtidosVencidos = montado ? recordatorios.vencidos() : [];

  const [estado, setEstado] = useState<"hero" | "resultados">("hero");
  const [query, setQuery] = useState("");
  // Búsqueda mientras se escribe: query "retrasado" ~350ms (ver useEffect abajo).
  const queryDebounced = useDebounce(query, 350);
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
  // Filtros ocultos por defecto: se abren desde el ícono discreto del encabezado.
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);

  const MAX_COMPARAR = 3;
  const [compararClaves, setCompararClaves] = useState<string[]>([]);
  const [comparadorAbierto, setComparadorAbierto] = useState(false);

  // Navegación inferior del paciente (handoff): pestaña activa + hoja "Más".
  const [tab, setTab] = useState<TabPaciente>("buscar");
  const [masAbierto, setMasAbierto] = useState(false);
  const [loginAbierto, setLoginAbierto] = useState(false);
  const [chatIAAbierto, setChatIAAbierto] = useState(false);

  // Botón atrás del teléfono → cierra el overlay abierto (uno por capa).
  useBackDismiss(listaAbierta, () => setListaAbierta(false));
  useBackDismiss(escanerAbierto, () => setEscanerAbierto(false));
  useBackDismiss(comparadorAbierto, () => setComparadorAbierto(false));
  useBackDismiss(filtrosAbiertos, () => setFiltrosAbiertos(false));
  useBackDismiss(loginAbierto, () => setLoginAbierto(false));
  useBackDismiss(masAbierto, () => setMasAbierto(false));
  useBackDismiss(chatIAAbierto, () => setChatIAAbierto(false));

  // packFly: paquete que vuela del botón "+" al ícono de Lista (handoff).
  const reduceMotion = useReducedMotion();
  const flyerIdRef = useRef(0);
  type Flyer = {
    id: number;
    x0: number;
    y0: number;
    x1: number;
    y1: number;
    xc: number;
    yc: number;
  };
  const [flyers, setFlyers] = useState<Flyer[]>([]);

  const volarAlCarrito = (desde: DOMRect) => {
    if (reduceMotion) return; // reduced-motion: sin vuelo (el ícono igual rebota al subir el contador)
    const objetivo = document.querySelector('[data-tab="lista"]');
    if (!objetivo) return;
    const t = objetivo.getBoundingClientRect();
    const x0 = desde.left + desde.width / 2;
    const y0 = desde.top + desde.height / 2;
    const x1 = t.left + t.width / 2;
    const y1 = t.top + t.height / 2;
    const xc = (x0 + x1) / 2;
    const yc = Math.min(y0, y1) - 70; // punto de control del arco (mismo criterio del handoff)
    const id = (flyerIdRef.current += 1);
    setFlyers((f) => [...f, { id, x0, y0, x1, y1, xc, yc }]);
    window.setTimeout(() => setFlyers((f) => f.filter((x) => x.id !== id)), 700);
  };

  const toggleComparar = (clave: string) => {
    setCompararClaves((prev) => alternarComparacion(prev, clave, MAX_COMPARAR));
  };

  // Resultados seleccionados, resueltos contra la respuesta actual de la API.
  const seleccionados = useMemo(
    () => resolverSeleccionados(compararClaves, api.resultados),
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

  // Coordenadas efectivas: geolocalización real o fallback a Acarigua.
  // Se comparten entre la búsqueda y el selector de farmacia de la lista.
  const latEfectiva = geo.lat ?? LAT_ACARIGUA;
  const lngEfectiva = geo.lng ?? LNG_ACARIGUA;

  const ejecutarBusqueda = async (
    termino: string,
    radioKm: number = 5,
    opts?: { guardarReciente?: boolean },
  ) => {
    if (!termino.trim()) return;

    setEstado("resultados");
    setTerminoBuscado(termino);
    setQuery(termino);
    // La búsqueda en vivo NO guarda en "recientes" (llenaría de fragmentos:
    // los, losa, losart…). Solo el submit explícito (Enter/botón/chip) lo hace.
    if (opts?.guardarReciente ?? true) recientes.agregar(termino);
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

  // ─── Búsqueda mientras se escribe ──────────────────────────────────────────
  // Dispara ~350ms tras la última tecla, desde 2 caracteres. No guarda en
  // "recientes" y omite el término ya buscado (evita repetir tras Enter/chip).
  useEffect(() => {
    const termino = queryDebounced.trim();
    if (termino.length < 2 || termino === terminoBuscado) return;
    void ejecutarBusqueda(queryDebounced, 5, { guardarReciente: false });
    // ejecutarBusqueda y terminoBuscado se leen frescos en cada disparo del effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryDebounced]);

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
      onAbrirCuenta={() => setLoginAbierto(true)}
      tasa={tasa?.tasa ?? null}
    />
  );

  const vistaResultados = (
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

          {/* conteo + filtro discreto + orden (ambos movidos aquí desde la
              antigua BarraFiltros siempre visible) */}
          <div className="mt-2.5 flex items-center justify-between">
            <span className="text-[13px] font-semibold text-[color:var(--tinta)]">
              {api.totalResultados} resultado{api.totalResultados === 1 ? "" : "s"} cerca
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
        {/* pb-28 evita que la barra flotante de la lista tape la última tarjeta */}
        <div
          className={`max-w-2xl mx-auto px-4 py-4 space-y-3 ${totalDistintos > 0 ? "pb-44" : "pb-24"}`}
        >
          {api.cargando && <EstadoCargando />}

          {!api.cargando && api.resultados.length === 0 && <EstadoVacio termino={terminoBuscado} />}

          {/* Aviso de récipe — señal de legitimidad. Los medicamentos
              controlados exigen récipe médico; DosisYa no vende, solo conecta. */}
          {!api.cargando && resultadosOrdenados.length > 0 && (
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

          {!api.cargando && filtrosAbiertos && resultadosOrdenados.length >= 2 && (
            <BarraFiltros
              resultados={resultadosOrdenados}
              filtros={filtros}
              onFiltrosChange={setFiltros}
              radioM={radio}
            />
          )}

          {!api.cargando &&
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

  // Farmacias cercanas derivadas de los resultados actuales (únicas por id).
  const farmaciasCercanas = useMemo(() => {
    const map = new Map<
      string,
      { id: string; nombre: string; direccion: string; distancia_m: number; count: number }
    >();
    for (const r of api.resultados) {
      const cur = map.get(r.farmacia_id);
      if (cur) cur.count += 1;
      else
        map.set(r.farmacia_id, {
          id: r.farmacia_id,
          nombre: r.farmacia_nombre,
          direccion: r.direccion,
          distancia_m: r.distancia_m,
          count: 1,
        });
    }
    return [...map.values()].sort((a, b) => a.distancia_m - b.distancia_m);
  }, [api.resultados]);

  const fmtKm = (m: number) => (m / 1000).toFixed(1).replace(".", ",") + " km";

  const vistaFarmacias = (
    <div className="dosisya-ui min-h-screen" style={{ background: "var(--papel)" }}>
      <div className="mx-auto max-w-2xl px-4 py-6" style={{ paddingBottom: 104 }}>
        <h1
          style={{ fontSize: 20, fontWeight: 500, color: "var(--tinta)", letterSpacing: "-0.02em" }}
        >
          Farmacias cerca de ti
        </h1>
        <p style={{ fontSize: 12.5, color: "var(--tinta-tenue)", marginTop: 2 }}>
          {farmaciasCercanas.length > 0
            ? `${farmaciasCercanas.length} aliada(s) que tienen tu búsqueda`
            : "Aliadas verificadas en Acarigua/Araure"}
        </p>

        {/* Placeholder de mapa (handoff): superficie visual, no un mapa real. */}
        <div
          aria-hidden="true"
          style={{
            position: "relative",
            height: 196,
            marginTop: 16,
            borderRadius: 18,
            border: "1px solid var(--borde)",
            overflow: "hidden",
            background:
              "repeating-linear-gradient(45deg,#f2f3ef,#f2f3ef 11px,#ecefe9 11px,#ecefe9 22px)",
          }}
        >
          <span style={{ position: "absolute", left: 64, top: 56, color: "var(--verde-cruz)" }}>
            <MapPin className="h-[30px] w-[30px]" strokeWidth={1.4} />
          </span>
          <span style={{ position: "absolute", right: 70, top: 96, color: "var(--verde-vivo)" }}>
            <MapPin className="h-[26px] w-[26px]" strokeWidth={1.4} />
          </span>
          <span
            className="dy-num"
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: "translate(-50%,-50%)",
              fontFamily: "ui-monospace,Menlo,monospace",
              fontSize: 11,
              color: "var(--tinta-tenue)",
              background: "rgba(250,250,247,0.82)",
              padding: "5px 9px",
              borderRadius: 7,
            }}
          >
            mapa · farmacias cercanas
          </span>
        </div>

        {farmaciasCercanas.length === 0 ? (
          <div
            style={{
              marginTop: 16,
              textAlign: "center",
              padding: "34px 20px",
              background: "var(--blanco)",
              border: "1px dashed var(--borde)",
              borderRadius: 16,
            }}
          >
            <span
              className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl"
              style={{ background: "var(--fondo-suave)", color: "var(--verde-cruz)" }}
            >
              <MapPin className="h-6 w-6" aria-hidden="true" />
            </span>
            <div style={{ fontSize: 14.5, fontWeight: 500, color: "var(--tinta)", marginTop: 12 }}>
              Busca un medicamento
            </div>
            <div
              style={{
                fontSize: 12.5,
                color: "var(--tinta-tenue)",
                marginTop: 3,
                lineHeight: 1.45,
              }}
            >
              Te mostramos las farmacias cercanas que lo tienen disponible.
            </div>
            <button
              type="button"
              onClick={() => setTab("buscar")}
              className="dy-foco"
              style={{
                marginTop: 16,
                height: 44,
                padding: "0 18px",
                background: "var(--verde-cruz)",
                color: "var(--papel)",
                border: 0,
                borderRadius: 12,
                fontSize: 14,
                fontWeight: 500,
              }}
            >
              Ir a buscar
            </button>
          </div>
        ) : (
          <ul
            style={{
              marginTop: 16,
              listStyle: "none",
              padding: 0,
              background: "var(--blanco)",
              border: "1px solid var(--borde)",
              borderRadius: 16,
              overflow: "hidden",
            }}
          >
            {farmaciasCercanas.map((f, i) => (
              <li
                key={f.id}
                className="flex items-center gap-3"
                style={{
                  padding: "13px 14px",
                  borderBottom: i < farmaciasCercanas.length - 1 ? "1px solid #eef0eb" : "none",
                }}
              >
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                  style={{ background: "var(--fondo-suave)", color: "var(--verde-cruz)" }}
                >
                  <MapPin className="h-[18px] w-[18px]" aria-hidden="true" />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{ fontSize: 14, fontWeight: 500, color: "var(--tinta)" }}
                    className="truncate"
                  >
                    {f.nombre}
                  </div>
                  <div
                    className="dy-num truncate"
                    style={{ fontSize: 12, color: "var(--tinta-tenue)", marginTop: 1 }}
                  >
                    {fmtKm(f.distancia_m)} · {f.count} resultado{f.count === 1 ? "" : "s"}
                  </div>
                </div>
                <ChevronRight
                  className="h-[18px] w-[18px] shrink-0"
                  style={{ color: "#c3c6c0" }}
                  aria-hidden="true"
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );

  const contenido =
    tab === "farmacias" ? vistaFarmacias : estado === "hero" ? vistaHero : vistaResultados;

  return (
    <>
      <AnimatePresence>
        {splashVisible && <SplashScreen onFinish={() => setSplashVisible(false)} />}
      </AnimatePresence>

      {contenido}

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

      <MenuMasPaciente
        open={masAbierto}
        onOpenChange={setMasAbierto}
        onAbrirChatIA={() => setChatIAAbierto(true)}
      />
      <HojaChatIA open={chatIAAbierto} onClose={() => setChatIAAbierto(false)} />
      <BurbujaAsistenteIA visible={!chatIAAbierto} onAbrir={() => setChatIAAbierto(true)} />
      <HojaLoginPaciente open={loginAbierto} onOpenChange={setLoginAbierto} />

      {/* Capa de vuelo (packFly): el paquete arquea del botón "+" al carrito */}
      <div className="pointer-events-none fixed inset-0 z-[60]" aria-hidden="true">
        {flyers.map((f) => (
          <motion.div
            key={f.id}
            initial={{ x: f.x0, y: f.y0, scale: 0.5, opacity: 0 }}
            animate={{
              x: [f.x0, f.x0, f.x0, f.xc, f.x1],
              y: [f.y0, f.y0, f.y0, f.yc, f.y1],
              scale: [0.5, 1.14, 0.96, 0.6, 0.16],
              opacity: [0, 1, 1, 1, 0.2],
            }}
            transition={{ duration: 0.7, ease: [0.4, 0, 0.2, 1], times: [0, 0.14, 0.26, 0.62, 1] }}
            style={{
              position: "fixed",
              left: 0,
              top: 0,
              width: 46,
              height: 46,
              marginLeft: -23,
              marginTop: -23,
              borderRadius: 14,
              background: "var(--verde-cruz)",
              color: "var(--papel)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 10px 22px -6px rgba(15,76,58,0.6)",
            }}
          >
            <Pill className="h-6 w-6" strokeWidth={1.8} />
          </motion.div>
        ))}
      </div>

      {/* Barra de navegación inferior (handoff) */}
      <div className="fixed inset-x-0 bottom-0 z-40">
        <div className="mx-auto max-w-md">
          <NavegacionPaciente
            activo={masAbierto ? "mas" : tab === "farmacias" ? "farmacias" : "buscar"}
            onSeleccionar={(id) => {
              if (id === "buscar") setTab("buscar");
              else if (id === "farmacias") setTab("farmacias");
              else if (id === "lista") setListaAbierta(true);
              else if (id === "mas") setMasAbierto(true);
            }}
            onEscanear={() => setEscanerAbierto(true)}
            listaCount={totalDistintos}
          />
        </div>
      </div>
    </>
  );
}

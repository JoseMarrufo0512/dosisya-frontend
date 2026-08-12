import { useEffect, useMemo, useRef, useState, FormEvent } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useGeolocalizacion } from "./hooks/useGeolocalizacion";
import { useBuscarMedicamentos } from "./hooks/useBuscarMedicamentos";
import { useDebounce } from "./hooks/useDebounce";
import { useBackDismiss, useHayOverlayAbierto } from "./hooks/useBackDismiss";
import { useTasa } from "./hooks/useTasa";
import { useBusquedasRecientes, useRecordatorios } from "./hooks/useLocalStorage";
import { useListaMedica } from "./hooks/useListaMedica";
import { HeroBusqueda } from "./components/HeroBusqueda";
import { SplashScreen } from "./components/SplashScreen";
import { CartSummary } from "./components/lista/CartSummary";
import { ListaMedicaDrawer } from "./components/lista/ListaMedicaDrawer";
import { EscanerRecipe } from "./components/EscanerRecipe";
import { ComparadorBar } from "./components/ComparadorBar";
import { ComparadorPanel } from "./components/ComparadorPanel";
import NavegacionPaciente, { type TabPaciente } from "@/components/navegacion/NavegacionPaciente";
import { MenuMasPaciente } from "@/components/paciente/MenuMasPaciente";
import { HojaLoginPaciente } from "@/components/paciente/HojaLoginPaciente";
import { HojaChatIA } from "@/components/paciente/HojaChatIA";
import { BurbujaAsistenteIA } from "@/components/paciente/BurbujaAsistenteIA";
import { Pill } from "lucide-react";
import { VistaFarmacias } from "./components/vistas/VistaFarmacias";
import { VistaResultados } from "./components/vistas/VistaResultados";
import {
  type Filtros,
  FILTROS_INICIALES,
  alternarComparacion,
  aplicarFiltros,
  claveMasEconomico,
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

  // Leer estado inicial de la URL (MED-7)
  const urlInit = typeof window !== "undefined" ? new URL(window.location.href) : null;
  const qInit = urlInit?.searchParams.get("q") || "";
  const ordInit = (urlInit?.searchParams.get("orden") as "relevancia" | "precio") || "relevancia";

  // Los recordatorios dependen de la fecha actual → solo evaluarlos tras montar
  // en el cliente, para no romper la hidratación SSR.
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);
  const resurtidosVencidos = montado ? recordatorios.vencidos() : [];

  const [estado, setEstado] = useState<"hero" | "resultados">(qInit ? "resultados" : "hero");
  const [query, setQuery] = useState(qInit);
  // Búsqueda mientras se escribe: query "retrasado" ~350ms (ver useEffect abajo).
  const queryDebounced = useDebounce(query, 350);
  const [conDelivery, setConDelivery] = useState(false);
  const [radio, setRadio] = useState(5000);
  const [terminoBuscado, setTerminoBuscado] = useState(qInit);
  const [listaAbierta, setListaAbierta] = useState(false);
  const [escanerAbierto, setEscanerAbierto] = useState(false);
  // Orden de resultados. "relevancia" = orden del backend (proximidad + boost
  // premium; NO tocar por defecto, es parte de la monetización). "precio" =
  // orden ascendente por precio_usd, solo del lado del cliente y opt-in.
  const [orden, setOrden] = useState<"relevancia" | "precio">(ordInit);
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
  // La burbuja se esconde con CUALQUIER hoja abierta, no solo con el chat.
  const hayOverlayAbierto = useHayOverlayAbierto();

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

  // Efecto inicial para buscar si venimos de un link con ?q=... (MED-7)
  useEffect(() => {
    if (qInit) {
      void api.buscar(qInit, latEfectiva, lngEfectiva, false, 5000);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sincronizar estado a URL (MED-7)
  useEffect(() => {
    if (!montado || typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (estado === "resultados" && terminoBuscado) {
      url.searchParams.set("q", terminoBuscado);
      if (orden !== "relevancia") url.searchParams.set("orden", orden);
      else url.searchParams.delete("orden");
    } else {
      url.searchParams.delete("q");
      url.searchParams.delete("orden");
    }
    window.history.replaceState({}, "", url.toString());
  }, [estado, terminoBuscado, orden, montado]);

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

  return (
    <>
      <AnimatePresence>
        {splashVisible && <SplashScreen onFinish={() => setSplashVisible(false)} />}
      </AnimatePresence>

      {tab === "farmacias" ? (
        <VistaFarmacias resultados={api.resultados} onSetTab={setTab} />
      ) : estado === "hero" ? (
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
      ) : (
        <VistaResultados
          query={query}
          setQuery={setQuery}
          handleSubmit={handleSubmit}
          setEstado={setEstado}
          terminoBuscado={terminoBuscado}
          setTerminoBuscado={setTerminoBuscado}
          cargando={api.cargando}
          totalResultados={api.totalResultados}
          resultados={api.resultados}
          resultadosOrdenados={resultadosOrdenados}
          resultadosVisibles={resultadosVisibles}
          filtrosAbiertos={filtrosAbiertos}
          setFiltrosAbiertos={setFiltrosAbiertos}
          orden={orden}
          setOrden={setOrden}
          filtros={filtros}
          setFiltros={setFiltros}
          radio={radio}
          totalDistintos={totalDistintos}
          recordatoriosActivo={recordatorios.estaActivo(terminoBuscado)}
          onEliminarRecordatorio={recordatorios.eliminar}
          onAgregarRecordatorio={recordatorios.agregar}
          claveEconomico={claveEconomico}
          compararClaves={compararClaves}
          MAX_COMPARAR={MAX_COMPARAR}
          volarAlCarrito={volarAlCarrito}
          toggleComparar={toggleComparar}
          alLimpiarBusqueda={alLimpiarBusqueda}
          montado={montado}
        />
      )}

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
      <BurbujaAsistenteIA visible={!hayOverlayAbierto} onAbrir={() => setChatIAAbierto(true)} />
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

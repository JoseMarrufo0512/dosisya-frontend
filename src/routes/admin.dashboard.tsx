import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Pill,
  LogOut,
  Home,
  Package,
  Settings,
  LifeBuoy,
  Menu,
  X,
  MessageCircle,
  MapPin,
  Search,
  TrendingUp,
  Boxes,
  AlertTriangle,
  RefreshCw,
  ScanLine,
  Receipt,
  Clock,
} from "lucide-react";
import { UploadInventory } from "@/components/UploadInventory";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { API_BASE } from "@/lib/api";

export const Route = createFileRoute("/admin/dashboard")({
  head: () => ({
    meta: [
      { title: "Panel — DosisYa B2B" },
      {
        name: "description",
        content: "Panel de control de tu farmacia en DosisYa.",
      },
    ],
  }),
  component: AdminDashboard,
});

type SectionId = "inicio" | "inventario" | "facturacion" | "configuracion" | "soporte";

type LeadReciente = {
  lead_id: string;
  fecha_hora: string;
  tipo_interaccion: string;
  medicamento_buscado_id?: string | null;
  medicamento_nombre?: string | null;
  medicamento_marca?: string | null;
};

type DashboardData = {
  nombre_farmacia?: string;
  pacientes_interesados_hoy?: number;
  busquedas_zona?: number | null;
  busquedas_zona_disponible?: boolean;
  total_inventario?: number;
  leads_recipe_mes_actual?: number;
  total_leads_mes_actual?: number;
  deuda_estimada_usd?: number;
  tarifa_por_lead_usd?: number;
  leads_recientes?: LeadReciente[];
  whatsapp?: string;
  sector?: string;
  punto_referencia?: string;
  inventario?: Array<{
    id?: string;
    nombre: string;
    presentacion?: string;
    stock?: number;
    precio_usd?: number;
  }>;
};

function AdminDashboard() {
  const navigate = useNavigate();
  const [section, setSection] = useState<SectionId>("inicio");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [inventoryCount, setInventoryCount] = useState<number | null>(null);

  const cargarDashboard = useCallback(async () => {
    const farmaciaId =
      typeof window !== "undefined" ? localStorage.getItem("farmacia_id") : null;
    if (!farmaciaId) {
      navigate({ to: "/admin/login" });
      return;
    }
    setLoading(true);
    setError(false);
    try {
      const token =
        typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
      const res = await fetch(
        `${API_BASE}/api/v1/farmacias/${farmaciaId}/dashboard`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        },
      );
      // 401/403 → sesión inválida, redirigir al login
      if (res.status === 401 || res.status === 403) {
        navigate({ to: "/admin/login" });
        return;
      }
      if (!res.ok) {
        // 500/otros → error real; no fabricar datos ni mostrar vacío silencioso
        setError(true);
        return;
      }
      const json = await res.json();
      setData(json?.data ?? json ?? {});
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    cargarDashboard();
  }, [cargarDashboard]);

  const logout = () => {
    localStorage.removeItem("farmacia_id");
    localStorage.removeItem("auth_token");
    navigate({ to: "/admin/login" });
  };

  const nombre =
    data?.nombre_farmacia ??
    (typeof window !== "undefined" ? localStorage.getItem("nombre_farmacia") : null) ??
    "tu farmacia";

  const nav: { id: SectionId; label: string; icon: React.ReactNode }[] = [
    { id: "inicio", label: "Inicio", icon: <Home className="h-4 w-4" /> },
    { id: "inventario", label: "Mi Inventario", icon: <Package className="h-4 w-4" /> },
    { id: "facturacion", label: "Facturación", icon: <Receipt className="h-4 w-4" /> },
    { id: "configuracion", label: "Configuración", icon: <Settings className="h-4 w-4" /> },
    { id: "soporte", label: "Soporte", icon: <LifeBuoy className="h-4 w-4" /> },
  ];

  return (
    <div className="min-h-screen bg-[#f6f8fb] flex">
      {/* Sidebar — desktop */}
      <aside className="hidden md:flex w-64 bg-white border-r border-border flex-col sticky top-0 h-screen">
        <SidebarContent nav={nav} section={section} setSection={setSection} logout={logout} />
      </aside>

      {/* Sidebar — mobile drawer */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSidebarOpen(false)}
              className="fixed inset-0 bg-black/40 z-40 md:hidden"
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              className="fixed left-0 top-0 bottom-0 w-64 bg-white z-50 md:hidden flex flex-col"
            >
              <SidebarContent
                nav={nav}
                section={section}
                setSection={(s) => {
                  setSection(s);
                  setSidebarOpen(false);
                }}
                logout={logout}
                onClose={() => setSidebarOpen(false)}
              />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <header className="md:hidden sticky top-0 z-30 bg-white border-b border-border h-14 flex items-center justify-between px-4">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 -ml-2 rounded-lg hover:bg-muted"
            aria-label="Abrir menú"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <Pill className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-bold">DosisYa</span>
          </div>
          <div className="w-9" />
        </header>

        <main className="flex-1 px-4 sm:px-6 lg:px-10 py-6 sm:py-8 max-w-6xl w-full mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={section}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              {section === "inicio" && (
                <InicioSection
                  nombre={nombre}
                  loading={loading}
                  error={error}
                  onRetry={cargarDashboard}
                  data={data}
                  inventoryCount={inventoryCount}
                />
              )}
              {section === "inventario" && (
                <InventarioSection
                  loading={loading}
                  data={data}
                  onUploaded={(count) => {
                    setInventoryCount(count);
                    setData((prev) => prev ? { ...prev, total_inventario: count } : prev);
                  }}
                />
              )}
              {section === "facturacion" && (
                <FacturacionSection loading={loading} data={data} />
              )}
              {section === "configuracion" && <ConfiguracionSection nombre={nombre} />}
              {section === "soporte" && <SoporteSection />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

function SidebarContent({
  nav,
  section,
  setSection,
  logout,
  onClose,
}: {
  nav: { id: SectionId; label: string; icon: React.ReactNode }[];
  section: SectionId;
  setSection: (s: SectionId) => void;
  logout: () => void;
  onClose?: () => void;
}) {
  return (
    <>
      <div className="h-16 flex items-center justify-between px-5 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center">
            <Pill className="h-4 w-4 text-primary-foreground" />
          </div>
          <div>
            <div className="text-sm font-bold leading-none">DosisYa</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mt-1">
              B2B Panel
            </div>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} className="p-1 rounded-md hover:bg-muted" aria-label="Cerrar">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {nav.map((item) => {
          const active = section === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setSection(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-foreground/70 hover:bg-muted hover:text-foreground"
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="p-3 border-t border-border">
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Cerrar sesión
        </button>
      </div>
    </>
  );
}

function InicioSection({
  nombre,
  loading,
  error,
  onRetry,
  data,
  inventoryCount,
}: {
  nombre: string;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  data: DashboardData | null;
  inventoryCount: number | null;
}) {
  const totalInv = inventoryCount ?? data?.inventario?.length ?? 0;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
          Hola, {nombre} <span className="inline-block">👋</span>
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Este es el resumen de tu farmacia hoy en DosisYa.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          aria-live="polite"
          className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-4"
        >
          <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" aria-hidden="true" />
          <p className="text-sm text-red-800 flex-1">
            No pudimos cargar tus métricas. Revisa tu conexión e inténtalo de nuevo.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            disabled={loading}
            className="border-red-300 text-red-800 hover:bg-red-100 self-start sm:self-auto"
          >
            <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
            {loading ? "Reintentando…" : "Reintentar"}
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Pacientes interesados hoy"
          value={loading ? null : (data?.pacientes_interesados_hoy?.toString() ?? "—")}
          hint="Clics a tu WhatsApp"
          icon={<MessageCircle className="h-5 w-5" />}
          accent="bg-[#25d366]/10 text-[#0f7c3a]"
        />
        <MetricCard
          label="Búsquedas cerca de ti"
          value={
            loading
              ? null
              : data?.busquedas_zona_disponible === false
                ? "Pronto"
                : (data?.busquedas_zona?.toString() ?? "—")
          }
          hint={
            data?.busquedas_zona_disponible === false
              ? "Métrica en camino"
              : "Personas buscando medicinas en tu zona"
          }
          icon={<Search className="h-5 w-5" />}
          accent="bg-primary/10 text-primary"
        />
        <MetricCard
          label="Total en Inventario"
          value={loading && inventoryCount === null ? null : totalInv.toString()}
          hint="Medicamentos cargados en tu farmacia"
          icon={<Boxes className="h-5 w-5" />}
          accent="bg-secondary/20 text-[#0a2463]"
        />
        <MetricCard
          label="Pedidos con récipe este mes"
          value={loading ? null : (data?.leads_recipe_mes_actual?.toString() ?? "—")}
          hint="Leads que llegaron con récipe digitalizado"
          icon={<ScanLine className="h-5 w-5" />}
          accent="bg-emerald-100 text-emerald-700"
        />
      </div>

      <div className="bg-card border border-border rounded-2xl p-5 sm:p-6 shadow-[0_4px_20px_-12px_rgba(10,36,99,0.15)]">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-secondary/20 text-[#0a2463] flex items-center justify-center shrink-0">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-bold text-foreground">Tu farmacia está activa</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Mantén tu inventario al día para aparecer en más búsquedas y recibir
              más pacientes interesados.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function InventarioSection({
  loading,
  data,
  onUploaded,
}: {
  loading: boolean;
  data: DashboardData | null;
  onUploaded: (count: number) => void;
}) {
  const items = data?.inventario ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Mi Inventario</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Sube tu archivo y nuestra IA lo normaliza automáticamente.
        </p>
      </div>

      <UploadInventory
        onUploaded={(res) => {
          // Claves reales que devuelve el backend (ver farmacias.py upload).
          const r = res as {
            medicamentos_procesados?: number;
            medicamentos_gemini?: number;
            detalle?: unknown[];
          } | null;
          const count =
            r?.medicamentos_procesados ??
            r?.medicamentos_gemini ??
            (Array.isArray(r?.detalle) ? r!.detalle!.length : 0);
          onUploaded(count);
        }}
      />


      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-[0_4px_20px_-12px_rgba(10,36,99,0.15)]">
        {loading ? (
          <div className="p-6 space-y-3">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center">
            <Package className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              Aún no tienes inventario cargado. Sube tu Excel para empezar.
            </p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden sm:block">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="px-6">Medicamento</TableHead>
                    <TableHead>Presentación</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                    <TableHead className="text-right pr-6">Precio (USD)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((it, i) => (
                    <TableRow key={it.id ?? i}>
                      <TableCell className="px-6 font-medium">{it.nombre}</TableCell>
                      <TableCell className="text-muted-foreground">{it.presentacion}</TableCell>
                      <TableCell className="text-right">{it.stock}</TableCell>
                      <TableCell className="text-right pr-6 font-medium">
                        ${(it.precio_usd ?? 0).toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile cards */}
            <ul className="sm:hidden divide-y divide-border">
              {items.map((it, i) => (
                <li key={it.id ?? i} className="p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{it.nombre}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {it.presentacion} · Stock {it.stock}
                    </div>
                  </div>
                  <div className="font-semibold text-primary shrink-0">
                    ${(it.precio_usd ?? 0).toFixed(2)}
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

function ConfiguracionSection({ nombre }: { nombre: string }) {
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Configuración</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Actualiza los datos de tu farmacia.
        </p>
      </div>

      <div className="bg-card border border-border rounded-2xl p-5 sm:p-6 space-y-4 shadow-[0_4px_20px_-12px_rgba(10,36,99,0.15)]">
        <Field label="Nombre de la farmacia" defaultValue={nombre} />
        <Field label="WhatsApp" defaultValue="+58 412 000 0000" />
        <Field label="Sector / Urbanización" defaultValue="Acarigua" />
        <Field label="Punto de referencia" defaultValue="Av. Principal" />
        <Button className="w-full sm:w-auto">Guardar cambios</Button>
      </div>
    </div>
  );
}

function SoporteSection() {
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Soporte</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Estamos aquí para ayudarte, escríbenos cuando lo necesites.
        </p>
      </div>

      <a
        href="https://wa.me/584120000000?text=Hola%20DosisYa%2C%20necesito%20ayuda%20con%20mi%20panel"
        target="_blank"
        rel="noopener noreferrer"
        className="block bg-card border border-border rounded-2xl p-5 sm:p-6 hover:border-primary/40 transition-colors shadow-[0_4px_20px_-12px_rgba(10,36,99,0.15)]"
      >
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-[#25d366]/10 text-[#0f7c3a] flex items-center justify-center">
            <MessageCircle className="h-6 w-6" />
          </div>
          <div>
            <div className="font-bold text-foreground">Escríbenos por WhatsApp</div>
            <div className="text-sm text-muted-foreground">Respuesta en menos de 1 hora</div>
          </div>
        </div>
      </a>

      <div className="bg-card border border-border rounded-2xl p-5 sm:p-6 shadow-[0_4px_20px_-12px_rgba(10,36,99,0.15)]">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <MapPin className="h-6 w-6" />
          </div>
          <div>
            <div className="font-bold text-foreground">Acarigua / Araure</div>
            <div className="text-sm text-muted-foreground">
              Oficina DosisYa · Lun a Vie · 8am - 5pm
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const ETIQUETA_INTERACCION: Record<string, string> = {
  clic_whatsapp: "Clic a WhatsApp",
  click_whatsapp: "Clic a WhatsApp",
  clic_llamar: "Llamada",
  ver_mapa: "Vio el mapa",
  abrir_mapa: "Vio el mapa",
  ver_detalle: "Vio el detalle",
  expandir_detalle: "Vio el detalle",
  compartir: "Compartió",
  capture_pantalla: "Captura de pantalla",
};

function etiquetaInteraccion(tipo: string): string {
  return ETIQUETA_INTERACCION[tipo] ?? tipo;
}

function formatoFechaLead(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-VE", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function FacturacionSection({
  loading,
  data,
}: {
  loading: boolean;
  data: DashboardData | null;
}) {
  const leadsMes = data?.total_leads_mes_actual ?? 0;
  const tarifa = data?.tarifa_por_lead_usd ?? 0;
  const deuda = data?.deuda_estimada_usd ?? 0;
  const leads = data?.leads_recientes ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Facturación</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Lo que has generado este mes en DosisYa.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard
          label="Leads este mes"
          value={loading ? null : leadsMes.toString()}
          hint="Interacciones facturables"
          icon={<TrendingUp className="h-5 w-5" />}
          accent="bg-primary/10 text-primary"
        />
        <MetricCard
          label="Tarifa por lead"
          value={loading ? null : `$${tarifa.toFixed(2)}`}
          hint="Costo por cada interacción"
          icon={<Receipt className="h-5 w-5" />}
          accent="bg-secondary/20 text-[#0a2463]"
        />
        <MetricCard
          label="Deuda estimada del mes"
          value={loading ? null : `$${deuda.toFixed(2)}`}
          hint="Total a facturar este mes"
          icon={<MessageCircle className="h-5 w-5" />}
          accent="bg-[#25d366]/10 text-[#0f7c3a]"
        />
      </div>

      <div>
        <h2 className="text-lg font-bold text-foreground mb-3">Leads recientes</h2>
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-[0_4px_20px_-12px_rgba(10,36,99,0.15)]">
          {loading ? (
            <div className="p-6 space-y-3">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : leads.length === 0 ? (
            <div className="p-12 text-center">
              <Clock className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                Aún no hay leads este período. Aparecerán aquí en cuanto lleguen.
              </p>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden sm:block">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead className="px-6">Fecha</TableHead>
                      <TableHead>Interacción</TableHead>
                      <TableHead>Medicamento</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leads.map((l) => (
                      <TableRow key={l.lead_id}>
                        <TableCell className="px-6 text-muted-foreground whitespace-nowrap">
                          {formatoFechaLead(l.fecha_hora)}
                        </TableCell>
                        <TableCell className="font-medium">
                          {etiquetaInteraccion(l.tipo_interaccion)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {l.medicamento_nombre
                            ? `${l.medicamento_nombre}${l.medicamento_marca ? ` · ${l.medicamento_marca}` : ""}`
                            : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile cards */}
              <ul className="sm:hidden divide-y divide-border">
                {leads.map((l) => (
                  <li key={l.lead_id} className="p-4">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium">
                        {etiquetaInteraccion(l.tipo_interaccion)}
                      </span>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatoFechaLead(l.fecha_hora)}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 truncate">
                      {l.medicamento_nombre
                        ? `${l.medicamento_nombre}${l.medicamento_marca ? ` · ${l.medicamento_marca}` : ""}`
                        : "Sin medicamento asociado"}
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  hint,
  icon,
  accent,
}: {
  label: string;
  value: string | null;
  hint: string;
  icon: React.ReactNode;
  accent: string;
}) {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-[0_4px_20px_-12px_rgba(10,36,99,0.15)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </div>
          {value === null ? (
            <Skeleton className="h-9 w-20 mt-2" />
          ) : (
            <div className="text-3xl sm:text-4xl font-bold text-foreground mt-1">{value}</div>
          )}
          <div className="text-xs text-muted-foreground mt-1">{hint}</div>
        </div>
        <div className={`h-11 w-11 rounded-xl flex items-center justify-center shrink-0 ${accent}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

function Field({ label, defaultValue }: { label: string; defaultValue?: string }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        {label}
      </label>
      <Input defaultValue={defaultValue} />
    </div>
  );
}

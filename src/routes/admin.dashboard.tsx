import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LogOut,
  Home,
  Package,
  Settings,
  LifeBuoy,
  Search,
  MessageCircle,
  MapPin,
  Boxes,
  AlertTriangle,
  RefreshCw,
  Receipt,
  Clock,
  Loader2,
  ScanLine,
} from "lucide-react";
import { UploadInventory } from "@/components/UploadInventory";
import { EscanerRecipeFarmacia } from "@/components/panel/EscanerRecipeFarmacia";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { z } from "zod";
import { toast } from "sonner";

import { API_BASE } from "@/lib/api";
import DashboardFarmacia from "@/components/panel/DashboardFarmacia";
import { mapearDashboard } from "@/lib/dashboardFarmacia";

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
  nivel_suscripcion?: string;
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
    marca_comercial?: string | null;
    presentacion?: string;
    /** El backend envía COALESCE(stock_disponible, false): es un booleano, no un conteo. */
    stock?: boolean;
    precio_usd?: number;
  }>;
};

function AdminDashboard() {
  const navigate = useNavigate();
  const [section, setSection] = useState<SectionId>("inicio");
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

  const [nombre, setNombre] = useState<string>(
    typeof window !== "undefined"
      ? localStorage.getItem("nombre_farmacia") ?? "tu farmacia"
      : "tu farmacia",
  );

  useEffect(() => {
    if (data?.nombre_farmacia) setNombre(data.nombre_farmacia);
  }, [data]);

  const nav: { id: SectionId; label: string; icon: React.ReactNode }[] = [
    { id: "inicio", label: "Inicio", icon: <Home className="h-4 w-4" /> },
    { id: "inventario", label: "Mi Inventario", icon: <Package className="h-4 w-4" /> },
    { id: "facturacion", label: "Facturación", icon: <Receipt className="h-4 w-4" /> },
    { id: "configuracion", label: "Configuración", icon: <Settings className="h-4 w-4" /> },
    { id: "soporte", label: "Soporte", icon: <LifeBuoy className="h-4 w-4" /> },
  ];

  const iniciales =
    nombre
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("") || "F";
  const { titulo, subtitulo } = TITULOS[section];

  return (
    <div
      className="dosisya-ui min-h-screen flex flex-col md:flex-row"
      style={{ background: "var(--dy-papel)" }}
    >
      {/* Sidebar — desktop (verde-cruz) */}
      <aside
        className="hidden md:flex w-[250px] flex-none flex-col sticky top-0 h-screen"
        style={{ background: "var(--dy-verde-cruz)", padding: "22px 16px" }}
      >
        <LogoNegocios />
        <div
          className="px-1.5 pb-4 text-[11.5px]"
          style={{ color: "rgba(255,255,255,0.5)" }}
        >
          Panel de tu farmacia
        </div>
        <nav className="flex flex-col gap-0.5">
          {nav.map((item) => (
            <SidebarItem
              key={item.id}
              item={item}
              active={section === item.id}
              onSelect={() => setSection(item.id)}
            />
          ))}
        </nav>
        <UsuarioCard iniciales={iniciales} nombre={nombre} logout={logout} />
      </aside>

      {/* Nav — móvil (verde-cruz, pills con scroll horizontal) */}
      <div
        className="md:hidden sticky top-0 z-30"
        style={{ background: "var(--dy-verde-cruz)", padding: "12px 12px" }}
      >
        <div className="flex items-center justify-between px-1 pb-3">
          <LogoNegocios compact />
          <div className="flex items-center gap-2">
            <div
              className="h-[30px] w-[30px] rounded-[9px] flex items-center justify-center text-[12px] font-bold"
              style={{ background: "var(--dy-verde-claro)", color: "var(--dy-verde-cruz)" }}
            >
              {iniciales}
            </div>
            <button
              onClick={logout}
              aria-label="Cerrar sesión"
              className="h-[30px] w-[30px] rounded-[9px] flex items-center justify-center"
              style={{ background: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.85)" }}
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
        <div className="flex gap-2 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {nav.map((item) => {
            const active = section === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setSection(item.id)}
                aria-current={active ? "page" : undefined}
                className="flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[12.5px] whitespace-nowrap flex-none transition-colors"
                style={{
                  background: active ? "#fff" : "rgba(255,255,255,0.1)",
                  color: active ? "var(--dy-verde-cruz)" : "rgba(255,255,255,0.85)",
                  fontWeight: active ? 600 : 500,
                }}
              >
                <span className="[&>svg]:h-4 [&>svg]:w-4">{item.icon}</span>
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar — desktop */}
        <div
          className="hidden md:flex items-center gap-4 flex-none"
          style={{ background: "#fff", borderBottom: "1px solid #eef0eb", padding: "15px 24px" }}
        >
          <div className="flex-1 min-w-0">
            <div
              className="text-[18px] font-bold"
              style={{ letterSpacing: "-0.02em", color: "var(--dy-tinta)" }}
            >
              {titulo}
            </div>
            <div className="text-[12.5px] mt-px" style={{ color: "var(--dy-tinta-tenue)" }}>
              {subtitulo}
            </div>
          </div>
        </div>

        <main className="flex-1 px-4 sm:px-6 lg:px-10 py-6 sm:py-8 max-w-6xl w-full mx-auto">
          {/* Título en móvil (sin topbar) */}
          <div className="md:hidden mb-5">
            <div className="text-[20px] font-bold" style={{ letterSpacing: "-0.02em", color: "var(--dy-tinta)" }}>
              {titulo}
            </div>
            <div className="text-[12.5px] mt-px" style={{ color: "var(--dy-tinta-tenue)" }}>
              {subtitulo}
            </div>
          </div>

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
              {section === "configuracion" && (
                <ConfiguracionSection data={data} onNombreActualizado={setNombre} />
              )}
              {section === "soporte" && <SoporteSection />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

// Título y subtítulo del topbar por sección.
const TITULOS: Record<SectionId, { titulo: string; subtitulo: string }> = {
  inicio: { titulo: "Resumen", subtitulo: "Tu actividad y leads del mes" },
  inventario: { titulo: "Inventario", subtitulo: "Gestiona tus medicamentos y precios" },
  facturacion: { titulo: "Facturación", subtitulo: "Tus leads y consumo del mes" },
  configuracion: { titulo: "Configuración", subtitulo: "Datos de tu farmacia" },
  soporte: { titulo: "Soporte", subtitulo: "Ayuda y preguntas frecuentes" },
};

function LogoNegocios({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`flex items-center gap-2.5 ${compact ? "" : "px-1.5 pb-1"}`}>
      <div
        className={`font-extrabold ${compact ? "text-[18px]" : "text-[21px]"}`}
        style={{ letterSpacing: "-0.03em", color: "#fff" }}
      >
        Dosis<span style={{ color: "var(--dy-verde-claro)" }}>Ya</span>
      </div>
      <span
        className="text-[10px] font-semibold rounded-md px-1.5 py-0.5"
        style={{ background: "var(--dy-verde-claro)", color: "var(--dy-verde-cruz)", letterSpacing: "0.02em" }}
      >
        NEGOCIOS
      </span>
    </div>
  );
}

function SidebarItem({
  item,
  active,
  onSelect,
}: {
  item: { id: SectionId; label: string; icon: React.ReactNode };
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      aria-current={active ? "page" : undefined}
      className="flex items-center gap-2.5 w-full rounded-[11px] px-3 py-2.5 text-left text-[13.5px] transition-colors"
      style={{
        background: active ? "rgba(255,255,255,0.12)" : "transparent",
        color: active ? "#fff" : "rgba(255,255,255,0.62)",
        fontWeight: active ? 600 : 500,
      }}
      onMouseEnter={(e) => {
        if (!active) e.currentTarget.style.background = "rgba(255,255,255,0.06)";
      }}
      onMouseLeave={(e) => {
        if (!active) e.currentTarget.style.background = "transparent";
      }}
    >
      <span className="flex-none [&>svg]:h-[19px] [&>svg]:w-[19px]">{item.icon}</span>
      <span className="flex-1">{item.label}</span>
    </button>
  );
}

function UsuarioCard({
  iniciales,
  nombre,
  logout,
}: {
  iniciales: string;
  nombre: string;
  logout: () => void;
}) {
  return (
    <div
      className="mt-auto flex items-center gap-2.5 rounded-[13px] p-2.5"
      style={{ background: "rgba(255,255,255,0.07)" }}
    >
      <div
        className="h-[34px] w-[34px] rounded-[10px] flex items-center justify-center text-[14px] font-bold flex-none"
        style={{ background: "var(--dy-verde-claro)", color: "var(--dy-verde-cruz)" }}
      >
        {iniciales}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[12.5px] font-semibold truncate" style={{ color: "#fff" }}>
          {nombre}
        </div>
        <div className="text-[11px]" style={{ color: "rgba(255,255,255,0.5)" }}>
          Panel B2B
        </div>
      </div>
      <button
        onClick={logout}
        aria-label="Cerrar sesión"
        className="h-8 w-8 rounded-[9px] flex items-center justify-center flex-none"
        style={{ background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.8)" }}
      >
        <LogOut className="h-[17px] w-[17px]" aria-hidden="true" />
      </button>
    </div>
  );
}

function InicioSection({
  loading,
  error,
  onRetry,
  data,
  inventoryCount,
}: {
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  data: DashboardData | null;
  inventoryCount: number | null;
}) {
  const totalInv = inventoryCount ?? data?.inventario?.length ?? 0;
  return (
    <div className="space-y-6">
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

      {/* Dashboard del handoff, alimentado por el fetch existente de esta ruta. */}
      {loading && !data ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" aria-busy="true">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
          <Skeleton className="h-72 rounded-2xl sm:col-span-2 lg:col-span-4" />
        </div>
      ) : data ? (
        <DashboardFarmacia {...mapearDashboard(data)} />
      ) : null}

      <div className="bg-card border border-border rounded-2xl p-5 sm:p-6 shadow-[0_4px_20px_-12px_rgba(22,24,26,0.12)]">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-secondary/20 text-[var(--verde-cruz)] flex items-center justify-center shrink-0">
            <Boxes className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-bold text-foreground">
              {totalInv > 0
                ? `${totalInv} ${totalInv === 1 ? "medicamento" : "medicamentos"} en tu inventario`
                : "Aún no has cargado inventario"}
            </h3>
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
  const [q, setQ] = useState("");
  const [escanerAbierto, setEscanerAbierto] = useState(false);
  const esPremium = data?.nivel_suscripcion === "premium";

  // Búsqueda client-side (sin backend): filtra por nombre o marca.
  const norm = (s: string) =>
    s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const filtro = norm(q.trim());
  const visibles = filtro
    ? items.filter(
        (it) =>
          norm(it.nombre ?? "").includes(filtro) ||
          norm(it.marca_comercial ?? "").includes(filtro),
      )
    : items;
  const disponibles = items.filter((it) => it.stock).length;

  const fmt = (n: number) => "$" + n.toFixed(2).replace(".", ",");

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={() => {
          if (!esPremium) {
            toast.info("Escanear récipes en el mostrador es una función del plan Premium.");
            return;
          }
          setEscanerAbierto(true);
        }}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-emerald-300 bg-emerald-50/50 px-4 py-3 text-sm font-semibold text-emerald-800 transition-colors hover:bg-emerald-50"
        style={!esPremium ? { opacity: 0.6 } : undefined}
        aria-disabled={!esPremium}
      >
        <ScanLine className="h-4 w-4" />
        Escanear récipe en mostrador
        {!esPremium && (
          <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
            Premium
          </span>
        )}
      </button>

      <EscanerRecipeFarmacia
        abierto={escanerAbierto}
        onOpenChange={setEscanerAbierto}
        inventario={items}
      />

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

      <div
        style={{
          background: "var(--dy-blanco)",
          border: "1px solid var(--dy-borde)",
          borderRadius: 16,
          overflow: "hidden",
        }}
      >
        {/* Buscador */}
        <div
          className="flex items-center gap-3 flex-wrap"
          style={{ padding: "14px 16px", borderBottom: "1px solid #eef0eb" }}
        >
          <div
            className="flex items-center gap-2 flex-1"
            style={{
              minWidth: 180,
              height: 38,
              padding: "0 12px",
              background: "#f7f8f5",
              border: "1px solid var(--dy-borde)",
              borderRadius: 10,
            }}
          >
            <Search className="h-4 w-4" style={{ color: "var(--dy-tinta-tenue)" }} aria-hidden="true" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar medicamento…"
              aria-label="Buscar medicamento en tu inventario"
              className="dy-foco flex-1 bg-transparent outline-none"
              style={{ fontSize: 13, color: "var(--dy-tinta)" }}
            />
          </div>
          <span style={{ fontSize: 12, color: "var(--dy-tinta-tenue)" }}>
            {items.length} en total · {disponibles} disponibles
          </span>
        </div>

        {loading ? (
          <div className="p-6 space-y-3">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center">
            <Package className="h-10 w-10 mx-auto mb-3" style={{ color: "var(--dy-tinta-tenue)", opacity: 0.5 }} />
            <p style={{ fontSize: 14, color: "var(--dy-tinta-suave)" }}>
              Aún no tienes inventario cargado. Sube tu Excel para empezar.
            </p>
          </div>
        ) : visibles.length === 0 ? (
          <div className="p-10 text-center" style={{ fontSize: 13, color: "var(--dy-tinta-tenue)" }}>
            Ningún medicamento coincide con «{q}».
          </div>
        ) : (
          <>
            {/* Tabla — desktop */}
            <div className="hidden sm:block" style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 520 }}>
                <thead>
                  <tr
                    style={{
                      textAlign: "left",
                      color: "var(--dy-tinta-tenue)",
                      fontSize: 11,
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                    }}
                  >
                    <th style={{ padding: "11px 16px", fontWeight: 600 }}>Medicamento</th>
                    <th style={{ padding: "11px 8px", fontWeight: 600, textAlign: "right" }}>Precio USD</th>
                    <th style={{ padding: "11px 16px", fontWeight: 600 }}>Disponibilidad</th>
                  </tr>
                </thead>
                <tbody style={{ fontSize: 13 }}>
                  {visibles.map((it, i) => (
                    <tr key={it.id ?? i} style={{ borderTop: "1px solid #f1f2ee" }}>
                      <td style={{ padding: "13px 16px" }}>
                        <div style={{ fontWeight: 600, color: "var(--dy-tinta)" }}>{it.nombre}</div>
                        {(it.presentacion || it.marca_comercial) && (
                          <div style={{ fontSize: 11.5, color: "var(--dy-tinta-tenue)", marginTop: 1 }}>
                            {[it.marca_comercial, it.presentacion].filter(Boolean).join(" · ")}
                          </div>
                        )}
                      </td>
                      <td
                        className="dy-num"
                        style={{ padding: "13px 8px", textAlign: "right", fontWeight: 600, color: "var(--dy-verde-cruz)" }}
                      >
                        {fmt(it.precio_usd ?? 0)}
                      </td>
                      <td style={{ padding: "13px 16px" }}>
                        <BadgeDisponibilidad disponible={Boolean(it.stock)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Tarjetas — móvil */}
            <ul className="sm:hidden" style={{ borderTop: "1px solid #f1f2ee" }}>
              {visibles.map((it, i) => (
                <li
                  key={it.id ?? i}
                  className="flex items-center justify-between gap-3"
                  style={{ padding: 14, borderBottom: "1px solid #f1f2ee" }}
                >
                  <div className="min-w-0">
                    <div style={{ fontWeight: 600, color: "var(--dy-tinta)" }} className="truncate">
                      {it.nombre}
                    </div>
                    <div style={{ fontSize: 11.5, color: "var(--dy-tinta-tenue)" }} className="truncate">
                      {[it.marca_comercial, it.presentacion].filter(Boolean).join(" · ")}
                    </div>
                    <div style={{ marginTop: 6 }}>
                      <BadgeDisponibilidad disponible={Boolean(it.stock)} />
                    </div>
                  </div>
                  <div className="dy-num shrink-0" style={{ fontWeight: 700, color: "var(--dy-verde-cruz)" }}>
                    {fmt(it.precio_usd ?? 0)}
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}

        {items.length > 0 && (
          <div style={{ padding: "12px 16px", borderTop: "1px solid #eef0eb", fontSize: 12, color: "var(--dy-tinta-tenue)" }}>
            Actualiza precios y disponibilidad volviendo a subir tu archivo.
          </div>
        )}
      </div>
    </div>
  );
}

function BadgeDisponibilidad({ disponible }: { disponible: boolean }) {
  const estilo = disponible
    ? { texto: "Disponible", color: "var(--dy-disp-text)", bg: "var(--dy-disp-bg)" }
    : { texto: "Agotado", color: "var(--dy-rojo)", bg: "var(--dy-rojo-bg)" };
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 600,
        color: estilo.color,
        background: estilo.bg,
        borderRadius: 999,
        padding: "3px 9px",
      }}
    >
      {estilo.texto}
    </span>
  );
}

const SECTORES_CONFIG: { value: string; label: string }[] = [
  { value: "acarigua", label: "Acarigua" },
  { value: "araure", label: "Araure" },
];

const configSchema = z.object({
  nombre_farmacia: z
    .string()
    .trim()
    .min(2, "Mínimo 2 caracteres")
    .max(200, "Máximo 200 caracteres"),
  whatsapp: z
    .string()
    .regex(/^\+58\d{10}$/, "Formato: +58 seguido de 10 dígitos"),
  sector: z.string().min(1, "Selecciona un sector"),
  punto_referencia: z
    .string()
    .trim()
    .min(5, "Describe brevemente (mín. 5 caracteres)")
    .max(180, "Máximo 180 caracteres"),
});

const formatoTelefonoVE = (raw: string) => {
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("58")) d = d.slice(2);
  if (d.startsWith("0")) d = d.slice(1);
  d = d.slice(0, 10);
  return d ? `+58${d}` : "";
};

function ConfiguracionSection({
  data,
  onNombreActualizado,
}: {
  data: DashboardData | null;
  onNombreActualizado: (nombre: string) => void;
}) {
  const [nombre, setNombre] = useState(data?.nombre_farmacia ?? "");
  const [whatsapp, setWhatsapp] = useState(data?.whatsapp ?? "");
  const [sector, setSector] = useState(data?.sector ?? "");
  const [referencia, setReferencia] = useState(data?.punto_referencia ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Precargar cuando llegue/cambie la data del dashboard.
  useEffect(() => {
    if (!data) return;
    setNombre(data.nombre_farmacia ?? "");
    setWhatsapp(data.whatsapp ?? "");
    setSector(data.sector ?? "");
    setReferencia(data.punto_referencia ?? "");
  }, [data]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const parsed = configSchema.safeParse({
      nombre_farmacia: nombre,
      whatsapp,
      sector,
      punto_referencia: referencia,
    });
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const k = issue.path[0] as string;
        if (k && !errs[k]) errs[k] = issue.message;
      }
      setFieldErrors(errs);
      return;
    }
    setFieldErrors({});

    const farmaciaId =
      typeof window !== "undefined" ? localStorage.getItem("farmacia_id") : null;
    const token =
      typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
    if (!farmaciaId) {
      setError("Sesión no encontrada. Inicia sesión de nuevo.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/farmacias/${farmaciaId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(parsed.data),
      });
      if (res.status === 401 || res.status === 403) {
        setError("Tu sesión expiró. Inicia sesión de nuevo.");
        return;
      }
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          json?.detail || json?.error?.message || "No se pudieron guardar los cambios",
        );
      }
      const nombreGuardado: string = json?.data?.nombre_farmacia ?? parsed.data.nombre_farmacia;
      if (typeof window !== "undefined") {
        localStorage.setItem("nombre_farmacia", nombreGuardado);
      }
      onNombreActualizado(nombreGuardado);
      toast.success("Datos actualizados con éxito");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <form
        onSubmit={onSubmit}
        className="p-5 sm:p-6 space-y-4"
        style={{ background: "var(--dy-blanco)", border: "1px solid var(--dy-borde)", borderRadius: 16 }}
        noValidate
      >
        <div className="space-y-1.5">
          <Label htmlFor="cfg-nombre">Nombre de la farmacia</Label>
          <Input
            id="cfg-nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            maxLength={200}
            aria-invalid={Boolean(fieldErrors.nombre_farmacia)}
          />
          {fieldErrors.nombre_farmacia && (
            <p className="text-xs text-destructive">{fieldErrors.nombre_farmacia}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="cfg-whatsapp">WhatsApp</Label>
          <Input
            id="cfg-whatsapp"
            value={whatsapp}
            onChange={(e) => setWhatsapp(formatoTelefonoVE(e.target.value))}
            placeholder="+584121234567"
            inputMode="tel"
            maxLength={13}
            aria-invalid={Boolean(fieldErrors.whatsapp)}
          />
          {fieldErrors.whatsapp && (
            <p className="text-xs text-destructive">{fieldErrors.whatsapp}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label>Sector / Ciudad</Label>
          <div className="grid grid-cols-2 gap-2">
            {SECTORES_CONFIG.map((s) => {
              const active = sector === s.value;
              return (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setSector(s.value)}
                  className="dy-foco h-11 rounded-[10px] border text-sm font-medium transition-colors inline-flex items-center justify-center gap-2"
                  style={{
                    background: active ? "var(--dy-verde-cruz)" : "var(--dy-blanco)",
                    color: active ? "#fff" : "var(--dy-tinta)",
                    borderColor: active ? "var(--dy-verde-cruz)" : "var(--dy-borde)",
                  }}
                >
                  <MapPin className="h-4 w-4" /> {s.label}
                </button>
              );
            })}
          </div>
          {fieldErrors.sector && (
            <p className="text-xs text-destructive">{fieldErrors.sector}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="cfg-ref">Punto de referencia</Label>
          <Input
            id="cfg-ref"
            value={referencia}
            onChange={(e) => setReferencia(e.target.value)}
            placeholder="Ej. A 2 cuadras de la plaza Bolívar"
            maxLength={180}
            aria-invalid={Boolean(fieldErrors.punto_referencia)}
          />
          {fieldErrors.punto_referencia && (
            <p className="text-xs text-destructive">{fieldErrors.punto_referencia}</p>
          )}
        </div>

        {error && (
          <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
            {error}
          </div>
        )}

        <Button
          type="submit"
          disabled={saving}
          className="w-full sm:w-auto"
          style={{ background: "var(--dy-verde-cruz)", color: "#fff" }}
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Guardando…
            </>
          ) : (
            "Guardar cambios"
          )}
        </Button>
      </form>
    </div>
  );
}

function SoporteSection() {
  const cardBase: React.CSSProperties = {
    background: "var(--dy-blanco)",
    border: "1px solid var(--dy-borde)",
    borderRadius: 16,
  };
  return (
    <div className="space-y-6 max-w-2xl">
      <a
        href="https://wa.me/584120000000?text=Hola%20DosisYa%2C%20necesito%20ayuda%20con%20mi%20panel"
        target="_blank"
        rel="noopener noreferrer"
        className="dy-foco block p-5 sm:p-6 transition-colors"
        style={cardBase}
      >
        <div className="flex items-center gap-4">
          <div
            className="h-12 w-12 rounded-xl flex items-center justify-center"
            style={{ background: "rgba(37,211,102,0.12)", color: "var(--dy-verde-vivo)" }}
          >
            <MessageCircle className="h-6 w-6" />
          </div>
          <div>
            <div style={{ fontWeight: 700, color: "var(--dy-tinta)" }}>Escríbenos por WhatsApp</div>
            <div style={{ fontSize: 14, color: "var(--dy-tinta-suave)" }}>Respuesta en menos de 1 hora</div>
          </div>
        </div>
      </a>

      <div className="p-5 sm:p-6" style={cardBase}>
        <div className="flex items-center gap-4">
          <div
            className="h-12 w-12 rounded-xl flex items-center justify-center"
            style={{ background: "rgba(15,76,58,0.08)", color: "var(--dy-verde-cruz)" }}
          >
            <MapPin className="h-6 w-6" />
          </div>
          <div>
            <div style={{ fontWeight: 700, color: "var(--dy-tinta)" }}>Acarigua / Araure</div>
            <div style={{ fontSize: 14, color: "var(--dy-tinta-suave)" }}>
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

// Tono del pill de interacción: verde = contacto real; ámbar = captura; neutral = navegación.
function tonoInteraccion(tipo: string): "verde" | "ambar" | "neutral" {
  if (tipo === "clic_whatsapp" || tipo === "click_whatsapp" || tipo === "clic_llamar") return "verde";
  if (tipo === "capture_pantalla") return "ambar";
  return "neutral";
}

const TONO_FACT: Record<"verde" | "ambar" | "neutral", { color: string; bg: string }> = {
  verde: { color: "var(--dy-disp-text)", bg: "var(--dy-disp-bg)" },
  ambar: { color: "var(--dy-ambar)", bg: "var(--dy-ambar-bg)" },
  neutral: { color: "var(--dy-tinta-tenue)", bg: "var(--dy-fondo-suave)" },
};

const factCard: React.CSSProperties = {
  background: "var(--dy-blanco)",
  border: "1px solid var(--dy-borde)",
  borderRadius: 16,
};

function FacturacionSection({
  loading,
  data,
}: {
  loading: boolean;
  data: DashboardData | null;
}) {
  const leadsMes = data?.total_leads_mes_actual ?? 0;
  const leadsRecipe = data?.leads_recipe_mes_actual ?? 0;
  const tarifa = data?.tarifa_por_lead_usd ?? 0;
  const deuda = data?.deuda_estimada_usd ?? 0;
  const leads = data?.leads_recientes ?? [];
  const fmt = (n: number) => "$" + n.toFixed(2).replace(".", ",");
  // Corte = último día del mes en curso (la facturación es post-pago al cierre).
  const corte = (() => {
    const hoy = new Date();
    const ultimoDia = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
    return ultimoDia.toLocaleDateString("es-VE", { day: "numeric", month: "short" });
  })();

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="flex flex-wrap gap-3.5">
        <KpiFact
          etiqueta="Leads este mes"
          valor={loading ? null : String(leadsMes)}
          nota={leadsRecipe > 0 ? `${leadsRecipe} con récipe (premium)` : "Interacciones facturables"}
        />
        <KpiFact etiqueta="Tarifa por lead" valor={loading ? null : fmt(tarifa)} nota="Costo por interacción" verde />
        {/* Deuda destacada (verde-cruz) */}
        <div style={{ background: "var(--dy-verde-cruz)", borderRadius: 16, padding: 18, color: "#fff", flex: "1 1 200px" }}>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)" }}>Deuda estimada del mes</div>
          {loading ? (
            <Skeleton className="h-8 w-24 mt-2" />
          ) : (
            <div className="dy-num" style={{ fontSize: 30, fontWeight: 700, marginTop: 6, letterSpacing: "-0.02em" }}>
              {fmt(deuda)}
            </div>
          )}
          <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.6)", marginTop: 4 }}>
            Se factura al corte · {corte}
          </div>
        </div>
      </div>

      {/* Leads recientes */}
      <section style={{ ...factCard, overflow: "hidden" }}>
        <header
          className="flex items-center justify-between"
          style={{ padding: "14px 16px", borderBottom: "1px solid #eef0eb" }}
        >
          <span style={{ fontSize: 13.5, fontWeight: 600 }}>Leads recientes</span>
          <span style={{ fontSize: 12, color: "var(--dy-tinta-tenue)" }}>
            {leads.length > 0 && leads.length < leadsMes
              ? `Muestra · ${leads.length} de ${leadsMes} este mes`
              : "Detalle de interacciones"}
          </span>
        </header>

        {loading ? (
          <div className="p-6 space-y-3">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : leads.length === 0 ? (
          <div className="p-12 text-center">
            <Clock className="h-10 w-10 mx-auto mb-3" style={{ color: "var(--dy-tinta-tenue)", opacity: 0.5 }} />
            <p style={{ fontSize: 14, color: "var(--dy-tinta-suave)" }}>
              Aún no hay leads este período. Aparecerán aquí en cuanto lleguen.
            </p>
          </div>
        ) : (
          <>
            {/* Tabla — desktop */}
            <div className="hidden sm:block" style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 520 }}>
                <thead>
                  <tr
                    style={{
                      textAlign: "left",
                      color: "var(--dy-tinta-tenue)",
                      fontSize: 11,
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                    }}
                  >
                    <th style={{ padding: "11px 16px", fontWeight: 600 }}>Fecha</th>
                    <th style={{ padding: "11px 8px", fontWeight: 600 }}>Interacción</th>
                    <th style={{ padding: "11px 8px", fontWeight: 600 }}>Medicamento</th>
                    <th style={{ padding: "11px 16px", fontWeight: 600, textAlign: "right" }}>Costo</th>
                  </tr>
                </thead>
                <tbody style={{ fontSize: 13 }}>
                  {leads.map((l) => {
                    const t = TONO_FACT[tonoInteraccion(l.tipo_interaccion)];
                    return (
                      <tr key={l.lead_id} style={{ borderTop: "1px solid #f1f2ee" }}>
                        <td className="dy-num" style={{ padding: "12px 16px", color: "var(--dy-tinta-suave)", whiteSpace: "nowrap" }}>
                          {formatoFechaLead(l.fecha_hora)}
                        </td>
                        <td style={{ padding: "12px 8px" }}>
                          <span style={{ fontSize: 11, fontWeight: 600, color: t.color, background: t.bg, borderRadius: 999, padding: "3px 9px" }}>
                            {etiquetaInteraccion(l.tipo_interaccion)}
                          </span>
                        </td>
                        <td style={{ padding: "12px 8px", color: "var(--dy-tinta)", fontWeight: 500 }}>
                          {l.medicamento_nombre
                            ? `${l.medicamento_nombre}${l.medicamento_marca ? ` · ${l.medicamento_marca}` : ""}`
                            : "—"}
                        </td>
                        <td className="dy-num" style={{ padding: "12px 16px", textAlign: "right", color: "var(--dy-verde-cruz)", fontWeight: 600 }}>
                          {fmt(tarifa)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Tarjetas — móvil */}
            <ul className="sm:hidden">
              {leads.map((l) => {
                const t = TONO_FACT[tonoInteraccion(l.tipo_interaccion)];
                return (
                  <li key={l.lead_id} style={{ padding: 14, borderTop: "1px solid #f1f2ee" }}>
                    <div className="flex items-center justify-between gap-3">
                      <span style={{ fontSize: 11, fontWeight: 600, color: t.color, background: t.bg, borderRadius: 999, padding: "3px 9px" }}>
                        {etiquetaInteraccion(l.tipo_interaccion)}
                      </span>
                      <span className="dy-num" style={{ fontSize: 12, color: "var(--dy-tinta-tenue)", whiteSpace: "nowrap" }}>
                        {formatoFechaLead(l.fecha_hora)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3" style={{ marginTop: 6 }}>
                      <span className="truncate" style={{ fontSize: 12.5, color: "var(--dy-tinta)" }}>
                        {l.medicamento_nombre
                          ? `${l.medicamento_nombre}${l.medicamento_marca ? ` · ${l.medicamento_marca}` : ""}`
                          : "Sin medicamento asociado"}
                      </span>
                      <span className="dy-num shrink-0" style={{ fontSize: 12.5, fontWeight: 600, color: "var(--dy-verde-cruz)" }}>
                        {fmt(tarifa)}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>

      {/* Historial de facturas — meses ya cerrados por el súper admin.
          "Leads recientes" arriba solo cubre el mes en curso; una vez que
          DosisYa cierra el mes, el detalle vive acá para poder auditarlo. */}
      <HistorialFacturas />
    </div>
  );
}

type Factura = {
  id: string;
  periodo_inicio: string;
  periodo_fin: string;
  leads_facturables: number;
  tarifa_aplicada_usd: number;
  total_usd: number;
  estado: "pendiente" | "pagada";
  fecha_pago: string | null;
};

function formatoPeriodo(periodoInicio: string): string {
  const d = new Date(periodoInicio + "T00:00:00");
  if (Number.isNaN(d.getTime())) return periodoInicio;
  const s = d.toLocaleDateString("es-VE", { month: "long", year: "numeric" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Historial de facturas ya cerradas (tabla `facturas`, snapshot congelado).
 * Cada factura se puede expandir para ver el detalle itemizado de leads del
 * periodo — la evidencia que necesita la farmacia si disputa un cobro.
 */
function HistorialFacturas() {
  const [facturas, setFacturas] = useState<Factura[] | null>(null);
  const [error, setError] = useState(false);
  const [abierta, setAbierta] = useState<string | null>(null);
  const [leadsPorFactura, setLeadsPorFactura] = useState<
    Record<string, LeadReciente[] | "cargando" | "error">
  >({});

  useEffect(() => {
    const farmaciaId =
      typeof window !== "undefined" ? localStorage.getItem("farmacia_id") : null;
    const token =
      typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
    if (!farmaciaId) return;
    let cancelado = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/v1/farmacias/${farmaciaId}/facturas`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) {
          if (!cancelado) setError(true);
          return;
        }
        const json = await res.json();
        if (!cancelado) setFacturas(json?.data?.facturas ?? []);
      } catch {
        if (!cancelado) setError(true);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, []);

  const alternar = async (f: Factura) => {
    const nueva = abierta === f.id ? null : f.id;
    setAbierta(nueva);
    if (!nueva || leadsPorFactura[f.id]) return;

    setLeadsPorFactura((prev) => ({ ...prev, [f.id]: "cargando" }));
    const farmaciaId =
      typeof window !== "undefined" ? localStorage.getItem("farmacia_id") : null;
    const token =
      typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
    try {
      const params = new URLSearchParams({
        periodo_inicio: f.periodo_inicio,
        periodo_fin: f.periodo_fin,
      });
      const res = await fetch(
        `${API_BASE}/api/v1/farmacias/${farmaciaId}/leads?${params}`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} },
      );
      if (!res.ok) throw new Error("leads fetch failed");
      const json = await res.json();
      setLeadsPorFactura((prev) => ({ ...prev, [f.id]: json?.data?.leads ?? [] }));
    } catch {
      setLeadsPorFactura((prev) => ({ ...prev, [f.id]: "error" }));
    }
  };

  const fmtUsd = (n: number) => "$" + n.toFixed(2).replace(".", ",");

  return (
    <section style={{ ...factCard, overflow: "hidden" }}>
      <header style={{ padding: "14px 16px", borderBottom: "1px solid #eef0eb" }}>
        <span style={{ fontSize: 13.5, fontWeight: 600 }}>Historial de facturas</span>
      </header>

      {facturas === null && !error && (
        <div className="p-6 space-y-3">
          {[...Array(2)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      )}

      {error && (
        <div className="p-8 text-center" style={{ fontSize: 13, color: "var(--dy-tinta-suave)" }}>
          No se pudo cargar el historial. Intenta de nuevo más tarde.
        </div>
      )}

      {facturas !== null && !error && facturas.length === 0 && (
        <div className="p-12 text-center">
          <Receipt className="h-10 w-10 mx-auto mb-3" style={{ color: "var(--dy-tinta-tenue)", opacity: 0.5 }} />
          <p style={{ fontSize: 14, color: "var(--dy-tinta-suave)" }}>
            Todavía no hay meses cerrados. En cuanto DosisYa cierre el corte mensual,
            tus facturas aparecerán acá.
          </p>
        </div>
      )}

      {facturas !== null && !error && facturas.length > 0 && (
        <ul>
          {facturas.map((f) => {
            const detalle = leadsPorFactura[f.id];
            const estaAbierta = abierta === f.id;
            const t = TONO_FACT[f.estado === "pagada" ? "verde" : "ambar"];
            return (
              <li key={f.id} style={{ borderTop: "1px solid #f1f2ee" }}>
                <button
                  onClick={() => alternar(f)}
                  className="w-full flex items-center justify-between gap-3"
                  style={{ padding: "14px 16px", textAlign: "left" }}
                >
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--dy-tinta)" }}>
                      {formatoPeriodo(f.periodo_inicio)}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--dy-tinta-tenue)", marginTop: 2 }}>
                      {f.leads_facturables} leads · {fmtUsd(f.total_usd)}
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: t.color,
                      background: t.bg,
                      borderRadius: 999,
                      padding: "3px 9px",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {f.estado === "pagada" ? "Pagada" : "Pendiente"}
                  </span>
                </button>

                {estaAbierta && (
                  <div style={{ padding: "0 16px 14px" }}>
                    {detalle === "cargando" && (
                      <div className="space-y-2">
                        {[...Array(3)].map((_, i) => (
                          <Skeleton key={i} className="h-8 w-full" />
                        ))}
                      </div>
                    )}
                    {detalle === "error" && (
                      <p style={{ fontSize: 12.5, color: "var(--dy-tinta-suave)" }}>
                        No se pudo cargar el detalle.
                      </p>
                    )}
                    {Array.isArray(detalle) &&
                      (detalle.length === 0 ? (
                        <p style={{ fontSize: 12.5, color: "var(--dy-tinta-suave)" }}>
                          Sin leads registrados en este periodo.
                        </p>
                      ) : (
                        <ul style={{ border: "1px solid #eef0eb", borderRadius: 10, overflow: "hidden" }}>
                          {detalle.map((l) => {
                            const t2 = TONO_FACT[tonoInteraccion(l.tipo_interaccion)];
                            return (
                              <li
                                key={l.lead_id}
                                className="flex items-center justify-between gap-3"
                                style={{
                                  padding: "8px 12px",
                                  borderTop: "1px solid #f1f2ee",
                                  fontSize: 12.5,
                                }}
                              >
                                <span style={{ color: "var(--dy-tinta-tenue)", whiteSpace: "nowrap" }}>
                                  {formatoFechaLead(l.fecha_hora)}
                                </span>
                                <span
                                  style={{
                                    fontSize: 10.5,
                                    fontWeight: 600,
                                    color: t2.color,
                                    background: t2.bg,
                                    borderRadius: 999,
                                    padding: "2px 7px",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {etiquetaInteraccion(l.tipo_interaccion)}
                                </span>
                                <span className="truncate flex-1" style={{ color: "var(--dy-tinta)" }}>
                                  {l.medicamento_nombre ?? "—"}
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function KpiFact({ etiqueta, valor, nota, verde }: { etiqueta: string; valor: string | null; nota: string; verde?: boolean }) {
  return (
    <div style={{ ...factCard, flex: "1 1 200px", padding: 16 }}>
      <div style={{ fontSize: 12, color: "var(--dy-tinta-tenue)" }}>{etiqueta}</div>
      {valor === null ? (
        <Skeleton className="h-8 w-20 mt-2" />
      ) : (
        <div
          className="dy-num"
          style={{ fontSize: 28, fontWeight: 700, color: verde ? "var(--dy-verde-cruz)" : "var(--dy-tinta)", marginTop: 6, letterSpacing: "-0.02em" }}
        >
          {valor}
        </div>
      )}
      <div style={{ fontSize: 11.5, color: "var(--dy-tinta-tenue)", marginTop: 4 }}>{nota}</div>
    </div>
  );
}

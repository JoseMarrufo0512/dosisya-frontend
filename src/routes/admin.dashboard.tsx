import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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

const API_BASE =
  import.meta.env.VITE_API_URL || "https://proyecto-dosis-ya.vercel.app";

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

type SectionId = "inicio" | "inventario" | "configuracion" | "soporte";

type DashboardData = {
  nombre_farmacia?: string;
  pacientes_interesados_hoy?: number;
  busquedas_zona?: number;
  total_inventario?: number;
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
  const [inventoryCount, setInventoryCount] = useState<number | null>(null);

  useEffect(() => {
    const farmaciaId =
      typeof window !== "undefined" ? localStorage.getItem("farmacia_id") : null;
    if (!farmaciaId) {
      navigate({ to: "/admin/login" });
      return;
    }
    (async () => {
      try {
        const res = await fetch(
          `${API_BASE}/api/v1/farmacias/${farmaciaId}/dashboard`,
        );
        const json = await res.json();
        setData(json?.data ?? json ?? {});
      } catch {
        setData({});
      } finally {
        setLoading(false);
      }
    })();
  }, [navigate]);

  const logout = () => {
    localStorage.removeItem("farmacia_id");
    localStorage.removeItem("auth_token");
    navigate({ to: "/admin/login" });
  };

  const nombre = data?.nombre_farmacia ?? "Farmacia San Rafael";

  const nav: { id: SectionId; label: string; icon: React.ReactNode }[] = [
    { id: "inicio", label: "Inicio", icon: <Home className="h-4 w-4" /> },
    { id: "inventario", label: "Mi Inventario", icon: <Package className="h-4 w-4" /> },
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
  data,
  inventoryCount,
}: {
  nombre: string;
  loading: boolean;
  data: DashboardData | null;
  inventoryCount: number | null;
}) {
  const totalInv = inventoryCount ?? data?.total_inventario ?? 0;
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <MetricCard
          label="Pacientes interesados hoy"
          value={loading ? null : (data?.pacientes_interesados_hoy ?? 14).toString()}
          hint="Clics a tu WhatsApp"
          icon={<MessageCircle className="h-5 w-5" />}
          accent="bg-[#25d366]/10 text-[#0f7c3a]"
        />
        <MetricCard
          label="Búsquedas cerca de ti"
          value={loading ? null : (data?.busquedas_zona ?? 120).toString()}
          hint="Personas buscando medicinas en tu zona"
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
}: {
  loading: boolean;
  data: DashboardData | null;
}) {
  const handleUploadExcel = () => {
    alert("Próximamente: sube tu Excel y nuestra IA lo normaliza automáticamente.");
  };

  const items = data?.inventario ?? [
    { nombre: "Acetaminofén 500mg", presentacion: "Tabletas x 10", stock: 45, precio_usd: 1.2 },
    { nombre: "Ibuprofeno 400mg", presentacion: "Tabletas x 20", stock: 30, precio_usd: 2.5 },
    { nombre: "Amoxicilina 500mg", presentacion: "Cápsulas x 21", stock: 12, precio_usd: 4.8 },
    { nombre: "Loratadina 10mg", presentacion: "Tabletas x 10", stock: 28, precio_usd: 1.8 },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Mi Inventario</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gestiona los medicamentos disponibles en tu farmacia.
          </p>
        </div>
        <Button
          onClick={handleUploadExcel}
          size="lg"
          className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20"
        >
          <Upload className="h-4 w-4 mr-2" />
          Subir Inventario (Excel)
          <Sparkles className="h-3.5 w-3.5 ml-2 opacity-80" />
        </Button>
      </div>

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

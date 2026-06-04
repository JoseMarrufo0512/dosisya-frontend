import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Pill, LogOut, Users, Banknote, TrendingUp, Download, MessageCircle, MapPin, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const API_BASE = import.meta.env.VITE_API_URL || "https://proyecto-dosis-ya.vercel.app";

export const Route = createFileRoute("/admin/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — DosisYa B2B" },
      { name: "description", content: "Resumen de leads, ingresos potenciales y métricas de tu farmacia." },
    ],
  }),
  component: AdminDashboard,
});

type Lead = {
  id?: string;
  fecha: string;
  medicamento_buscado: string;
  tipo_interaccion: string;
};

type DashboardData = {
  leads_mes?: number;
  ingresos_potenciales?: number;
  costo_publicidad?: number;
  leads_recientes?: Lead[];
};

function AdminDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const farmaciaId = typeof window !== "undefined" ? localStorage.getItem("farmacia_id") : null;
    if (!farmaciaId) {
      navigate({ to: "/admin/login" });
      return;
    }
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/v1/farmacias/${farmaciaId}/dashboard`);
        const json = await res.json();
        if (!res.ok) throw new Error("Error al cargar dashboard");
        setData(json?.data ?? json);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error desconocido");
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

  return (
    <div className="min-h-screen bg-[#f5f7fb]">
      {/* Header */}
      <header className="bg-white border-b border-border sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center">
              <Pill className="h-4 w-4 text-primary-foreground" />
            </div>
            <div>
              <div className="text-base font-bold text-foreground leading-none">DosisYa</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">B2B Panel</div>
            </div>
          </div>
          <Button onClick={logout} variant="ghost" className="text-muted-foreground hover:text-foreground">
            <LogOut className="h-4 w-4 mr-2" /> Cerrar sesión
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Resumen mensual</h1>
          <p className="text-sm text-muted-foreground mt-1">Métricas e interacciones de tu farmacia en DosisYa.</p>
        </div>

        {/* KPI cards */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <KpiCard
            label="Leads Recibidos este Mes"
            value={loading ? null : (data?.leads_mes ?? 0).toString()}
            icon={<Users className="h-5 w-5" />}
            accent="bg-primary/10 text-primary"
          />
          <KpiCard
            label="Ingresos Potenciales"
            value={loading ? null : `$${(data?.ingresos_potenciales ?? 0).toLocaleString("es-VE", { minimumFractionDigits: 2 })}`}
            icon={<Banknote className="h-5 w-5" />}
            accent="bg-secondary/20 text-[#0a2463]"
          />
          <KpiCard
            label="Costo de Publicidad"
            value={loading ? null : `$${(data?.costo_publicidad ?? 0).toLocaleString("es-VE", { minimumFractionDigits: 2 })}`}
            icon={<TrendingUp className="h-5 w-5" />}
            accent="bg-[#f5c542]/20 text-[#7a5a00]"
          />
        </section>

        {/* Leads table */}
        <section className="bg-card border border-border rounded-2xl shadow-[0_8px_32px_-20px_rgba(10,36,99,0.18)] overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <div>
              <h2 className="text-lg font-bold text-foreground">Leads Recientes</h2>
              <p className="text-xs text-muted-foreground">Interacciones de usuarios con tu farmacia.</p>
            </div>
            <Button
              onClick={() => alert("Exportando...")}
              variant="outline"
              className="border-primary/30 text-primary hover:bg-primary/5"
            >
              <Download className="h-4 w-4 mr-2" /> Exportar Reporte CSV
            </Button>
          </div>

          {loading ? (
            <div className="p-6 space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="p-8 text-center text-sm text-destructive">{error}</div>
          ) : !data?.leads_recientes || data.leads_recientes.length === 0 ? (
            <div className="p-12 text-center text-sm text-muted-foreground">
              Aún no hay leads registrados este mes.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="px-6">Fecha</TableHead>
                  <TableHead>Medicamento Buscado</TableHead>
                  <TableHead>Acción Realizada</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.leads_recientes.map((lead, i) => (
                  <TableRow key={lead.id ?? i}>
                    <TableCell className="px-6 text-muted-foreground whitespace-nowrap">
                      {formatDate(lead.fecha)}
                    </TableCell>
                    <TableCell className="font-medium text-foreground">{lead.medicamento_buscado}</TableCell>
                    <TableCell>
                      <InteractionBadge tipo={lead.tipo_interaccion} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </section>
      </main>
    </div>
  );
}

function KpiCard({ label, value, icon, accent }: { label: string; value: string | null; icon: React.ReactNode; accent: string }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 shadow-[0_4px_20px_-12px_rgba(10,36,99,0.15)]">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
          {value === null ? (
            <Skeleton className="h-8 w-28 mt-2" />
          ) : (
            <div className="text-3xl font-bold text-foreground">{value}</div>
          )}
        </div>
        <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${accent}`}>{icon}</div>
      </div>
    </div>
  );
}

function InteractionBadge({ tipo }: { tipo: string }) {
  const map: Record<string, { label: string; icon: React.ReactNode; cls: string }> = {
    clic_whatsapp: { label: "Clic en WhatsApp", icon: <MessageCircle className="h-3.5 w-3.5" />, cls: "bg-[#25d366]/10 text-[#0f7c3a]" },
    ver_mapa: { label: "Vista en Mapa", icon: <MapPin className="h-3.5 w-3.5" />, cls: "bg-primary/10 text-primary" },
    ver_detalle: { label: "Vista de Detalle", icon: <Eye className="h-3.5 w-3.5" />, cls: "bg-secondary/20 text-[#0a2463]" },
  };
  const item = map[tipo] ?? { label: tipo, icon: <Eye className="h-3.5 w-3.5" />, cls: "bg-muted text-muted-foreground" };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${item.cls}`}>
      {item.icon} {item.label}
    </span>
  );
}

function formatDate(raw: string) {
  try {
    const d = new Date(raw);
    if (isNaN(d.getTime())) return raw;
    return d.toLocaleDateString("es-VE", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  } catch {
    return raw;
  }
}

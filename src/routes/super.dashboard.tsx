import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Building2, Receipt, LogOut, Loader2 } from "lucide-react";
import { getFarmaciasAdmin } from "@/lib/adminApi";
import { getSuperToken, esSuperadmin, cerrarSesionSuper } from "@/lib/adminAuth";
import { TablaFarmacias } from "@/components/super/TablaFarmacias";
import { TablaFacturacion } from "@/components/super/TablaFacturacion";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/super/dashboard")({
  head: () => ({ meta: [{ title: "Súper Admin — DosisYa" }] }),
  component: SuperDashboard,
});

type Seccion = "farmacias" | "facturacion";

function SuperDashboard() {
  const navigate = useNavigate();
  const [seccion, setSeccion] = useState<Seccion>("farmacias");
  const [ready, setReady] = useState(false);

  // Guard: sin sesión superadmin → login.
  useEffect(() => {
    if (!esSuperadmin()) {
      navigate({ to: "/super/login" });
      return;
    }
    setReady(true);
  }, [navigate]);

  const token = getSuperToken() ?? "";
  const query = useQuery({
    queryKey: ["admin-farmacias"],
    queryFn: () => getFarmaciasAdmin(token),
    enabled: ready && Boolean(token),
  });

  // 401/403 → cerrar sesión.
  useEffect(() => {
    if (query.error instanceof Error && query.error.message === "UNAUTHORIZED") {
      cerrarSesionSuper();
      navigate({ to: "/super/login" });
    }
  }, [query.error, navigate]);

  if (!ready) return null;

  const logout = () => {
    cerrarSesionSuper();
    navigate({ to: "/super/login" });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="font-bold">DosisYa · Súper Admin</div>
          <Button variant="ghost" size="sm" onClick={logout}>
            <LogOut className="h-4 w-4 mr-1" /> Salir
          </Button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6">
        <nav className="flex gap-2 mb-6">
          <TabBtn active={seccion === "farmacias"} onClick={() => setSeccion("farmacias")}
            icon={<Building2 className="h-4 w-4" />} label="Farmacias" />
          <TabBtn active={seccion === "facturacion"} onClick={() => setSeccion("facturacion")}
            icon={<Receipt className="h-4 w-4" />} label="Facturación" />
        </nav>

        {query.isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : query.isError ? (
          <div className="text-sm text-destructive">
            No pudimos cargar los datos. <button className="underline" onClick={() => query.refetch()}>Reintentar</button>
          </div>
        ) : query.data ? (
          seccion === "farmacias" ? (
            <TablaFarmacias data={query.data} token={token} onReload={() => query.refetch()} />
          ) : (
            <TablaFacturacion data={query.data} />
          )
        ) : null}
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, icon, label }: {
  active: boolean; onClick: () => void; icon: React.ReactNode; label: string;
}) {
  return (
    <button onClick={onClick}
      className={`inline-flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-medium transition-colors ${
        active ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-accent"
      }`}>
      {icon} {label}
    </button>
  );
}

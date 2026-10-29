import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Building2, Receipt, LogOut, Loader2, HelpCircle } from "lucide-react";
import { getFarmaciasAdmin } from "@/lib/adminApi";
import { esSuperadmin, cerrarSesionSuper } from "@/lib/adminAuth";
import { TablaFarmacias } from "@/components/super/TablaFarmacias";
import { TablaFacturacion } from "@/components/super/TablaFacturacion";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TourGuiado } from "@/components/tour/TourGuiado";
import { pasosSuper } from "@/components/tour/pasos";
import { useTourGuiado } from "@/hooks/useTourGuiado";

export const Route = createFileRoute("/super/dashboard")({
  head: () => ({ meta: [{ title: "Súper Admin — DosisYa" }] }),
  component: SuperDashboard,
});

type Seccion = "farmacias" | "facturacion";

function SuperDashboard() {
  const navigate = useNavigate();
  const [seccion, setSeccion] = useState<Seccion>("farmacias");
  const [ready, setReady] = useState(false);

  // Tour guiado. Arranca solo tras validar la sesión (ready): antes el panel
  // devuelve null y los anclajes no existen. `pasos` memoizado.
  const tour = useTourGuiado("super", { autoIniciar: ready });
  const pasosTour = useMemo(() => pasosSuper((s) => setSeccion(s)), []);

  // Guard: sin sesión superadmin → login.
  useEffect(() => {
    if (!esSuperadmin()) {
      navigate({ to: "/super/login" });
      return;
    }
    setReady(true);
  }, [navigate]);

  const query = useQuery({
    queryKey: ["admin-farmacias"],
    queryFn: () => getFarmaciasAdmin(),
    enabled: ready,
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
    <div className="dosisya-ui min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="font-bold">DosisYa · Súper Admin</div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={tour.iniciar}>
              <HelpCircle className="h-4 w-4 mr-1" /> Guía
            </Button>
            <Button variant="ghost" size="sm" onClick={logout} data-tour="nav-salir">
              <LogOut className="h-4 w-4 mr-1" /> Salir
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6">
        <nav className="flex gap-2 mb-6">
          <TabBtn
            active={seccion === "farmacias"}
            onClick={() => setSeccion("farmacias")}
            icon={<Building2 className="h-4 w-4" />}
            label="Farmacias"
            dataTour="nav-farmacias"
          />
          <TabBtn
            active={seccion === "facturacion"}
            onClick={() => setSeccion("facturacion")}
            icon={<Receipt className="h-4 w-4" />}
            label="Facturación"
            dataTour="nav-facturacion"
          />
        </nav>

        {/* Orden: error → datos → cargando. El último es el caso "todo lo demás"
            a propósito, porque el `null` que había dejaba la pantalla en blanco.

            Antes se preguntaba primero por `isLoading`, que en React Query v5 es
            `isPending && isFetching`: solo cubre la PRIMERA carga. Si el
            superadmin pulsaba Reintentar y volvía a fallar, quedaban ventanas
            sin isLoading, sin isError y sin data, y el panel se vaciaba debajo
            de las pestañas — sin forma de reintentar otra vez. */}
        {query.isError ? (
          <div className="text-sm text-destructive">
            No pudimos cargar los datos.{" "}
            <button className="underline" onClick={() => query.refetch()}>
              Reintentar
            </button>
          </div>
        ) : query.data ? (
          seccion === "farmacias" ? (
            <TablaFarmacias data={query.data} onReload={() => query.refetch()} />
          ) : (
            <TablaFacturacion data={query.data} />
          )
        ) : (
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        )}
      </div>

      {/* Tour guiado de onboarding (superadmin) */}
      <TourGuiado pasos={pasosTour} activo={tour.activo} onCerrar={tour.cerrar} />
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  icon,
  label,
  dataTour,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  dataTour?: string;
}) {
  return (
    <button
      onClick={onClick}
      data-tour={dataTour}
      className={`inline-flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-medium transition-colors ${
        active ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-accent"
      }`}
    >
      {icon} {label}
    </button>
  );
}

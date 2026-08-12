import { MapPin, ChevronRight } from "lucide-react";
import type { ResultadoFarmacia } from "@/lib/api";
import { useMemo } from "react";
import type { TabPaciente } from "@/components/navegacion/NavegacionPaciente";

interface VistaFarmaciasProps {
  resultados: ResultadoFarmacia[];
  onSetTab: (tab: TabPaciente) => void;
}

export function VistaFarmacias({ resultados, onSetTab }: VistaFarmaciasProps) {
  // Farmacias cercanas derivadas de los resultados actuales (únicas por id).
  const farmaciasCercanas = useMemo(() => {
    const map = new Map<
      string,
      { id: string; nombre: string; direccion: string; distancia_m: number; count: number }
    >();
    for (const r of resultados) {
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
  }, [resultados]);

  const fmtKm = (m: number) => (m / 1000).toFixed(1).replace(".", ",") + " km";

  return (
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
              onClick={() => onSetTab("buscar")}
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
}

/*
 * DashboardFarmacia — pantalla "Resumen" del panel B2B (rol Farmacia).
 *
 * Recreación del handoff (docs/design_handoff_dosisya/PanelFarmacia.dc.html)
 * ADAPTADA al contrato real del backend. Presentacional y tipado: recibe datos
 * ya mapeados (ver src/lib/dashboardFarmacia.ts). Los defaults son de muestra
 * para previsualizar el diseño de forma aislada.
 *
 * Diferencias con el mock del handoff, por fidelidad al backend:
 *  - Los KPIs son data-driven (array), no fijos.
 *  - La tabla de leads muestra el TIPO de interacción real (no un "estado"
 *    inventado) y omite la distancia (el backend no la envía por lead).
 *  - La tarjeta lateral refleja la deuda post-pago, no un saldo prepago.
 *  - La gráfica "por día" es opcional; se oculta si no hay serie diaria.
 */

import { motion, useReducedMotion } from "framer-motion";

export type TonoInteraccion = "verde" | "ambar" | "neutral";

export interface KpiItem {
  etiqueta: string;
  valor: string;
  nota?: string;
  /** Variación destacada (ej. "12% vs. mes anterior"); pinta el ícono ▲. */
  delta?: string;
  /** Colorea la cifra en verde-cruz (para métricas financieras). */
  valorVerde?: boolean;
}

export interface LeadFila {
  hora: string;
  medicamento: string;
  interaccion: { texto: string; tono: TonoInteraccion };
  costo: string;
}

export interface BarraDia {
  dia: string;
  /** 0–1: proporción de la altura máxima. */
  valor: number;
  pico?: boolean;
}

export interface TarjetaResumen {
  titulo: string;
  monto: string;
  nota: string;
  accion?: { label: string; onClick?: () => void };
}

export interface DashboardFarmaciaProps {
  kpis?: KpiItem[];
  leads?: LeadFila[];
  resumen?: TarjetaResumen;
  /** Serie diaria opcional. Si es undefined, la tarjeta no se muestra. */
  barras?: BarraDia[];
  /** Texto del encabezado de la tabla ("Últimas 24 h", etc.). */
  leadsSubtitulo?: string;
}

const KPIS_MOCK: KpiItem[] = [
  { etiqueta: "Leads este mes", valor: "128", delta: "12% vs. mes anterior" },
  { etiqueta: "Costo por lead", valor: "$0,35", nota: "por clic a WhatsApp", valorVerde: true },
  { etiqueta: "Inversión del mes", valor: "$44,80", nota: "128 leads facturados" },
  { etiqueta: "Pacientes hoy", valor: "9", nota: "clics a WhatsApp hoy" },
];

const LEADS_MOCK: LeadFila[] = [
  { hora: "10:24", medicamento: "Losartán 50 mg", interaccion: { texto: "WhatsApp", tono: "verde" }, costo: "$0,35" },
  { hora: "09:58", medicamento: "Amoxicilina 500 mg", interaccion: { texto: "Vio detalle", tono: "neutral" }, costo: "$0,35" },
  { hora: "09:12", medicamento: "Metformina 850 mg", interaccion: { texto: "WhatsApp", tono: "verde" }, costo: "$0,35" },
  { hora: "08:40", medicamento: "Atorvastatina 20 mg", interaccion: { texto: "Vio el mapa", tono: "neutral" }, costo: "$0,35" },
  { hora: "08:03", medicamento: "Ibuprofeno 400 mg", interaccion: { texto: "Llamada", tono: "verde" }, costo: "$0,35" },
];

const RESUMEN_MOCK: TarjetaResumen = {
  titulo: "Deuda estimada del mes",
  monto: "$44,80",
  nota: "Se acumula por cada clic a WhatsApp · Corte 31 jul",
  accion: { label: "Ver facturación" },
};

const TONO_INTERACCION: Record<TonoInteraccion, { color: string; bg: string }> = {
  verde: { color: "var(--dy-disp-text)", bg: "var(--dy-disp-bg)" },
  ambar: { color: "var(--dy-ambar)", bg: "var(--dy-ambar-bg)" },
  neutral: { color: "var(--dy-tinta-tenue)", bg: "var(--dy-fondo-suave)" },
};

const tarjeta: React.CSSProperties = {
  background: "var(--dy-blanco)",
  border: "1px solid var(--dy-borde)",
  borderRadius: 16,
};

export default function DashboardFarmacia({
  kpis = KPIS_MOCK,
  leads = LEADS_MOCK,
  resumen = RESUMEN_MOCK,
  barras,
  leadsSubtitulo = "Últimas 24 h",
}: DashboardFarmaciaProps) {
  return (
    <div
      className="dosisya-ui"
      style={{ display: "flex", flexDirection: "column", gap: 16, background: "var(--dy-papel)" }}
    >
      {/* KPIs */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
        {kpis.map((k, i) => (
          <Kpi key={`${k.etiqueta}-${i}`} {...k} />
        ))}
      </div>

      {/* Tabla + columna derecha */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
        <section style={{ ...tarjeta, flex: "2 1 420px", overflow: "hidden" }}>
          <header
            style={{
              padding: "14px 16px",
              borderBottom: "1px solid #eef0eb",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span style={{ fontSize: 13.5, fontWeight: 600 }}>Leads recientes</span>
            <span style={{ fontSize: 12, color: "var(--dy-tinta-tenue)" }}>{leadsSubtitulo}</span>
          </header>
          {leads.length === 0 ? (
            <div style={{ padding: "34px 16px", textAlign: "center", color: "var(--dy-tinta-tenue)", fontSize: 13 }}>
              Aún no hay leads este periodo.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 460 }}>
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
                    <Th style={{ padding: "10px 16px" }}>Hora</Th>
                    <Th>Medicamento</Th>
                    <Th>Interacción</Th>
                    <Th style={{ padding: "10px 16px", textAlign: "right" }}>Costo</Th>
                  </tr>
                </thead>
                <tbody style={{ fontSize: 13 }}>
                  {leads.map((lead, i) => {
                    const t = TONO_INTERACCION[lead.interaccion.tono];
                    return (
                      <tr key={`${lead.hora}-${i}`} style={{ borderTop: "1px solid #f1f2ee" }}>
                        <td className="dy-num" style={{ padding: "12px 16px", color: "var(--dy-tinta-suave)" }}>
                          {lead.hora}
                        </td>
                        <td style={{ padding: "12px 8px", fontWeight: 500 }}>{lead.medicamento}</td>
                        <td style={{ padding: "12px 8px" }}>
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 600,
                              color: t.color,
                              background: t.bg,
                              borderRadius: 999,
                              padding: "3px 9px",
                            }}
                          >
                            {lead.interaccion.texto}
                          </span>
                        </td>
                        <td
                          className="dy-num"
                          style={{
                            padding: "12px 16px",
                            textAlign: "right",
                            color: "var(--dy-verde-cruz)",
                            fontWeight: 600,
                          }}
                        >
                          {lead.costo}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <div style={{ flex: "1 1 240px", display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Resumen financiero (deuda) */}
          <div style={{ background: "var(--dy-verde-cruz)", borderRadius: 16, padding: 18, color: "#fff" }}>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)" }}>{resumen.titulo}</div>
            <div className="dy-num" style={{ fontSize: 30, fontWeight: 700, marginTop: 6, letterSpacing: "-0.02em" }}>
              {resumen.monto}
            </div>
            <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.6)", marginTop: 4 }}>{resumen.nota}</div>
            {resumen.accion && (
              <button
                type="button"
                onClick={resumen.accion.onClick}
                className="dy-foco"
                style={{
                  width: "100%",
                  height: 40,
                  background: "var(--dy-verde-claro)",
                  color: "var(--dy-verde-cruz)",
                  border: 0,
                  borderRadius: 11,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                  marginTop: 14,
                }}
              >
                {resumen.accion.label}
              </button>
            )}
          </div>

          {/* Leads por día — solo si hay serie */}
          {barras && barras.length > 0 && (
            <div style={{ ...tarjeta, padding: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Leads por día</div>
              <GraficaBarras barras={barras} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Kpi({ etiqueta, valor, delta, nota, valorVerde }: KpiItem) {
  return (
    <div style={{ ...tarjeta, flex: "1 1 170px", padding: 16 }}>
      <div style={{ fontSize: 12, color: "var(--dy-tinta-tenue)" }}>{etiqueta}</div>
      <div
        className="dy-num"
        style={{
          fontSize: 28,
          fontWeight: 700,
          color: valorVerde ? "var(--dy-verde-cruz)" : "var(--dy-tinta)",
          marginTop: 6,
          letterSpacing: "-0.02em",
        }}
      >
        {valor}
      </div>
      {delta ? (
        <div
          style={{
            fontSize: 11.5,
            color: "var(--dy-disp-text)",
            fontWeight: 600,
            marginTop: 4,
          }}
        >
          <span aria-hidden="true">▲</span> {delta}
        </div>
      ) : (
        <div style={{ fontSize: 11.5, color: "var(--dy-tinta-tenue)", marginTop: 4 }}>{nota}</div>
      )}
    </div>
  );
}

function GraficaBarras({ barras }: { barras: BarraDia[] }) {
  const reduce = useReducedMotion();
  const ALTO = 96;
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: ALTO }}>
      {barras.map((b, i) => {
        const tono = b.pico ? "var(--dy-verde-vivo)" : b.valor >= 0.6 ? "#a9dcc6" : "#d6ede3";
        const alto = Math.round(b.valor * (ALTO - 18));
        return (
          <div
            key={`${b.dia}-${i}`}
            style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}
          >
            <motion.div
              initial={reduce ? false : { height: 0 }}
              animate={{ height: alto }}
              transition={{ duration: 0.5, delay: reduce ? 0 : i * 0.05, ease: [0.2, 0.7, 0.2, 1] }}
              style={{ width: "100%", background: tono, borderRadius: "6px 6px 0 0" }}
            />
            <span style={{ fontSize: 10, color: "var(--dy-tinta-tenue)" }}>{b.dia}</span>
          </div>
        );
      })}
    </div>
  );
}

function Th({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <th style={{ padding: "10px 8px", fontWeight: 600, ...style }}>{children}</th>;
}

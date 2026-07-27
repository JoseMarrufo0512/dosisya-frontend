/*
 * NavegacionPaciente — barra de navegación inferior de la app del paciente.
 *
 * Recreación fiel del handoff (docs/design_handoff_dosisya/NavegacionInferior.dc.html):
 *   Buscar · Farmacias · [FAB central: Escanear récipe] · Lista Médica · Más
 *
 * Micro-interacciones (framer-motion):
 *  - La pastilla del tab activo revela su etiqueta animando el ancho (0 → auto).
 *  - Los íconos rebotan al presionar (scale 0.84, spring con overshoot).
 *  - El ícono de Lista rebota (scale 1.3) cuando aumenta el contador.
 *  - El FAB se hunde al presionar (scale 0.9).
 * Respeta prefers-reduced-motion vía useReducedMotion.
 *
 * Componente controlado: el estado de tab, el contador y las acciones viven fuera.
 */

import { useEffect, useRef, useState } from "react";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type Transition,
} from "framer-motion";
import {
  Search,
  MapPin,
  ClipboardList,
  MoreHorizontal,
  ScanLine,
  type LucideIcon,
} from "lucide-react";

export type TabPaciente = "buscar" | "farmacias" | "lista" | "mas";

interface NavegacionPacienteProps {
  /** Destino activo. `mas` se marca activo mientras la hoja está abierta. */
  activo: TabPaciente;
  /** Selección de un destino de la barra. */
  onSeleccionar: (tab: TabPaciente) => void;
  /** Acción del FAB central (abrir escáner de récipe). */
  onEscanear: () => void;
  /** Nº de medicamentos en la Lista Médica (badge). 0 = sin badge. */
  listaCount?: number;
  /** Fija la etiqueta visible en todos los tabs, no solo en el activo. */
  etiquetasSiempre?: boolean;
}

// Curvas exactas del handoff.
const REBOTE: Transition = { duration: 0.34, ease: [0.34, 1.56, 0.64, 1] };
const PASTILLA: Transition = { duration: 0.4, ease: [0.4, 0, 0.2, 1] };

const TABS: {
  id: TabPaciente;
  etiqueta: string;
  icono: LucideIcon;
  ariaLabel: string;
}[] = [
  { id: "buscar", etiqueta: "Buscar", icono: Search, ariaLabel: "Buscar" },
  {
    id: "farmacias",
    etiqueta: "Farmacias",
    icono: MapPin,
    ariaLabel: "Farmacias",
  },
  {
    id: "lista",
    etiqueta: "Lista",
    icono: ClipboardList,
    ariaLabel: "Lista Médica",
  },
  { id: "mas", etiqueta: "Más", icono: MoreHorizontal, ariaLabel: "Más opciones" },
];

export default function NavegacionPaciente({
  activo,
  onSeleccionar,
  onEscanear,
  listaCount = 0,
  etiquetasSiempre = false,
}: NavegacionPacienteProps) {
  return (
    <nav
      aria-label="Navegación principal"
      className="dosisya-ui"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 2,
        padding: "9px 12px 14px",
        background: "var(--dy-blanco)",
        borderTop: "1px solid #ececE8",
        boxShadow: "0 -8px 28px -14px rgba(22,24,26,0.16)",
      }}
    >
      <TabBoton {...TABS[0]} activo={activo === "buscar"} onSel={onSeleccionar} siempre={etiquetasSiempre} />
      <TabBoton {...TABS[1]} activo={activo === "farmacias"} onSel={onSeleccionar} siempre={etiquetasSiempre} />

      <BotonEscanear onEscanear={onEscanear} />

      <TabBoton
        {...TABS[2]}
        activo={activo === "lista"}
        onSel={onSeleccionar}
        siempre={etiquetasSiempre}
        badge={listaCount}
      />
      <TabBoton {...TABS[3]} activo={activo === "mas"} onSel={onSeleccionar} siempre={etiquetasSiempre} />
    </nav>
  );
}

function TabBoton({
  id,
  etiqueta,
  ariaLabel,
  icono: Icono,
  activo,
  siempre,
  onSel,
  badge = 0,
}: {
  id: TabPaciente;
  etiqueta: string;
  ariaLabel: string;
  icono: LucideIcon;
  activo: boolean;
  siempre: boolean;
  onSel: (t: TabPaciente) => void;
  badge?: number;
}) {
  const reduce = useReducedMotion();
  const mostrarEtiqueta = activo || siempre;

  // Rebote del ícono de Lista cuando el contador sube.
  const [rebote, setRebote] = useState(false);
  const prev = useRef(badge);
  useEffect(() => {
    if (badge > prev.current) {
      setRebote(true);
      const t = setTimeout(() => setRebote(false), 220);
      prev.current = badge;
      return () => clearTimeout(t);
    }
    prev.current = badge;
  }, [badge]);

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      aria-current={activo ? "page" : undefined}
      onClick={() => onSel(id)}
      className="dy-foco-in"
      style={{
        flex: 1,
        height: 46,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "none",
        border: 0,
        padding: 0,
        borderRadius: 14,
        cursor: "pointer",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      <motion.span
        style={{
          display: "flex",
          alignItems: "center",
          height: 38,
          borderRadius: 999,
          overflow: "hidden",
        }}
        animate={{
          backgroundColor: activo ? "rgba(29,158,117,0.12)" : "rgba(29,158,117,0)",
        }}
        transition={PASTILLA}
      >
        <motion.span
          data-tab={id}
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 38,
            height: 38,
            flex: "none",
            color: activo ? "var(--dy-verde-cruz)" : "var(--dy-tinta-tenue)",
          }}
          animate={{ scale: rebote && !reduce ? 1.3 : 1 }}
          whileTap={reduce ? undefined : { scale: 0.84 }}
          transition={REBOTE}
        >
          <Icono size={22} strokeWidth={1.75} aria-hidden="true" />
          <AnimatePresence>
            {badge > 0 && (
              <motion.span
                key="badge"
                initial={reduce ? false : { scale: 0 }}
                animate={{ scale: 1 }}
                exit={reduce ? undefined : { scale: 0 }}
                transition={REBOTE}
                className="dy-num"
                style={{
                  position: "absolute",
                  top: 2,
                  right: 2,
                  minWidth: 16,
                  height: 16,
                  padding: "0 4px",
                  borderRadius: 999,
                  background: "var(--dy-verde-vivo)",
                  color: "#fff",
                  fontSize: 10,
                  fontWeight: 500,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: "1.5px solid #fff",
                }}
              >
                {badge}
              </motion.span>
            )}
          </AnimatePresence>
        </motion.span>

        <motion.span
          style={{ overflow: "hidden", whiteSpace: "nowrap" }}
          initial={false}
          animate={{ maxWidth: mostrarEtiqueta ? 96 : 0 }}
          transition={PASTILLA}
        >
          <span
            style={{
              display: "block",
              fontSize: 12.5,
              fontWeight: 500,
              letterSpacing: "-0.01em",
              color: activo ? "var(--dy-verde-cruz)" : "var(--dy-tinta-tenue)",
              paddingRight: 13,
            }}
          >
            {etiqueta}
          </span>
        </motion.span>
      </motion.span>
    </button>
  );
}

function BotonEscanear({ onEscanear }: { onEscanear: () => void }) {
  const reduce = useReducedMotion();
  return (
    <div
      style={{
        width: 66,
        flex: "none",
        position: "relative",
        display: "flex",
        justifyContent: "center",
      }}
    >
      <motion.button
        type="button"
        aria-label="Escanear récipe"
        onClick={onEscanear}
        className="dy-foco"
        whileTap={reduce ? undefined : { scale: 0.9 }}
        transition={REBOTE}
        style={{
          position: "absolute",
          bottom: 6,
          width: 58,
          height: 58,
          borderRadius: 19,
          background: "var(--dy-verde-cruz)",
          border: 0,
          boxShadow: "0 10px 22px -8px rgba(15,76,58,0.55)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--dy-papel)",
          cursor: "pointer",
          WebkitTapHighlightColor: "transparent",
        }}
      >
        <ScanLine size={26} strokeWidth={1.7} aria-hidden="true" />
      </motion.button>
    </div>
  );
}

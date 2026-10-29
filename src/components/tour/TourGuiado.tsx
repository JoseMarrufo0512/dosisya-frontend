/*
 * TourGuiado — motor de onboarding con "spotlight" (recorte iluminado).
 *
 * Ligero y sin dependencias nuevas: usa framer-motion (ya en el proyecto) para
 * la entrada de la tarjeta y una máscara SVG para oscurecer todo menos el
 * elemento resaltado. El SVG captura los clics, así que el recorrido es guiado:
 * el usuario avanza con los botones, no tocando la UI por detrás.
 *
 * - Anclaje por selector `[data-tour="..."]` (ver pasos.ts). Si el elemento no
 *   existe, muestra la tarjeta centrada sin foco en vez de romperse.
 * - Re-mide en resize/scroll y reposiciona la tarjeta arriba o abajo según el
 *   espacio disponible.
 * - Accesible: foco movido a la tarjeta, Esc cierra, ←/→ navegan, role="dialog".
 * - Respeta prefers-reduced-motion.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X, ArrowLeft, ArrowRight, Check } from "lucide-react";
import type { PasoTour } from "./pasos";

interface Recorte {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface TourGuiadoProps {
  pasos: PasoTour[];
  activo: boolean;
  onCerrar: () => void;
}

const CARD_MAX = 340;
const GUTTER = 16;

export function TourGuiado({ pasos, activo, onCerrar }: TourGuiadoProps) {
  const reduce = useReducedMotion();
  const [indice, setIndice] = useState(0);
  const [recorte, setRecorte] = useState<Recorte | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [cardH, setCardH] = useState(180);

  const paso = pasos[indice];
  const total = pasos.length;
  const esUltimo = indice === total - 1;

  // Reiniciar al abrir.
  useEffect(() => {
    if (activo) setIndice(0);
  }, [activo]);

  const cerrar = useCallback(() => onCerrar(), [onCerrar]);
  const siguiente = useCallback(() => {
    setIndice((i) => (i >= total - 1 ? i : i + 1));
    if (esUltimo) cerrar();
  }, [total, esUltimo, cerrar]);
  const atras = useCallback(() => setIndice((i) => Math.max(0, i - 1)), []);

  // Lee el rect del elemento del paso actual (sin provocar scroll).
  const leerRecorte = useCallback((): Recorte | null => {
    if (!paso?.selector) return null;
    const el = document.querySelector(paso.selector);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return null;
    return { top: r.top, left: r.left, width: r.width, height: r.height };
  }, [paso]);

  // Al entrar a un paso: dejar que `alEntrar` aplique cambios de vista, traer el
  // elemento a la pantalla y medirlo. Dos pasadas (timeout + rAF) absorben el
  // relayout que puede disparar `alEntrar`.
  useEffect(() => {
    if (!activo || !paso) return;
    paso.alEntrar?.();
    let raf = 0;
    const medir = () => {
      const el = paso.selector ? document.querySelector(paso.selector) : null;
      if (el) {
        el.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
      }
      raf = requestAnimationFrame(() => setRecorte(leerRecorte()));
    };
    const t = window.setTimeout(medir, 70);
    return () => {
      window.clearTimeout(t);
      cancelAnimationFrame(raf);
    };
  }, [activo, paso, reduce, leerRecorte]);

  // Re-medir en resize/scroll mientras el tour esté abierto.
  useEffect(() => {
    if (!activo) return;
    const remedir = () => setRecorte(leerRecorte());
    window.addEventListener("resize", remedir);
    window.addEventListener("scroll", remedir, true);
    return () => {
      window.removeEventListener("resize", remedir);
      window.removeEventListener("scroll", remedir, true);
    };
  }, [activo, leerRecorte]);

  // Teclado: Esc cierra, ←/→ navegan.
  useEffect(() => {
    if (!activo) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        cerrar();
      } else if (e.key === "ArrowRight" || e.key === "Enter") {
        e.preventDefault();
        siguiente();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        atras();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activo, cerrar, siguiente, atras]);

  // Mover el foco a la tarjeta en cada paso (accesibilidad).
  useLayoutEffect(() => {
    if (!activo) return;
    cardRef.current?.focus();
    if (cardRef.current) setCardH(cardRef.current.offsetHeight);
  }, [activo, indice]);

  if (!activo || !paso) return null;

  const pad = paso.padding ?? 8;
  const vw = typeof window !== "undefined" ? window.innerWidth : 360;
  const vh = typeof window !== "undefined" ? window.innerHeight : 640;
  const cardW = Math.min(CARD_MAX, vw - GUTTER * 2);

  // Posición de la tarjeta: debajo del elemento si hay espacio, si no, arriba;
  // sin elemento, centrada.
  let cardTop: number;
  let cardLeft: number;
  if (recorte) {
    const abajoY = recorte.top + recorte.height + pad + 14;
    const cabeAbajo = abajoY + cardH + GUTTER <= vh;
    cardTop = cabeAbajo ? abajoY : recorte.top - pad - 14 - cardH;
    cardTop = Math.max(GUTTER, Math.min(cardTop, vh - cardH - GUTTER));
    const centroX = recorte.left + recorte.width / 2 - cardW / 2;
    cardLeft = Math.max(GUTTER, Math.min(centroX, vw - cardW - GUTTER));
  } else {
    cardTop = vh / 2 - cardH / 2;
    cardLeft = vw / 2 - cardW / 2;
  }

  return (
    <div className="dosisya-ui" role="dialog" aria-modal="true" aria-label="Guía de uso">
      {/* Oscurecido + recorte. El SVG captura los clics (recorrido guiado). */}
      <svg
        className="fixed inset-0 z-[80] h-full w-full"
        width="100%"
        height="100%"
        aria-hidden="true"
        onClick={siguiente}
      >
        <defs>
          <mask id="tour-recorte">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {recorte && (
              <rect
                x={recorte.left - pad}
                y={recorte.top - pad}
                width={recorte.width + pad * 2}
                height={recorte.height + pad * 2}
                rx={14}
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(13,31,24,0.64)"
          mask="url(#tour-recorte)"
        />
      </svg>

      {/* Anillo alrededor del recorte */}
      {recorte && (
        <motion.div
          className="pointer-events-none fixed z-[81]"
          initial={reduce ? false : { opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
          style={{
            top: recorte.top - pad,
            left: recorte.left - pad,
            width: recorte.width + pad * 2,
            height: recorte.height + pad * 2,
            borderRadius: 14,
            boxShadow: "0 0 0 2px var(--verde-claro), 0 0 0 6px rgba(95,214,164,0.28)",
          }}
        />
      )}

      {/* Tarjeta */}
      <AnimatePresence mode="wait">
        <motion.div
          key={indice}
          ref={cardRef}
          tabIndex={-1}
          initial={reduce ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? undefined : { opacity: 0, y: -8 }}
          transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
          className="fixed z-[82] outline-none"
          style={{
            top: cardTop,
            left: cardLeft,
            width: cardW,
            background: "var(--blanco)",
            borderRadius: 16,
            border: "1px solid var(--borde)",
            boxShadow: "0 24px 48px -16px rgba(13,31,24,0.45)",
            padding: 18,
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <span
              className="dy-num"
              style={{ fontSize: 12, fontWeight: 600, color: "var(--verde-vivo)" }}
            >
              {indice + 1} / {total}
            </span>
            <button
              type="button"
              onClick={cerrar}
              aria-label="Cerrar guía"
              className="dy-foco -mr-1 -mt-1 flex h-7 w-7 items-center justify-center rounded-lg"
              style={{ color: "var(--tinta-tenue)" }}
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <h2
            className="mt-1.5"
            style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-0.01em", color: "var(--tinta)" }}
          >
            {paso.titulo}
          </h2>
          <p className="mt-1.5" style={{ fontSize: 13.5, lineHeight: 1.5, color: "var(--tinta-suave)" }}>
            {paso.texto}
          </p>

          <div className="mt-4 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={cerrar}
              className="dy-foco rounded-lg px-1 py-1 text-left"
              style={{ fontSize: 12.5, fontWeight: 500, color: "var(--tinta-tenue)" }}
            >
              Saltar guía
            </button>

            <div className="flex items-center gap-2">
              {indice > 0 && (
                <button
                  type="button"
                  onClick={atras}
                  className="dy-foco inline-flex h-9 items-center gap-1.5 rounded-xl px-3"
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: "var(--verde-cruz)",
                    border: "1px solid var(--borde)",
                    background: "var(--blanco)",
                  }}
                >
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Atrás
                </button>
              )}
              <button
                type="button"
                onClick={siguiente}
                className="dy-foco inline-flex h-9 items-center gap-1.5 rounded-xl px-3.5"
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#fff",
                  background: "var(--verde-cruz)",
                }}
              >
                {esUltimo ? (
                  <>
                    Entendido <Check className="h-4 w-4" aria-hidden="true" />
                  </>
                ) : (
                  <>
                    Siguiente <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

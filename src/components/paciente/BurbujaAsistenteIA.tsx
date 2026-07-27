/*
 * BurbujaAsistenteIA — burbuja flotante y arrastrable del Asistente IA.
 * Montada una vez en App, visible en toda la app. Posición inicial abajo-derecha;
 * el usuario la mueve a donde quiera y se recuerda en localStorage. Se oculta
 * mientras el chat está abierto. Distingue tap (abre) de arrastre (mueve).
 */
import { useEffect, useRef, useState } from "react";
import { motion, useMotionValue, useReducedMotion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { useLocalStorage } from "@/hooks/useLocalStorage";

const SIZE = 58;
const MARGIN = 16;
const NAV_GAP = 96; // deja libre la nav inferior + barra de Lista

type Pos = { x: number; y: number };

export function BurbujaAsistenteIA({
  visible,
  onAbrir,
}: {
  visible: boolean;
  onAbrir: () => void;
}) {
  const reduce = useReducedMotion();
  const [pos, setPos] = useLocalStorage<Pos | null>("dosisya:burbujaIA:pos", null);
  const [montado, setMontado] = useState(false);
  const dragMovedRef = useRef(false);
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const clamp = (p: Pos): Pos => ({
    x: Math.min(Math.max(MARGIN, p.x), window.innerWidth - SIZE - MARGIN),
    y: Math.min(Math.max(MARGIN, p.y), window.innerHeight - SIZE - MARGIN),
  });

  const posPorDefecto = (): Pos => ({
    x: window.innerWidth - SIZE - MARGIN,
    y: window.innerHeight - SIZE - MARGIN - NAV_GAP,
  });

  // Restaurar posición al montar (client-only: usa window).
  useEffect(() => {
    const start = clamp(pos ?? posPorDefecto());
    x.set(start.x);
    y.set(start.y);
    setMontado(true);
    // solo al montar
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-encajar al viewport en resize/rotación.
  useEffect(() => {
    if (!montado) return;
    const onResize = () => {
      const p = clamp({ x: x.get(), y: y.get() });
      x.set(p.x);
      y.set(p.y);
      setPos(p);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [montado]);

  if (!montado || !visible) return null;

  return (
    <motion.button
      type="button"
      aria-label="Abrir asistente IA"
      drag
      dragMomentum={false}
      dragElastic={0}
      dragConstraints={{
        left: MARGIN,
        top: MARGIN,
        right: window.innerWidth - SIZE - MARGIN,
        bottom: window.innerHeight - SIZE - MARGIN,
      }}
      style={{
        position: "fixed",
        left: 0,
        top: 0,
        x,
        y,
        width: SIZE,
        height: SIZE,
        borderRadius: 19,
        background: "var(--verde-cruz)",
        color: "var(--papel)",
        border: 0,
        boxShadow: "0 10px 22px -8px rgba(15,76,58,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 45,
        cursor: "grab",
        touchAction: "none",
      }}
      whileTap={reduce ? undefined : { scale: 0.92 }}
      onPointerDown={() => {
        dragMovedRef.current = false;
      }}
      onDragStart={() => {
        dragMovedRef.current = true;
      }}
      onDragEnd={() => {
        const p = clamp({ x: x.get(), y: y.get() });
        x.set(p.x);
        y.set(p.y);
        setPos(p);
      }}
      onClick={() => {
        // Si acabó de arrastrarse, tragarse este click y no abrir.
        if (dragMovedRef.current) {
          dragMovedRef.current = false;
          return;
        }
        onAbrir();
      }}
    >
      <Sparkles className="h-6 w-6" strokeWidth={1.7} aria-hidden="true" />
    </motion.button>
  );
}

/*
 * BurbujaAsistenteIA — pestaña flotante y arrastrable del Asistente IA.
 * Montada una vez en App, visible en toda la app. Vive siempre pegada a un
 * lateral (izquierda o derecha) — nunca a mitad de pantalla — como una
 * lengüeta translúcida con una carita que mira hacia el contenido. El
 * usuario la arrastra verticalmente o de un lateral a otro; se recuerda en
 * localStorage. Se oculta mientras el chat está abierto. Distingue tap
 * (abre) de arrastre (mueve).
 */
import { useEffect, useRef, useState } from "react";
import { motion, animate, useMotionValue, useReducedMotion } from "framer-motion";
import { useLocalStorage } from "@/hooks/useLocalStorage";

const WIDTH = 42;
const HEIGHT = 50;
const MARGIN_H = 8; // separación del borde lateral — nunca 0, nunca a mitad de pantalla
const MARGIN_V = 16;
const NAV_GAP = 96; // deja libre la nav inferior + barra de Lista

type Lado = "left" | "right";
type Pos = { lado: Lado; y: number };

export function BurbujaAsistenteIA({
  visible,
  onAbrir,
}: {
  visible: boolean;
  onAbrir: () => void;
}) {
  const reduce = useReducedMotion();
  const [pos, setPos] = useLocalStorage<Pos | null>("dosisya:burbujaIA:pos2", null);
  const [montado, setMontado] = useState(false);
  const [lado, setLado] = useState<Lado>("right");
  const dragMovedRef = useRef(false);
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const xDeLado = (l: Lado) => (l === "right" ? window.innerWidth - WIDTH - MARGIN_H : MARGIN_H);
  const clampY = (val: number) =>
    Math.min(Math.max(MARGIN_V, val), window.innerHeight - HEIGHT - MARGIN_V);

  // Restaurar posición al montar (client-only: usa window).
  useEffect(() => {
    const l = pos?.lado ?? "right";
    const startY = clampY(pos?.y ?? window.innerHeight - HEIGHT - MARGIN_V - NAV_GAP);
    setLado(l);
    x.set(xDeLado(l));
    y.set(startY);
    setMontado(true);
    // solo al montar
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-encajar al lateral correspondiente en resize/rotación.
  useEffect(() => {
    if (!montado) return;
    const onResize = () => {
      x.set(xDeLado(lado));
      y.set(clampY(y.get()));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [montado, lado]);

  if (!montado || !visible) return null;

  // Redondeo asimétrico: lado "de gozne" (pegado al borde) casi recto,
  // lado abierto hacia el contenido bien redondeado — lee como una lengüeta.
  const redondeo = lado === "right" ? "20px 7px 7px 20px" : "7px 20px 20px 7px";

  return (
    <motion.button
      type="button"
      aria-label="Abrir asistente IA"
      drag
      dragMomentum={false}
      dragElastic={0.06}
      dragConstraints={{
        left: MARGIN_H,
        top: MARGIN_V,
        right: window.innerWidth - WIDTH - MARGIN_H,
        bottom: window.innerHeight - HEIGHT - MARGIN_V,
      }}
      style={{
        position: "fixed",
        left: 0,
        top: 0,
        x,
        y,
        width: WIDTH,
        height: HEIGHT,
        borderRadius: redondeo,
        background: "var(--glass-bg)",
        border: "1px solid var(--glass-border)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        boxShadow: "0 6px 16px -9px rgba(15,76,58,0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 45,
        cursor: "grab",
        touchAction: "none",
        padding: 0,
      }}
      whileTap={reduce ? undefined : { scale: 0.9 }}
      onPointerDown={() => {
        dragMovedRef.current = false;
      }}
      onDragStart={() => {
        dragMovedRef.current = true;
      }}
      onDrag={() => {
        // Actualiza el lado en vivo para que la carita voltee mientras arrastra.
        const centro = x.get() + WIDTH / 2;
        const nuevoLado: Lado = centro < window.innerWidth / 2 ? "left" : "right";
        if (nuevoLado !== lado) setLado(nuevoLado);
      }}
      onDragEnd={() => {
        const centro = x.get() + WIDTH / 2;
        const nuevoLado: Lado = centro < window.innerWidth / 2 ? "left" : "right";
        const finalY = clampY(y.get());
        setLado(nuevoLado);
        // Siempre resuelve a un lateral — nunca se queda a mitad de pantalla.
        animate(x, xDeLado(nuevoLado), {
          type: reduce ? "tween" : "spring",
          duration: reduce ? 0.15 : undefined,
          stiffness: 420,
          damping: 34,
        });
        y.set(finalY);
        setPos({ lado: nuevoLado, y: finalY });
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
      <CaritaAsistente mirandoHacia={lado === "right" ? "left" : "right"} reduceMotion={!!reduce} />
    </motion.button>
  );
}

/** Carita mínima (dos ojos) que siempre mira hacia el contenido, no hacia el borde. */
function CaritaAsistente({
  mirandoHacia,
  reduceMotion,
}: {
  mirandoHacia: "left" | "right";
  reduceMotion: boolean;
}) {
  const dx = mirandoHacia === "left" ? -2 : 2;
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
      <motion.g
        animate={reduceMotion ? undefined : { scaleY: [1, 1, 0.12, 1, 1] }}
        transition={
          reduceMotion
            ? undefined
            : {
                duration: 4.2,
                repeat: Infinity,
                repeatDelay: 1.4,
                times: [0, 0.85, 0.9, 0.95, 1],
                ease: "easeInOut",
              }
        }
        style={{ originX: "12px", originY: "11px" }}
      >
        <circle cx={8 + dx} cy="11" r="2.1" fill="var(--verde-cruz)" />
        <circle cx={16 + dx} cy="11" r="2.1" fill="var(--verde-cruz)" />
      </motion.g>
      <path
        d={`M ${8.5 + dx} 15.5 Q 12 17.5 ${15.5 + dx} 15.5`}
        stroke="var(--verde-cruz)"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

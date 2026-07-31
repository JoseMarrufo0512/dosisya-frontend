import { useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";

const SENIALES = ["✅ Farmacias verificadas", "💵 Precios en $ y Bs", "🛵 Delivery local"];

const DURACION_MS = 1200;

/**
 * Splash breve al abrir la app: logo + señales de confianza que antes vivían
 * fijas en el hero. Se muestra una vez por carga (visible por defecto en SSR,
 * sin parpadeo) y desaparece sola tras DURACION_MS.
 */
export function SplashScreen({ onFinish }: { onFinish: () => void }) {
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const t = window.setTimeout(onFinish, reduceMotion ? 400 : DURACION_MS);
    return () => window.clearTimeout(t);
    // onFinish es estable (setState de App); solo debe correr una vez al montar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <motion.div
      exit={{ opacity: 0 }}
      transition={{ duration: reduceMotion ? 0.15 : 0.4, ease: [0.4, 0, 0.2, 1] }}
      className="dosisya-ui fixed inset-0 z-[100] flex flex-col items-center justify-center gap-7 px-6"
      style={{ background: "var(--gradient-hero)" }}
      aria-hidden="true"
    >
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
        className="text-center"
      >
        <p className="font-black text-4xl text-white tracking-tight">DosisYa</p>
        <p className="mt-1.5 text-sm text-white/75">Encuentra tu medicamento cerca de ti</p>
      </motion.div>

      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15, ease: [0.4, 0, 0.2, 1] }}
        className="flex flex-wrap justify-center gap-2"
      >
        {SENIALES.map((s) => (
          <span
            key={s}
            className="rounded-full px-3 py-1.5 text-xs text-white/90"
            style={{
              background: "rgba(255,255,255,0.12)",
              border: "1px solid rgba(255,255,255,0.18)",
            }}
          >
            {s}
          </span>
        ))}
      </motion.div>
    </motion.div>
  );
}

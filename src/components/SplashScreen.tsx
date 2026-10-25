const SENIALES = ["✅ Farmacias verificadas", "💵 Precios en $ y Bs", "🛵 Delivery local"];

/**
 * Splash breve al abrir la app (logo + señales de confianza).
 *
 * Se descarta con una animación **CSS pura** tras ~1.2 s, INDEPENDIENTE de la
 * hidratación. Antes el cierre vivía en un `useEffect` (setTimeout → setState),
 * que solo corre cuando el bundle de cliente descarga e hidrata. En redes
 * lentas (3G, gama baja) eso tardaba ~30 s, y este overlay `z-100` tapaba el
 * buscador —ya renderizado por SSR debajo— todo ese tiempo, bloqueando la
 * interacción. Con CSS, el contenido SSR queda usable a los ~1.2 s aunque el JS
 * no haya llegado. El contenido es estático (sin framer-motion) para que sea
 * visible sin JS; `visibility:hidden` al final lo saca del flujo de foco/puntero.
 */
export function SplashScreen() {
  return (
    <div
      className="dy-splash dosisya-ui fixed inset-0 z-[100] flex flex-col items-center justify-center gap-7 px-6"
      style={{ background: "var(--gradient-hero)" }}
      aria-hidden="true"
    >
      <style>{`
        @keyframes dy-splash-out { to { opacity: 0; visibility: hidden; } }
        @keyframes dy-splash-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
        .dy-splash { animation: dy-splash-out 0.45s cubic-bezier(0.4,0,0.2,1) 1200ms forwards; }
        .dy-splash > * { animation: dy-splash-in 0.4s cubic-bezier(0.4,0,0.2,1) both; }
        @media (prefers-reduced-motion: reduce) {
          .dy-splash { animation: dy-splash-out 0.01s linear 500ms forwards; }
          .dy-splash > * { animation: none; }
        }
      `}</style>

      <div className="text-center">
        <p className="font-black text-4xl text-white tracking-tight">DosisYa</p>
        <p className="mt-1.5 text-sm text-white/75">Encuentra tu medicamento cerca de ti</p>
      </div>

      <div className="flex flex-wrap justify-center gap-2">
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
      </div>
    </div>
  );
}

import { useEffect, useRef, useSyncExternalStore } from "react";

/**
 * Hace que el botón "atrás" del navegador/teléfono cierre el overlay abierto en
 * vez de navegar fuera de la app.
 *
 * Modelo (a prueba de transiciones A→B):
 *  - Un contador global de overlays abiertos y UNA sola "entrada trampa" en el
 *    history: la trampa existe mientras el contador sea > 0.
 *  - Los cambios de history se reconcilian en un microtask, no en el acto. Así,
 *    al cerrar un overlay y abrir otro en el mismo tick (p. ej. "Más" → Chat),
 *    el contador nunca llega a 0 y NO se toca el historial: la trampa se reusa y
 *    no hay carrera entre history.back() y pushState.
 *  - En esta app solo hay un overlay visible a la vez, así que "atrás" cierra el
 *    que esté abierto (cierra todos los registrados, que es a lo sumo uno).
 */

type Closer = () => void;

const closers = new Set<Closer>();
const suscriptores = new Set<() => void>();
let openCount = 0;
let trapActive = false;
let programmaticBack = false;
let scheduled = false;
let listening = false;

/** Avisa a los suscriptores de `useHayOverlayAbierto` que cambió el contador. */
function notificar() {
  suscriptores.forEach((fn) => fn());
}

function onPop() {
  if (programmaticBack) {
    // Fue nuestro history.back() programático (cierre por X/backdrop/Esc).
    programmaticBack = false;
    return;
  }
  // Atrás del usuario: el navegador ya consumió la trampa.
  trapActive = false;
  const fns = [...closers];
  closers.clear();
  openCount = 0;
  notificar();
  fns.forEach((fn) => fn());
}

function reconcile() {
  scheduled = false;
  if (typeof window === "undefined") return;

  if (openCount > 0 && !trapActive) {
    trapActive = true;
    if (!listening) {
      window.addEventListener("popstate", onPop);
      listening = true;
    }
    window.history.pushState({ dosisyaOverlay: true }, "");
  } else if (openCount === 0 && trapActive) {
    trapActive = false;
    programmaticBack = true;
    window.history.back();
  }
}

function schedule() {
  if (scheduled || typeof window === "undefined") return;
  scheduled = true;
  queueMicrotask(reconcile);
}

export function useBackDismiss(open: boolean, onClose: () => void) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  // Closer registrado por ESTA instancia mientras está abierta (null si cerrada).
  const closerRef = useRef<Closer | null>(null);

  useEffect(() => {
    if (open && !closerRef.current) {
      const closer: Closer = () => {
        closerRef.current = null;
        onCloseRef.current();
      };
      closerRef.current = closer;
      closers.add(closer);
      openCount += 1;
      notificar();
      schedule();
    } else if (!open && closerRef.current) {
      closers.delete(closerRef.current);
      closerRef.current = null;
      openCount = Math.max(0, openCount - 1);
      notificar();
      schedule();
    }
  }, [open]);

  // Al desmontar estando abierto, liberar el registro.
  useEffect(() => {
    return () => {
      if (closerRef.current) {
        closers.delete(closerRef.current);
        closerRef.current = null;
        openCount = Math.max(0, openCount - 1);
        notificar();
        schedule();
      }
    };
  }, []);
}

/**
 * ¿Hay alguna hoja/overlay abierto ahora mismo?
 *
 * Reusa el contador de arriba, así que cubre cualquier overlay registrado sin
 * tener que enumerarlos (incluidas las sub-hojas de "Más", que cierran su hoja
 * madre al abrirse y por eso no se ven desde los flags de App).
 *
 * Lo usa la burbuja flotante del asistente para esconderse: los overlays de
 * vaul se portalean al body y ganan el hit-test, así que la burbuja quedaba a
 * la vista sobre el fondo oscurecido pero al tocarla cerrabas la hoja.
 */
export function useHayOverlayAbierto(): boolean {
  return useSyncExternalStore(
    (avisar) => {
      suscriptores.add(avisar);
      return () => {
        suscriptores.delete(avisar);
      };
    },
    () => openCount > 0,
    () => false, // en SSR no hay overlays abiertos
  );
}

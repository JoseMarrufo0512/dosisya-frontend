import { useCallback, useEffect, useRef, useState } from "react";

/*
 * useTourGuiado — estado + persistencia de un tour de onboarding.
 *
 * Una clave por superficie (paciente / panel / super) en localStorage: así cada
 * usuario ve su tour la primera vez y no vuelve a aparecer solo. El botón de
 * ayuda lo relanza cuando quieran (iniciar()).
 *
 * SSR-safe (TanStack Start): el acceso a localStorage y el auto-arranque viven
 * en efectos de cliente, nunca en el primer render.
 */

const PREFIJO = "tourVisto:";

export interface EstadoTour {
  /** El overlay del tour está visible. */
  activo: boolean;
  /** Lanza (o relanza) el tour manualmente — ignora el flag "visto". */
  iniciar: () => void;
  /** Cierra el tour y lo marca como visto para esta superficie. */
  cerrar: () => void;
}

export function useTourGuiado(
  idTour: string,
  opts?: {
    /** Si es false, el tour no arranca solo (p. ej. aún no está lista la vista). */
    autoIniciar?: boolean;
  },
): EstadoTour {
  const autoIniciar = opts?.autoIniciar ?? true;
  const clave = PREFIJO + idTour;

  const [activo, setActivo] = useState(false);
  // Evita que el auto-arranque dispare más de una vez aunque autoIniciar
  // cambie de valor durante la sesión.
  const yaAutoInicio = useRef(false);

  const marcarVisto = useCallback(() => {
    try {
      window.localStorage.setItem(clave, "1");
    } catch {
      /* modo privado / cuota: no bloquear la UI */
    }
  }, [clave]);

  const iniciar = useCallback(() => setActivo(true), []);

  const cerrar = useCallback(() => {
    setActivo(false);
    marcarVisto();
  }, [marcarVisto]);

  // Auto-arranque en la primera visita. Un pequeño retraso deja que el layout
  // (y los elementos ancla del tour) terminen de montar antes de medirlos.
  useEffect(() => {
    if (!autoIniciar || yaAutoInicio.current) return;
    let visto = true;
    try {
      visto = window.localStorage.getItem(clave) === "1";
    } catch {
      visto = true; // si no podemos leer, no insistimos con el auto-arranque
    }
    if (visto) return;
    yaAutoInicio.current = true;
    const t = window.setTimeout(() => setActivo(true), 650);
    return () => window.clearTimeout(t);
  }, [autoIniciar, clave]);

  return { activo, iniciar, cerrar };
}

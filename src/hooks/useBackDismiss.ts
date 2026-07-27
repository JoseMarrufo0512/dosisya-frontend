import { useEffect, useRef } from "react";

/**
 * Hace que el botón "atrás" del navegador/teléfono cierre un overlay controlado
 * en vez de navegar fuera de la app.
 *
 * Al pasar `open` de false→true empuja una entrada "trampa" en el history. Si el
 * usuario presiona atrás (popstate) estando abierto, se llama `onClose`. Si el
 * overlay se cierra por otra vía (botón X, backdrop, tecla Esc), se consume la
 * entrada trampa con history.back() para no dejar basura en el historial.
 *
 * Con varios overlays apilados, cada instancia empuja su propia entrada, así que
 * "atrás" cierra el de más arriba primero (comportamiento tipo pila, como nativo).
 */
export function useBackDismiss(open: boolean, onClose: () => void) {
  const pushedRef = useRef(false);
  // onClose siempre fresco sin re-suscribir el listener en cada render.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (open && !pushedRef.current) {
      window.history.pushState({ dosisyaOverlay: true }, "");
      pushedRef.current = true;

      const onPop = () => {
        // El usuario presionó atrás: la entrada trampa ya fue consumida.
        pushedRef.current = false;
        onCloseRef.current();
      };
      window.addEventListener("popstate", onPop);
      return () => window.removeEventListener("popstate", onPop);
    }

    if (!open && pushedRef.current) {
      // Cierre programático (X / backdrop / Esc): consumimos nuestra trampa.
      pushedRef.current = false;
      window.history.back();
    }
  }, [open]);
}

import { RefreshCw } from "lucide-react";

interface EstadoErrorProps {
  /** Mensaje de error a mostrar al usuario */
  mensaje: string;
  /** Callback para reintentar la acción que falló */
  onReintentar?: () => void;
}

/**
 * Estado visual cuando la API falla (500, 503, red caída, etc.).
 *
 * Es distinto de `EstadoVacio`, que indica éxito con 0 resultados.
 * Este componente comunica honestamente que algo salió mal y ofrece
 * un botón de reintento si la acción es repetible.
 */
export function EstadoError({ mensaje, onReintentar }: EstadoErrorProps) {
  return (
    <div className="py-12 text-center text-muted-foreground" role="alert">
      <div className="mb-4 flex justify-center text-6xl" aria-hidden="true">
        ⚠️
      </div>
      <h3 className="mb-2 text-lg font-medium text-foreground">
        Algo salió mal
      </h3>
      <p className="mx-auto mb-6 max-w-sm text-sm">
        {mensaje}
      </p>
      {onReintentar && (
        <button
          type="button"
          onClick={onReintentar}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <RefreshCw size={15} aria-hidden="true" />
          Intentar de nuevo
        </button>
      )}
    </div>
  );
}

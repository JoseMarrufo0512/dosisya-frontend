import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight, Pill } from "lucide-react";
import { useListaMedica } from "@/hooks/useListaMedica";

interface CartSummaryProps {
  onVerLista: () => void;
}

/**
 * Barra flotante persistente (spec receta-ia-y-carrito): visible en toda la
 * app mientras haya items. Vive en la zona del pulgar y usa los tokens glass
 * de styles.css. En SSR renderiza null (lista vacía) sin mismatch.
 */
export function CartSummary({ onVerLista }: CartSummaryProps) {
  const { totalDistintos } = useListaMedica();

  return (
    <AnimatePresence>
      {totalDistintos > 0 && (
        <motion.div
          initial={{ y: 96, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 96, opacity: 0 }}
          transition={{ type: "spring", stiffness: 380, damping: 32 }}
          className="fixed inset-x-0 bottom-0 z-40 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"
        >
          <button
            type="button"
            onClick={onVerLista}
            aria-label={`Ver tu lista médica: ${totalDistintos} medicamento${totalDistintos === 1 ? "" : "s"}`}
            className="mx-auto flex w-full max-w-md items-center gap-3 rounded-full border px-4 py-3 text-left shadow-[var(--shadow-card)] backdrop-blur-md transition-transform active:scale-[0.98]"
            style={{ background: "var(--glass-bg)", borderColor: "var(--glass-border)" }}
          >
            <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Pill className="h-5 w-5" aria-hidden />
              {/* key={total} reinicia la animación cada vez que cambia el contador */}
              <motion.span
                key={totalDistintos}
                initial={{ scale: 1.6 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 500, damping: 22 }}
                className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-secondary px-1 text-[11px] font-bold text-secondary-foreground"
              >
                {totalDistintos}
              </motion.span>
            </span>

            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-foreground">
                {totalDistintos === 1
                  ? "1 medicamento en tu lista"
                  : `${totalDistintos} medicamentos en tu lista`}
              </span>
              <span className="block text-xs text-muted-foreground">
                Toca para elegir farmacia
              </span>
            </span>

            <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

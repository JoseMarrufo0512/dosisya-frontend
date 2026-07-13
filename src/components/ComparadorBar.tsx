import { AnimatePresence, motion } from "framer-motion";
import { Scale, X } from "lucide-react";

interface ComparadorBarProps {
  cantidad: number;
  onComparar: () => void;
  onLimpiar: () => void;
  /** true si la barra flotante de la Lista Médica está visible (se apila encima). */
  elevada: boolean;
}

/**
 * Barra inferior fija "Comparar (n)" (spec busqueda-v2 §2.4). Aparece con
 * ≥2 seleccionados. Cuando CartSummary (Lista Médica) está visible, esta
 * barra se apila por encima para no solaparse.
 */
export function ComparadorBar({ cantidad, onComparar, onLimpiar, elevada }: ComparadorBarProps) {
  return (
    <AnimatePresence>
      {cantidad >= 2 && (
        <motion.div
          initial={{ y: 96, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 96, opacity: 0 }}
          transition={{ type: "spring", stiffness: 380, damping: 32 }}
          className={`fixed inset-x-0 z-40 px-4 ${
            elevada
              ? "bottom-[calc(5.5rem+env(safe-area-inset-bottom))]"
              : "bottom-0 pb-[calc(1rem+env(safe-area-inset-bottom))]"
          }`}
        >
          <div className="mx-auto flex w-full max-w-md items-center gap-2 rounded-full border border-sky-200 bg-white px-2 py-2 shadow-lg">
            <button
              type="button"
              onClick={onComparar}
              className="flex flex-1 items-center justify-center gap-2 rounded-full bg-sky-600 text-white font-semibold text-sm px-4 py-2.5 hover:bg-sky-700 transition-colors active:scale-[0.98]"
            >
              <Scale className="h-4 w-4" aria-hidden />
              Comparar ({cantidad})
            </button>
            <button
              type="button"
              onClick={onLimpiar}
              aria-label="Limpiar selección de comparación"
              className="flex h-9 w-9 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 transition-colors"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

import { useState, useEffect } from "react";

const MENSAJES = [
  "Rastreando farmacias cercanas…",
  "Calculando distancias…",
  "Buscando el mejor precio…",
];

export function EstadoCargando() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((i) => (i + 1) % MENSAJES.length);
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  return (
    // role="status" (aria-live polite implícito): anuncia el progreso a lectores
    // de pantalla sin interrumpir. Los skeletons son decorativos → aria-hidden.
    <div className="space-y-4" role="status" aria-live="polite">
      <div className="py-2 text-center text-sm font-medium text-muted-foreground transition-opacity duration-500 motion-reduce:transition-none">
        {MENSAJES[index]}
      </div>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          aria-hidden="true"
          className="animate-pulse rounded-xl border border-border bg-card p-4 shadow-sm motion-reduce:animate-none"
        >
          <div className="h-4 w-1/3 rounded bg-muted" />
          <div className="mt-3 h-5 w-2/3 rounded bg-muted" />
          <div className="mt-2 h-4 w-1/4 rounded bg-muted" />
          <div className="mt-4 h-10 w-full rounded-lg bg-muted" />
        </div>
      ))}
    </div>
  );
}

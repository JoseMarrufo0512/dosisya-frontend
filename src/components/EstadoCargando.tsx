import { useState, useEffect } from "react";

const MENSAJES = [
  "Rastreando farmacias cercanas...",
  "Calculando distancias...",
  "Buscando el mejor precio...",
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
    <div className="space-y-4">
      <div className="py-2 text-center text-sm font-medium text-emerald-600 transition-opacity duration-500">
        {MENSAJES[index]}
      </div>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="animate-pulse rounded-xl border border-gray-100 bg-white p-4 shadow-sm"
        >
          <div className="h-4 w-1/3 rounded bg-gray-200" />
          <div className="mt-3 h-5 w-2/3 rounded bg-gray-200" />
          <div className="mt-2 h-4 w-1/4 rounded bg-gray-200" />
          <div className="mt-4 h-10 w-full rounded-lg bg-gray-200" />
        </div>
      ))}
    </div>
  );
}

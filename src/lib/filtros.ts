// Filtros client-side de Búsqueda v2 (spec §2.3).
//
// Funciones PURAS sobre los resultados ya recibidos (≤20): jamás disparan
// llamadas a la API. El refinado de distancia opera DENTRO del radio ya
// buscado; ampliar el radio sigue siendo la búsqueda normal.

import type { ResultadoFarmacia } from "./api";

export interface Filtros {
  /** Precio mínimo USD (null = sin límite) */
  precioMin: number | null;
  /** Precio máximo USD (null = sin límite) */
  precioMax: number | null;
  /** Distancia máxima en metros (null = sin límite) */
  distanciaMaxM: number | null;
  /** Genérico = sin marca comercial (mismo criterio que TarjetaResultado) */
  tipo: "todos" | "generico" | "marca";
  /** Solo farmacias con delivery (client-side, campo tiene_delivery) */
  soloDelivery: boolean;
}

export const FILTROS_INICIALES: Filtros = {
  precioMin: null,
  precioMax: null,
  distanciaMaxM: null,
  tipo: "todos",
  soloDelivery: false,
};

/** Genérico = sin marca comercial (o vacía). Criterio único en toda la app. */
export function esGenerico(r: ResultadoFarmacia): boolean {
  return !r.marca_comercial?.trim();
}

/** Clave estable de un resultado (una farmacia puede tener varios productos). */
export function claveResultado(r: ResultadoFarmacia): string {
  return `${r.farmacia_id}-${r.medicamento_id}`;
}

export function aplicarFiltros(
  resultados: ResultadoFarmacia[],
  filtros: Filtros,
): ResultadoFarmacia[] {
  return resultados.filter((r) => {
    if (filtros.precioMin !== null && r.precio_usd < filtros.precioMin) return false;
    if (filtros.precioMax !== null && r.precio_usd > filtros.precioMax) return false;
    if (filtros.distanciaMaxM !== null && r.distancia_m > filtros.distanciaMaxM) {
      return false;
    }
    if (filtros.tipo === "generico" && !esGenerico(r)) return false;
    if (filtros.tipo === "marca" && esGenerico(r)) return false;
    if (filtros.soloDelivery && !r.tiene_delivery) return false;
    return true;
  });
}

/** Rango [min, max] de precios USD de los resultados. null si no hay. */
export function rangoPrecios(resultados: ResultadoFarmacia[]): { min: number; max: number } | null {
  if (resultados.length === 0) return null;
  let min = resultados[0].precio_usd;
  let max = resultados[0].precio_usd;
  for (const r of resultados) {
    if (r.precio_usd < min) min = r.precio_usd;
    if (r.precio_usd > max) max = r.precio_usd;
  }
  return { min, max };
}

export function hayFiltrosActivos(filtros: Filtros): boolean {
  return (
    filtros.precioMin !== null ||
    filtros.precioMax !== null ||
    filtros.distanciaMaxM !== null ||
    filtros.tipo !== "todos" ||
    filtros.soloDelivery
  );
}

/**
 * Clave del resultado más barato entre los MOSTRADOS (badge "Más económico").
 * Con <2 resultados no tiene sentido comparar → null.
 */
export function claveMasEconomico(resultados: ResultadoFarmacia[]): string | null {
  if (resultados.length < 2) return null;
  let min = resultados[0];
  for (const r of resultados) {
    if (r.precio_usd < min.precio_usd) min = r;
  }
  return claveResultado(min);
}

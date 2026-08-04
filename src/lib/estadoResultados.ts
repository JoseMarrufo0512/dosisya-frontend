/** Estado de vista de búsqueda al que se vuelve tras limpiar el input (botón ✕). */
export function alLimpiarBusqueda() {
  return {
    estado: "hero" as const,
    query: "",
    terminoBuscado: "",
  };
}

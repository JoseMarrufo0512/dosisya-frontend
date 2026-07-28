import type { ItemLista } from "@/hooks/useListaMedica";

/** Deja solo dígitos — mismo criterio de sanitización que TarjetaResultado. */
export function sanitizarTelefono(telefono?: string | null): string {
  return telefono?.replace(/\D/g, "") ?? "";
}

/**
 * Mensaje multi-producto: saludo con branding, lista numerada con cantidades
 * y una pregunta clara. WhatsApp renderiza *asteriscos* como negrita.
 *
 * Si algún ítem viene del escáner de récipe con IA (`origen: "escaner_recipe"`),
 * añade una nota para el farmacéutico — la IA puede leer mal un medicamento
 * y quien despacha debe confirmar contra la receta física, sin importar si el
 * paciente reformuló algo o no (spec: quitar-reformular-recipe-design.md).
 */
export function construirMensajeLista(farmaciaNombre: string, lista: ItemLista[]): string {
  const lineas = lista.map((item, i) => {
    const marca = item.marcaComercial ? ` (${item.marcaComercial})` : "";
    const cantidad = item.cantidad > 1 ? ` — x${item.cantidad}` : "";
    return `${i + 1}. ${item.nombre}${marca} · ${item.presentacion}${cantidad}`;
  });

  const tieneItemsDeEscaner = lista.some((item) => item.origen === "escaner_recipe");
  const notaFarmaceutico = tieneItemsDeEscaner
    ? [
        "",
        "⚠️ Algunos productos fueron leídos por IA desde una foto de récipe — " +
          "por favor confirma contra la receta física antes de despachar.",
      ]
    : [];

  return [
    `Hola ${farmaciaNombre} 👋 Vengo de *DosisYa* y quiero pedir:`,
    "",
    ...lineas,
    ...notaFarmaceutico,
    "",
    "¿Tienen disponibilidad? ¡Gracias!",
  ].join("\n");
}

/** URL wa.me lista para abrir. Devuelve null si la farmacia no tiene teléfono. */
export function construirUrlWhatsApp(
  telefono: string | null | undefined,
  mensaje: string,
): string | null {
  const phone = sanitizarTelefono(telefono);
  if (!phone) return null;
  return `https://wa.me/${phone}?text=${encodeURIComponent(mensaje)}`;
}

/**
 * Mensaje de un solo producto (comparador de Búsqueda v2): el usuario ya vio
 * el precio en DosisYa — se cita para que la farmacia reconozca el canal.
 */
export function construirMensajeProducto(
  farmaciaNombre: string,
  nombre: string,
  presentacion: string,
  precioUsd: number,
): string {
  return (
    `Hola ${farmaciaNombre} 👋 Vi en *DosisYa* ${nombre} (${presentacion}) ` +
    `a $${precioUsd.toFixed(2)}. ¿Lo tienen disponible?`
  );
}

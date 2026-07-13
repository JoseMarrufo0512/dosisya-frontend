// Chips de categorías del hero (spec busqueda-v2 §2.2).
//
// La API busca por principio activo o marca (pg_trgm), NO por categoría.
// Cada chip mapea a un término de búsqueda real y representativo. Mapa
// curado — ampliar aquí cuando haya datos de inventario reales por rubro.

export interface Categoria {
  /** Texto visible del chip */
  etiqueta: string;
  /** Emoji decorativo (aria-hidden en el render) */
  emoji: string;
  /** Término real que se envía a /medicamentos/buscar */
  termino: string;
}

export const CATEGORIAS: Categoria[] = [
  { etiqueta: "Dolor y fiebre", emoji: "🤕", termino: "acetaminofen" },
  { etiqueta: "Gripe y alergia", emoji: "🤧", termino: "loratadina" },
  { etiqueta: "Tensión", emoji: "❤️", termino: "losartan" },
  { etiqueta: "Antibióticos", emoji: "💊", termino: "amoxicilina" },
  { etiqueta: "Estómago", emoji: "🫗", termino: "omeprazol" },
  { etiqueta: "Diabetes", emoji: "🩸", termino: "metformina" },
];

/*
 * Definición de los pasos de cada tour guiado.
 *
 * Cada paso ancla a un elemento real vía selector `[data-tour="..."]` (no a
 * clases de estilo, para no acoplar el tour al diseño). `alEntrar` deja que un
 * paso prepare la vista antes de resaltar — por ejemplo, cambiar de sección en
 * el panel. Si el elemento no existe, el motor muestra la tarjeta centrada sin
 * foco en lugar de romperse.
 */

export interface PasoTour {
  /** Selector CSS del elemento a resaltar. */
  selector: string;
  titulo: string;
  texto: string;
  /** Margen extra del recorte alrededor del elemento (px). Default 8. */
  padding?: number;
  /** Se ejecuta al entrar al paso, antes de medir el elemento. */
  alEntrar?: () => void;
}

// ── Paciente (B2C) — vista de búsqueda ───────────────────────────────────────
export const PASOS_PACIENTE: PasoTour[] = [
  {
    selector: '[data-tour="buscador"]',
    titulo: "Busca tu medicamento",
    texto:
      "Escribe el nombre y verás al instante en qué farmacias cercanas está, con su precio. Sin registrarte.",
  },
  {
    selector: '[data-tour="categorias"]',
    titulo: "O explora por categoría",
    texto: "¿No sabes el nombre exacto? Toca una categoría y te mostramos lo más buscado.",
  },
  {
    selector: '[data-tour="nav-escanear"]',
    titulo: "Escanea tu récipe",
    texto:
      "Toma una foto de tu récipe y la IA arma tu Lista Médica con los medicamentos que indica.",
    padding: 12,
  },
  {
    selector: '[data-tour="nav-lista"]',
    titulo: "Tu Lista Médica",
    texto:
      "Agrega varios medicamentos y contáctalos juntos por WhatsApp. Aquí llevas tu lista, sin crear cuenta.",
  },
  {
    selector: '[data-tour="nav-farmacias"]',
    titulo: "Farmacias cercanas",
    texto: "Mira las farmacias de tu zona, con su ubicación y cómo llegar.",
  },
];

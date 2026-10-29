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

// ── Panel de farmacia (B2B) ───────────────────────────────────────────────────
// Secciones del dashboard; el tour navega entre ellas con `alEntrar`.
export type SeccionPanel = "inicio" | "inventario" | "facturacion" | "configuracion" | "soporte";

export function pasosPanel(irA: (s: SeccionPanel) => void): PasoTour[] {
  return [
    {
      selector: '[data-tour="nav-inicio"]',
      titulo: "Tu resumen",
      texto: "Aquí ves tu actividad y los leads (pacientes interesados) que recibes cada mes.",
      alEntrar: () => irA("inicio"),
    },
    {
      selector: '[data-tour="subir-inventario"]',
      titulo: "Sube tu inventario",
      texto:
        "Carga tu Excel de medicamentos y precios. Es lo que te hace aparecer en las búsquedas de los pacientes.",
      alEntrar: () => irA("inventario"),
    },
    {
      selector: '[data-tour="ubicacion"]',
      titulo: "Ubica tu farmacia",
      texto:
        "Marca tu ubicación en el mapa. Sin coordenadas, tu inventario NO aparece en el buscador, aunque tengas stock.",
      padding: 10,
      alEntrar: () => irA("configuracion"),
    },
    {
      selector: '[data-tour="nav-facturacion"]',
      titulo: "Tu facturación",
      texto: "Cobramos por lead, no por venta. Aquí ves tus leads del mes y lo que pagarás al corte.",
      alEntrar: () => irA("facturacion"),
    },
    {
      selector: '[data-tour="nav-soporte"]',
      titulo: "¿Necesitas ayuda?",
      texto: "Escríbenos por WhatsApp desde aquí. Te respondemos en menos de una hora.",
      alEntrar: () => irA("soporte"),
    },
  ];
}

// ── Superadmin ────────────────────────────────────────────────────────────────
export type SeccionSuper = "farmacias" | "facturacion";

export function pasosSuper(irA: (s: SeccionSuper) => void): PasoTour[] {
  return [
    {
      selector: '[data-tour="nav-farmacias"]',
      titulo: "Farmacias afiliadas",
      texto:
        "Aquí apruebas, editas y verificas las farmacias. Confirma siempre que tengan ubicación antes de publicarlas.",
      alEntrar: () => irA("farmacias"),
    },
    {
      selector: '[data-tour="nav-facturacion"]',
      titulo: "Facturación",
      texto: "El consumo de leads y la facturación de cada farmacia, para el corte del mes.",
      alEntrar: () => irA("facturacion"),
    },
    {
      selector: '[data-tour="nav-salir"]',
      titulo: "Cerrar sesión",
      texto: "Cierra tu sesión de superadmin cuando termines. Es un panel sensible.",
      alEntrar: () => irA("farmacias"),
    },
  ];
}

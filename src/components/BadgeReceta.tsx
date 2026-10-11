/**
 * Insignia de "Requiere récipe" (hallazgo B-03).
 *
 * Es la ÚNICA insignia de condición de dispensación que existe en la app: no
 * hay una de "venta libre". Ausencia de insignia no afirma nada — ni que el
 * producto es libre ni que no lo es. Los errores no son simétricos y el diseño
 * solo hace la afirmación cautelosa: equivocarse diciendo "requiere récipe"
 * cuesta un papel de más; equivocarse diciendo "venta libre" cuesta un
 * traslado en falso y una farmacia que no puede despachar.
 *
 * Usa los tokens --ambar-receta / --ambar-fondo, que la paleta ya reservaba
 * para este aviso antes de que el dato existiera. BadgePremium y BadgeDelivery
 * usan clases Tailwind planas; aquí se usan los tokens porque es el sitio para
 * el que se crearon y porque TarjetaResultado ya trabaja con var() en línea.
 */
export function BadgeReceta() {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold"
      style={{ background: "var(--ambar-fondo)", color: "var(--ambar-receta)" }}
    >
      Requiere récipe
    </span>
  );
}

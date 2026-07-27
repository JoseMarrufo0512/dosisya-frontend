/*
 * HojaLoginPaciente — hoja de "Iniciar sesión" (opcional) del paciente.
 *
 * Recreación del handoff (NavegacionInferior.dc.html, líneas 296–310). El login
 * es OPCIONAL por diseño: DosisYa es "Cero Fricción" y el paciente no necesita
 * cuenta para buscar ni armar su Lista Médica. "Seguir sin cuenta" es el camino
 * primario. "Continuar con teléfono" es un placeholder: aún no existe auth de
 * paciente en el backend (solo farmacia/superadmin) → TODO cuando exista.
 */

import { Drawer } from "vaul";
import { toast } from "sonner";
import { Smartphone, X } from "lucide-react";

export function HojaLoginPaciente({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const continuarConTelefono = () => {
    // TODO: cablear a auth de paciente por teléfono cuando el backend lo exponga.
    toast("Pronto podrás guardar tu Lista Médica con tu teléfono.");
  };

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-black/40" />
        <Drawer.Content
          className="dosisya-ui fixed inset-x-0 bottom-0 z-50 mx-auto flex max-w-md flex-col rounded-t-3xl outline-none"
          style={{ background: "var(--papel)", padding: "10px 18px 26px" }}
          aria-describedby={undefined}
        >
          <div
            aria-hidden="true"
            style={{ width: 38, height: 4, borderRadius: 999, background: "#d8dad3", margin: "2px auto 14px" }}
          />
          <div className="flex items-center justify-between">
            <Drawer.Title
              style={{ fontSize: 17, fontWeight: 500, color: "var(--tinta)", letterSpacing: "-0.02em" }}
            >
              Iniciar sesión
            </Drawer.Title>
            <button
              type="button"
              aria-label="Cerrar"
              onClick={() => onOpenChange(false)}
              className="dy-foco flex h-[34px] w-[34px] items-center justify-center rounded-[11px]"
              style={{ background: "var(--fondo-suave)", border: 0, color: "var(--tinta-suave)" }}
            >
              <X className="h-[18px] w-[18px]" aria-hidden="true" />
            </button>
          </div>

          <p style={{ fontSize: 13, color: "var(--tinta-suave)", lineHeight: 1.5, margin: "10px 0 16px" }}>
            Es <span style={{ color: "var(--tinta)", fontWeight: 500 }}>opcional</span>. Inicia sesión
            para guardar tu Lista Médica y acceder a beneficios.
          </p>

          <button
            type="button"
            onClick={continuarConTelefono}
            className="dy-foco flex w-full items-center justify-center gap-2"
            style={{
              height: 48,
              background: "var(--verde-cruz)",
              color: "var(--papel)",
              border: 0,
              borderRadius: 13,
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            <Smartphone className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden="true" />
            Continuar con teléfono
          </button>

          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="dy-foco w-full"
            style={{
              height: 48,
              marginTop: 10,
              background: "var(--blanco)",
              color: "var(--verde-cruz)",
              border: "1px solid #d8dad3",
              borderRadius: 13,
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            Seguir sin cuenta
          </button>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

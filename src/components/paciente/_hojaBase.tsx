/*
 * Primitivos compartidos de las hojas del paciente (bottom-sheets vaul).
 * Extraídos de MenuMasPaciente para reutilizarlos en HojaChatIA y la burbuja IA.
 */
import { Drawer } from "vaul";
import { X } from "lucide-react";

export function HojaBase({
  open,
  onClose,
  titulo,
  tituloNodo,
  children,
}: {
  open: boolean;
  onClose: () => void;
  titulo?: string;
  tituloNodo?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Drawer.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-black/40" />
        <Drawer.Content
          className="dosisya-ui fixed inset-x-0 bottom-0 z-50 mx-auto flex max-w-md flex-col rounded-t-3xl outline-none"
          style={{ background: "var(--papel)", padding: "10px 18px 24px" }}
          aria-describedby={undefined}
        >
          <Asa />
          <div className="flex items-center justify-between">
            {tituloNodo ?? (
              <Drawer.Title style={{ fontSize: 17, fontWeight: 500, color: "var(--tinta)", letterSpacing: "-0.02em" }}>
                {titulo}
              </Drawer.Title>
            )}
            {tituloNodo && <Drawer.Title className="sr-only">{titulo ?? "Detalle"}</Drawer.Title>}
            <button
              type="button"
              aria-label="Cerrar"
              onClick={onClose}
              className="dy-foco flex h-[34px] w-[34px] items-center justify-center rounded-[11px]"
              style={{ background: "var(--fondo-suave)", border: 0, color: "var(--tinta-suave)" }}
            >
              <X className="h-[18px] w-[18px]" aria-hidden="true" />
            </button>
          </div>
          {children}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

export function Asa() {
  return (
    <div
      aria-hidden="true"
      style={{ width: 38, height: 4, borderRadius: 999, background: "#d8dad3", margin: "2px auto 14px" }}
    />
  );
}

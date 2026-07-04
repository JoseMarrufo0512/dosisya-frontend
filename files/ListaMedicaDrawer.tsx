import { useEffect, useState } from "react";
import { Drawer } from "vaul";
import { toast } from "sonner";
import { ArrowLeft, ChevronRight, ClipboardList, Minus, Plus, Trash2 } from "lucide-react";
import { useListaMedica, type ItemLista } from "@/hooks/useListaMedica";
import { SelectorFarmacia } from "./SelectorFarmacia";

interface ListaMedicaDrawerProps {
  abierta: boolean;
  onOpenChange: (abierta: boolean) => void;
  /** Coordenadas efectivas (geolocalización o fallback Acarigua). */
  lat: number;
  lng: number;
}

type Vista = "lista" | "farmacias";

export function ListaMedicaDrawer({ abierta, onOpenChange, lat, lng }: ListaMedicaDrawerProps) {
  const { lista, cambiarCantidad, quitar, restaurar } = useListaMedica();
  const [vista, setVista] = useState<Vista>("lista");

  // Cada vez que se abre, arranca en la vista de la lista
  useEffect(() => {
    if (abierta) setVista("lista");
  }, [abierta]);

  const handleQuitar = (item: ItemLista) => {
    const quitado = quitar(item.medicamentoId);
    if (!quitado) return;
    toast(`${item.nombre} eliminado de tu lista`, {
      action: {
        label: "Deshacer",
        onClick: () => restaurar(quitado.item, quitado.indice),
      },
      duration: 5000,
    });
  };

  return (
    <Drawer.Root open={abierta} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-black/40" />
        <Drawer.Content
          className="fixed inset-x-0 bottom-0 z-50 flex max-h-[88dvh] flex-col rounded-t-3xl bg-background outline-none"
          aria-describedby={undefined}
        >
          {/* Asa del drawer */}
          <div className="mx-auto mt-3 h-1.5 w-10 shrink-0 rounded-full bg-border" aria-hidden />

          {vista === "lista" ? (
            <>
              <div className="shrink-0 px-5 pb-2 pt-3">
                <Drawer.Title className="text-lg font-bold text-foreground">
                  Tu lista médica
                </Drawer.Title>
                <p className="text-xs text-muted-foreground">
                  Se guarda en este dispositivo, sin registro.
                </p>
              </div>

              {lista.length === 0 ? (
                <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
                  <ClipboardList className="h-10 w-10 text-muted-foreground/50" aria-hidden />
                  <p className="font-medium text-foreground">Tu lista está vacía</p>
                  <p className="max-w-xs text-sm text-muted-foreground">
                    Busca un medicamento y toca "Añadir a mi lista" para empezar.
                  </p>
                </div>
              ) : (
                <>
                  <ul className="min-h-0 flex-1 divide-y divide-border overflow-y-auto px-5">
                    {lista.map((item) => (
                      <li key={String(item.medicamentoId)} className="flex items-center gap-3 py-3.5">
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium leading-snug text-foreground">
                            {item.nombre}
                            {item.marcaComercial && (
                              <span className="ml-1 text-sm font-normal text-muted-foreground">
                                ({item.marcaComercial})
                              </span>
                            )}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">{item.presentacion}</p>
                        </div>

                        {/* Stepper de cantidad */}
                        <div className="flex shrink-0 items-center rounded-full border border-border">
                          <button
                            type="button"
                            onClick={() => cambiarCantidad(item.medicamentoId, -1)}
                            disabled={item.cantidad <= 1}
                            aria-label={`Reducir cantidad de ${item.nombre}`}
                            className="flex h-9 w-9 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted disabled:opacity-30"
                          >
                            <Minus className="h-4 w-4" aria-hidden />
                          </button>
                          <span className="w-6 text-center text-sm font-semibold tabular-nums">
                            {item.cantidad}
                          </span>
                          <button
                            type="button"
                            onClick={() => cambiarCantidad(item.medicamentoId, 1)}
                            aria-label={`Aumentar cantidad de ${item.nombre}`}
                            className="flex h-9 w-9 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted"
                          >
                            <Plus className="h-4 w-4" aria-hidden />
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleQuitar(item)}
                          aria-label={`Eliminar ${item.nombre} de tu lista`}
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-red-50 hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden />
                        </button>
                      </li>
                    ))}
                  </ul>

                  <div className="shrink-0 border-t border-border px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3">
                    <button
                      type="button"
                      onClick={() => setVista("farmacias")}
                      className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground transition-all hover:opacity-90 active:scale-[0.99]"
                    >
                      Elegir farmacia y contactar
                      <ChevronRight className="h-5 w-5" aria-hidden />
                    </button>
                  </div>
                </>
              )}
            </>
          ) : (
            <>
              <div className="flex shrink-0 items-center gap-2 px-3 pb-2 pt-3">
                <button
                  type="button"
                  onClick={() => setVista("lista")}
                  aria-label="Volver a tu lista"
                  className="flex h-10 w-10 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted"
                >
                  <ArrowLeft className="h-5 w-5" aria-hidden />
                </button>
                <div className="min-w-0">
                  <Drawer.Title className="text-lg font-bold text-foreground">
                    ¿A cuál farmacia contactamos?
                  </Drawer.Title>
                  <p className="text-xs text-muted-foreground">
                    Ordenadas por cuántos de tus medicamentos tienen.
                  </p>
                </div>
              </div>
              <SelectorFarmacia lista={lista} lat={lat} lng={lng} />
            </>
          )}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

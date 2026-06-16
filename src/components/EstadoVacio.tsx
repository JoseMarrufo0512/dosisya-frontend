import { PackageSearch } from "lucide-react";

export function EstadoVacio() {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
      <div className="grid h-16 w-16 place-items-center rounded-full bg-accent">
        <PackageSearch className="h-8 w-8 text-primary" />
      </div>
      <p className="mt-4 max-w-xs text-balance text-sm text-muted-foreground">
        No encontramos ese medicamento cerca. Intenta ampliar el radio o buscar el principio activo genérico.
      </p>
    </div>
  );
}

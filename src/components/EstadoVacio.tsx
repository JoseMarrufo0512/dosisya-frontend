interface EstadoVacioProps {
  termino: string;
}

export function EstadoVacio({ termino }: EstadoVacioProps) {
  const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(termino)}`;

  return (
    <div className="py-12 text-center text-muted-foreground">
      <div className="mb-4 flex justify-center text-6xl" aria-hidden="true">
        💊
      </div>
      <h3 className="mb-2 break-words text-lg font-medium text-foreground">
        No encontramos “{termino}” cerca de ti
      </h3>
      <p className="mx-auto mb-6 max-w-sm text-sm">
        Prueba con el nombre genérico, amplía el radio de búsqueda, o verifica el
        nombre del medicamento.
      </p>
      <a
        href={searchUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center justify-center rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        ¿Escribiste bien el nombre?
      </a>
    </div>
  );
}

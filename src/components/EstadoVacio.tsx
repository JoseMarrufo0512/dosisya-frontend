interface EstadoVacioProps {
  termino: string;
}

export function EstadoVacio({ termino }: EstadoVacioProps) {
  const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(termino)}`;

  return (
    <div className="text-center py-12 text-gray-500">
      <div className="text-6xl mb-4 text-gray-300 flex justify-center">
        💊
      </div>
      <h3 className="text-lg font-medium text-gray-900 mb-2">
        No encontramos '{termino}' cerca de ti
      </h3>
      <p className="text-sm mb-6 max-w-sm mx-auto">
        Prueba con el nombre genérico, amplía el radio de búsqueda, o verifica el nombre del medicamento.
      </p>
      <a
        href={searchUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center justify-center border border-gray-200 rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
      >
        ¿Escribiste bien el nombre?
      </a>
    </div>
  );
}

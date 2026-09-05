import { createFileRoute } from "@tanstack/react-router";
import App from "@/App";

export const Route = createFileRoute("/buscar")({
  head: () => ({
    meta: [
      { title: "Buscar medicamentos — DosisYa" },
      {
        name: "description",
        content:
          "Busca medicamentos en farmacias cercanas en Acarigua y Araure. Compara precios en USD y Bs., y contacta por WhatsApp al instante. Sin registro.",
      },
    ],
  }),
  component: Buscar,
});

function Buscar() {
  return <App />;
}

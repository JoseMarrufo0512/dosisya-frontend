import { createFileRoute } from "@tanstack/react-router";
import App from "@/App";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "DosisYa — Encuentra tu medicamento cerca de ti" },
      {
        name: "description",
        content:
          "Busca medicamentos en farmacias cercanas en Venezuela. Compara precios en USD y Bs., y contacta por WhatsApp al instante.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  return <App />;
}

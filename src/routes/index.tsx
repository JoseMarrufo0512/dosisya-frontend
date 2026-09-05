import { createFileRoute } from "@tanstack/react-router";
import { LandingPage } from "@/components/landing/LandingPage";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "DosisYa — Marketplace farmacéutico hiperlocal" },
      {
        name: "description",
        content:
          "DosisYa conecta pacientes con farmacias en Acarigua y Araure. Busca medicamentos sin registrarte, o registra tu farmacia y recibe contactos por WhatsApp.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  return <LandingPage />;
}

import { Landmark } from "lucide-react";
import { EnConstruccionSection } from "./EnConstruccionSection";

export function CreditiendasSection() {
  return (
    <EnConstruccionSection
      id="creditiendas"
      etiqueta="Creditiendas"
      icono={Landmark}
      titulo="Creditiendas: el modelo de crédito para farmacias en desarrollo"
      descripcion="Creditiendas es la propuesta de DosisYa para ayudar a las farmacias afiliadas a financiar reposición de inventario. Todavía estamos definiendo condiciones y aliados financieros — cuéntanos qué necesita tu farmacia y lo tenemos en cuenta en el diseño."
      mensajeWhatsApp="Hola, quiero más información sobre Creditiendas de DosisYa."
    />
  );
}

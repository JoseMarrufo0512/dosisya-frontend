import { Users } from "lucide-react";
import { EnConstruccionSection } from "./EnConstruccionSection";

export function GremioSection() {
  return (
    <EnConstruccionSection
      id="gremio"
      etiqueta="Gremio"
      icono={Users}
      titulo="Construyendo puentes con el gremio farmacéutico"
      descripcion="Queremos que colegios de farmacéuticos, asociaciones y cámaras del sector en Portuguesa formen parte de la conversación sobre DosisYa. Si representas a un gremio o asociación, nos encantaría escucharte."
      mensajeWhatsApp="Hola, represento a un gremio/asociación del sector farmacéutico y quiero conversar sobre DosisYa."
      fondo="var(--blanco)"
    />
  );
}

import { FlaskConical } from "lucide-react";
import { EnConstruccionSection } from "./EnConstruccionSection";

export function ProductoresSection() {
  return (
    <EnConstruccionSection
      id="productores"
      etiqueta="Productores"
      icono={FlaskConical}
      titulo="Un canal directo entre laboratorios y farmacias hiperlocales"
      descripcion="Estamos diseñando cómo laboratorios y distribuidores pueden conectarse con la red de farmacias afiliadas a DosisYa en Acarigua y Araure. Si representas a un productor y quieres ayudarnos a definir esta sección, escríbenos."
      mensajeWhatsApp="Hola, represento a un laboratorio/distribuidor y quiero conversar sobre DosisYa para Productores."
      fondo="var(--blanco)"
    />
  );
}

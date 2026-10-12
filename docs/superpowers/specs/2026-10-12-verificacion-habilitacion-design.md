# Verificación de habilitación sanitaria (B-02, fase 1)

> Spec de diseño · 2026-10-12
> Cierra la parte declarativa del hallazgo B-02. Los documentos son fase 2.

## 1. Problema

El registro pide RIF y valida únicamente su **formato** (`/^[JVEGP]-\d{8}-\d$/`) y que no esté
repetido en la base propia. No existe en ningún lado del esquema un campo de permiso sanitario, de
licencia de funcionamiento, ni de farmacéutico regente.

La consecuencia práctica: cualquiera con un RIF bien formateado puede publicar inventario de
medicamentos en la plataforma y recibir pacientes. DosisYa no vende, pero sí **dirige** pacientes a
un establecimiento y cobra por hacerlo; eso coloca responsabilidad sobre quién entra al directorio.

## 2. Fundamento

Investigación sobre normativa venezolana, con la advertencia de siempre: **esto no es asesoría
legal**, son fuentes públicas interpretadas por quien escribe, que no es abogado. Un abogado
venezolano debe confirmarlo antes de operar.

- **Farmacéutico regente**, obligatorio. Debe estar inscrito y **solvente** en el Colegio de
  Farmacéuticos de su entidad **y** en el Instituto Nacional de Higiene. Su contrato, sellado por
  el Ministerio del Trabajo y el Colegio, debe reposar físicamente en el establecimiento.
- **Autorización de funcionamiento del SACS** (Servicio Autónomo de Contraloría Sanitaria,
  Ministerio de Salud): es quien autoriza que una farmacia opere.
- **Ninguna persona puede ser regente de más de un establecimiento farmacéutico.**

Fuentes: [Reglamento de la Ley de Ejercicio de la Farmacia (CAVEFAR)](https://cavefar.org.ve/wp-content/uploads/2025/07/REFORMA-DEL-REGLAMENTO-LEY-DE-EJERCICIO-DE-LA-FARMACIA.pdf)
y [AVEDEFAR sobre regentes nominales](https://avedefar.blogspot.com/2016/01/la-regencia-de-los-establecimientos.html).

La regla del regente único es la pieza más aprovechable de todo esto: es la **única que el sistema
puede hacer cumplir solo**, sin depender de que nadie revise nada, y ataca directamente el fraude
del «regente de alquiler» que describe AVEDEFAR.

Detalle que valida trabajo anterior: el regente es específicamente el responsable de los
**psicotrópicos y estupefacientes con récipe de control estricto**, lo que respalda la decisión 5
de la spec de B-03 (excluirlos de la búsqueda pública).

## 3. Alcance

B-02 completo son cuatro piezas. Solo una necesita infraestructura que no existe:

| Pieza | ¿Infra nueva? | Fase |
|---|---|---|
| Capturar datos del regente y del permiso SACS | no | **1** |
| Un regente, un establecimiento | no | **1** |
| Convertir la aprobación en verificación | no | **1** |
| Subir y almacenar los documentos | **sí, desde cero** | 2 |

Las tres de fase 1 tienen dientes sin la cuarta: el superadmin puede contrastar la colegiatura
contra el Colegio, la unicidad se hace cumplir sola, y obligar a la farmacia a **declarar** un dato
falsificable cambia dónde cae la responsabilidad.

Verificado al explorar: **no existe ninguna infraestructura de archivos en el backend.** Guardar un
PDF significa elegir proveedor, políticas de acceso y retención de documentos que contienen datos
personales de un tercero (el regente). Es una spec entera por sí sola.

## 4. Decisiones tomadas

| # | Decisión | Por qué, y qué se descartó |
|---|---|---|
| 1 | **Fase 1 sin documentos** | Entrega la mayor parte del valor sin montar almacenamiento. Se descartó hacerlo todo de una vez (una spec entera de más) y limitarse a la unicidad (deja sin tocar el SACS, que es lo que autoriza a operar) |
| 2 | **Opcionales al registrarse, obligatorios para aprobar** | Registrarse nunca se bloquea —no se pierde la afiliación—, pero el backend **rechaza** pasar a `activa` sin los datos. Se descartó exigirlos en el registro (quien rellena de noche sin el número a mano abandona, y contradice la postura ya tomada con `lat`/`lng`) y el mero aviso al superadmin (deja la puerta abierta a publicar sin ningún dato, que es el hallazgo) |
| 3 | **Dos confirmaciones separadas, registradas** | Son dos trabajos distintos contra dos organismos distintos. Una sola casilla se marca sin leer — el riesgo de consentimiento reflejo que ya se discutió en B-04. Se descartó una confirmación única y no pedir nada |
| 4 | **La colisión de regente deja registrarse y bloquea aprobar** | Coherente con la decisión 2. Un regente que **cambia de farmacia** es un caso legítimo, no fraude: si la anterior sigue registrada, el número colisiona sin que nadie haya hecho nada malo. Se descartó bloquear desde el registro (le cierra la puerta a una farmacia legítima que no puede resolverlo sola) y solo avisar (permitiría publicar dos farmacias con el mismo regente, justo lo que la regla existe para impedir) |

## 5. Dónde viven los datos, y una restricción que obligó a cambiar el modelo

La intención inicial era una tabla `farmacias_habilitacion` aparte, para no ensanchar `farmacias`.
**No se puede:** el índice `UNIQUE` parcial necesita filtrar por `estado_afiliacion`, y un índice
parcial no puede referenciar otra tabla. Los datos van como columnas de `farmacias`, que además es
el patrón que el esquema ya usa (`idx_farmacias_rif ... WHERE rif IS NOT NULL`).

### Migración 013

```sql
ALTER TABLE farmacias
  ADD COLUMN regente_nombre           VARCHAR(200),
  ADD COLUMN regente_colegiatura      VARCHAR(50),
  ADD COLUMN regente_colegio_entidad  VARCHAR(100),
  ADD COLUMN regente_inh              VARCHAR(50),
  ADD COLUMN sacs_autorizacion        VARCHAR(100),
  ADD COLUMN sacs_fecha               DATE,
  ADD COLUMN regente_verificado_por   UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  ADD COLUMN regente_verificado_en    TIMESTAMPTZ,
  ADD COLUMN sacs_verificado_por      UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  ADD COLUMN sacs_verificado_en       TIMESTAMPTZ;

CREATE UNIQUE INDEX uq_regente_un_establecimiento
    ON farmacias (lower(regente_colegiatura))
    WHERE regente_colegiatura IS NOT NULL
      AND estado_afiliacion = 'activa';
```

**El índice cubre solo `activa`, y es deliberado.** Si cubriera todas las no-inactivas, el `INSERT`
del registro fallaría ante una colisión y **bloquearía registrarse**, contradiciendo la decisión 4.
Cubriendo solo `activa`: dos farmacias `pendiente` pueden declarar el mismo regente sin problema, y
lo que falla es la transición a `activa` — exactamente donde debe fallar.

`lower()` en el índice porque un número de colegiatura puede traer letra de entidad y nadie
escribe las mayúsculas igual dos veces.

## 6. Dónde se capturan los datos

Lo evidente sería un cuarto paso en el wizard de registro. **Esta spec no lo propone**, por dos
razones concretas:

1. El wizard se vende como *«Solo 3 pasos · te toma menos de 2 minutos»*. Un paso de datos
   regulatorios rompe esa promesa, y la conversión del registro B2B es el cuello de botella del
   negocio.
2. Pide datos que el dueño probablemente no tiene a mano en el momento de registrarse.

En su lugar, los campos van en **Configuración del panel**, que ya existe y ya hace
`PATCH /api/v1/farmacias/{id}`. La farmacia se registra en dos minutos y el panel le dice qué le
falta para publicarse — exactamente el patrón que ya se usa con la ubicación.

**Cero cambios en el wizard de registro.**

## 7. El gate de aprobación

Los **seis campos obligatorios para aprobar** son, sin ambigüedad:
`regente_nombre`, `regente_colegiatura`, `regente_colegio_entidad`, `regente_inh`,
`sacs_autorizacion` y `sacs_fecha`. Los cuatro de verificación (`*_verificado_por`,
`*_verificado_en`) los escribe el sistema, no la farmacia.

`PATCH /api/v1/admin/farmacias/{farmacia_id}/estado` con `estado_afiliacion = 'activa'` los exige,
comprobando en este orden:

| Condición | Respuesta |
|---|---|
| Falta cualquiera de esos seis | **422**, nombrando cuáles |
| Existe otra farmacia `activa` con esa colegiatura | **409**, nombrando cuál es |
| `verificacion_regente` o `verificacion_sacs` no vienen en `true` | **422** |

Al aprobar con éxito, sella las cuatro columnas de verificación con el id del superadmin del token
y `now()`.

Los otros estados (`inactiva`, `pendiente`) **no** exigen nada: suspender o devolver a pendiente
tiene que seguir siendo posible siempre, incluso para una farmacia con datos incompletos.

El chequeo de conflicto se hace **antes** de intentar el `UPDATE`, para devolver un 409 con el
nombre de la otra farmacia en vez de una violación de constraint que no le dice nada a nadie. El
índice sigue siendo la garantía real ante una carrera entre dos aprobaciones simultáneas.

## 8. Lo que ve el superadmin

Dos booleanos calculados nuevos en `GET /api/v1/admin/farmacias`, siguiendo el patrón de
`ubicacion_configurada`:

- **`habilitacion_completa`** — los seis campos presentes.
- **`conflicto_regente`** — hay otra farmacia `activa` con la misma colegiatura. Trae el nombre de
  la otra, para que el conflicto se resuelva sin salir del panel.

Las dos confirmaciones van como casillas separadas en
[`src/components/super/EditarFarmaciaDrawer.tsx`](../../../src/components/super/EditarFarmaciaDrawer.tsx),
que es donde el superadmin ya cambia el estado de una farmacia. Si la verificación ya se hizo, el
drawer muestra quién la hizo y cuándo en lugar de las casillas.

Los dos booleanos nuevos se pintan en
[`src/components/super/TablaFarmacias.tsx`](../../../src/components/super/TablaFarmacias.tsx),
junto a `ubicacion_configurada`, que ya está ahí.

## 9. Pruebas

**Backend, cobertura real:** 422 sin campos (y que diga cuáles), 409 con conflicto (y que nombre la
otra farmacia), 422 sin las dos confirmaciones, éxito que sella las cuatro columnas, y que
suspender o devolver a pendiente **no** exija nada.

**Contra la base real**, porque los tests mockean la conexión y no cubren el SQL — el caso que más
importa es el que distingue este diseño del obvio: **dos farmacias `pendiente` con el mismo regente
deben poder coexistir**, y la segunda debe fallar solo al pasar a `activa`.

**Frontend:** el formulario del panel no tiene tests de componente (sin `@testing-library`). `tsc`,
build y navegador.

## 10. Fuera de alcance, a propósito

- **Los documentos.** Fase 2, con su propia spec: proveedor de almacenamiento, políticas de acceso
  y retención de documentos con datos personales de un tercero.
- **Verificación automática contra el Colegio o el SACS.** No se conoce ninguna API pública; sería
  investigación aparte.
- **El wizard de registro.** Ver §6.

## 11. Lo que esto NO cierra

**La verificación sigue siendo declarativa.** El superadmin confirma que contrastó la colegiatura y
el permiso; no se prueba que lo hiciera. Es mucho mejor que un botón —obliga a detenerse en cada
ítem y deja rastro de quién respondió por ello— y **no es todavía verificación documental**, que es
lo que el hallazgo B-02 pide literalmente.

B-02 queda abierto hasta la fase 2.

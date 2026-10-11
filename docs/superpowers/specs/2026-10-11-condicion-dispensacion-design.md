# Condición de dispensación (hallazgo B-03)

> Spec de diseño · 2026-10-11
> Cierra el hallazgo B-03 de la auditoría de lanzamiento: el catálogo no distingue qué
> medicamentos son de venta bajo récipe, ni separa controlados y psicotrópicos.

## 1. Problema

Hoy no existe ningún campo `requiere_receta` ni clasificación de controlados en ninguna tabla.
Todo producto se trata igual: se muestra, se añade a la Lista Médica y se contacta a la farmacia
con el mismo flujo. El escáner de récipe procesa prescripciones reales, así que el producto toca
el mundo de la prescripción, pero el catálogo no lo distingue.

Detalle revelador: la paleta de la app ya reserva `--ambar-receta` con el comentario
*«Aviso: requiere récipe»*. La intención estaba desde el diseño; el dato nunca se modeló.

## 2. Encuadre: esto informa, no restringe

**El losartán es de venta bajo récipe en Venezuela** — el medicamento que se usa en todas las
pruebas, y la mayoría de la medicación crónica, que es el caso de uso más valioso de DosisYa.
Una clasificación que escondiera o bloqueara los de récipe vaciaría el buscador.

El principio que gobierna el diseño: **solo se hace la afirmación cautelosa, nunca la
tranquilizadora.** Los errores no son simétricos. Decir «requiere récipe» cuando no lo requiere
cuesta un papel de más; decir «venta libre» cuando sí lo requiere cuesta un traslado en falso y
una farmacia que no puede despachar.

## 3. Decisiones tomadas

| # | Decisión | Alternativas descartadas |
|---|---|---|
| 1 | **Insignia + marcador en el mensaje de WhatsApp. No se bloquea nada.** | Solo insignia (desperdicia el único punto donde el aviso llega al farmacéutico); puerta blanda con confirmación (fricción contra la filosofía Cero Fricción); puerta dura ocultando de la búsqueda (vaciaría el catálogo) |
| 2 | **Tabla curada por principio activo**, validada por un farmacéutico | IA clasificando en cada carga (un atributo legal decidido por IA, e inconsistente entre CSV); híbrido con cola de revisión (buen destino final, caro como primer paso); la farmacia declarándolo (nadie lo llenaría) |
| 3 | **Alcance: el subconjunto ambulatorio** de los principios activos ya cargados (~150-200 de 422) | Solo los ~15 del inventario real (la cobertura se derrumba al entrar una farmacia real); los 422 completos (validación farmacéutica sobre productos que ninguna farmacia afiliada listará) |
| 4 | **Desconocido = sin insignia**, y nunca afirmar «venta libre» | Insignia neutra de cautela (con la tabla incompleta casi toda tarjeta la llevaría y dejaría de leerse); insignia en los dos extremos (nos haría afirmar «venta libre», la dirección en la que el error hace daño) |
| 5 | **Controlados: modelar la categoría y excluirlos de la búsqueda** hasta tener criterio legal. No es hipotético: `Morfina` y `Morfina sulfato` ya están en el catálogo y hoy son visibles en la búsqueda pública | Insignia distinta pero visibles (dirigir pacientes a controlados sin confirmar que se puede); tratarlos como cualquier récipe (borra una distinción que la normativa sí hace) |

## 4. Restricciones descubiertas (verificadas, no supuestas)

Cuatro hechos del sistema real que condicionan el diseño:

1. **El catálogo es compartido.** `inventario_maestro` tiene única `(principio_activo,
   marca_comercial, presentacion)` y crece desde los CSV de cada farmacia. La clasificación va
   una sola vez por molécula y cubre todas las marcas y presentaciones.

2. **15 pares del catálogo son el mismo principio activo escrito distinto.** Medido sobre los
   422: `Ácido acetilsalicílico` y `Ácido Acetilsalicílico` (la constraint única no lo atajó
   porque es sensible a mayúsculas), `Amiodarona` y `Amiodarona clorhidrato`, `Hidrocortisona` y
   `Hidrocortisona succinato sódico`. La lista completa y verificada está en §9. Un emparejamiento
   por texto plano los pierde **en silencio**, y una insignia de seguridad que falta en silencio
   es el peor resultado posible.

   Dos casos que el canon **no** unifica y hay que resolver en la tabla, no en la función:
   `Diclofenac` frente a `Diclofenaco` (variante del INN, no una sal) y
   `Amoxicilina + Ácido clavulánico` frente a `Amoxicilina y ácido clavulánico` (el mismo combo
   con distinto conector). En ambos se insertan las dos raíces con la misma condición — ver la
   limitación conocida en §9.

3. **`unaccent` es `STABLE`, no `IMMUTABLE`.** Postgres no permite indexar una expresión que la
   use directamente; hace falta un envoltorio declarado `IMMUTABLE`.

4. **Hay carritos en `localStorage`** armados antes de esta feature, sin el campo nuevo. La
   lectura tiene que tolerarlos — patrón que `ItemLista` ya usa para `origen` y `farmaciaId`.

## 5. Modelo de datos — migración 010

```sql
CREATE TYPE condicion_dispensacion_enum AS ENUM ('libre','receta','controlado');

-- Envoltorio IMMUTABLE sobre unaccent (que es STABLE y no se puede indexar).
-- Se usa la forma de dos argumentos con el diccionario fijado explícitamente.
CREATE OR REPLACE FUNCTION canon_principio(texto text) RETURNS text
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE AS $$
  SELECT regexp_replace(
           regexp_replace(
             lower(unaccent('public.unaccent'::regdictionary, trim(texto))),
             '\s+(succinato|fosfato|benzoato|besilato)?\s*(sodico|sodica|potasico|potasica|calcico|clorhidrato|hcl|maleato|lactato|tartrato|sulfato|acetato|mesilato|dipropionato|valerato|trihidratada|anhidro|base o trihidratada)$',
             ''),
           '\s+', ' ', 'g')
$$;

-- El grupo opcional de sal compuesta (`succinato sódico`, `fosfato sódico`) es
-- obligatorio: con sales simples en una sola pasada el regex colapsa 12 de los
-- 15 pares reales del catálogo — medido, no estimado. Y el regex va en UN solo
-- literal: Postgres concatena literales en líneas distintas, pero es una
-- sutileza que rompe migraciones en silencio.

CREATE TABLE principios_activos_dispensacion (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    principio_canonico  TEXT NOT NULL UNIQUE,   -- ya pasado por canon_principio()
    etiqueta            VARCHAR(255) NOT NULL,  -- legible, para el panel súper admin
    condicion           condicion_dispensacion_enum NOT NULL,
    ambulatorio         BOOLEAN NOT NULL DEFAULT true,
    fuente              TEXT,
    validado_por        VARCHAR(200),
    validado_en         TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_inv_maestro_canon
    ON inventario_maestro (canon_principio(principio_activo));

CREATE TRIGGER trg_pad_updated_at
    BEFORE UPDATE ON principios_activos_dispensacion
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
```

**Por qué tabla aparte y no una columna en `inventario_maestro`:** una fila por molécula cubre
todas sus marcas y presentaciones, y una entrada nueva llegada de un CSV queda clasificada sin
trabajo extra. `fuente` y `validado_por` responden «¿de dónde salió esta insignia?» cuando una
farmacia reclame.

**Caveat del envoltorio `IMMUTABLE`:** declarar inmutable algo que depende de un diccionario es
el truco documentado y lo que hace todo el mundo, pero es una promesa hecha a Postgres. Si el
diccionario `unaccent` cambiara, habría que reindexar. Queda dicho a propósito.

Hay que reflejar los cambios en `db/schema.sql`, que es la fuente canónica del esquema.

## 6. Backend

### 6.1 Búsqueda — `src/dosisya/routers/medicamentos.py`

En `_BUSCAR_MEDICAMENTOS` y en la query del endpoint de detalle:

```sql
LEFT JOIN principios_activos_dispensacion pad
       ON pad.principio_canonico = canon_principio(im.principio_activo)
```

Se añade `pad.condicion::TEXT AS condicion_dispensacion` al SELECT, y al WHERE:

```sql
AND pad.condicion IS DISTINCT FROM 'controlado'
```

`IS DISTINCT FROM` es la pieza clave: con `NULL` evalúa verdadero, así que **lo desconocido sigue
visible**, que es la decisión 4. Con `pad.condicion IS NULL OR pad.condicion <> 'controlado'`
el resultado sería el mismo pero más frágil ante un refactor.

### 6.2 Detalle de producto

El mismo filtro. Un controlado accedido por URL directa responde **404**, por coherencia con la
búsqueda: si no se lista, no se sirve.

### 6.3 Contrato de API

Un campo nuevo por resultado:

```
condicion_dispensacion: "libre" | "receta" | null
```

`"controlado"` nunca llega al cliente porque se filtra en SQL. El tipo del frontend no lo incluye.

## 7. Frontend

| Archivo | Cambio |
|---|---|
| `src/lib/api.ts` | Campo `condicion_dispensacion` en `ResultadoFarmacia` |
| `src/components/BadgeReceta.tsx` | **Nuevo.** Patrón de `BadgePremium`, con `--ambar-receta` sobre `--ambar-fondo` |
| `src/components/TarjetaResultado.tsx` | Insignia junto a la presentación |
| `src/components/lista/ListaMedicaDrawer.tsx` | Insignia en cada ítem |
| `src/components/lista/CartSummary.tsx` | Insignia en cada ítem |
| `src/hooks/useListaMedica.ts` | Campo opcional en `ItemLista`, lectura tolerante |
| `src/lib/whatsapp.ts` | Marcador en la línea del producto |
| `src/routes/producto.$farmaciaId.$medicamentoId.tsx` | Insignia en la ficha |

### 7.1 `ItemLista` — lectura tolerante

```ts
/**
 * Condición de dispensación vista al añadir. Ausente en items guardados antes
 * de esta feature y en los del escáner de récipe (sin entrada de catálogo).
 */
condicionDispensacion?: "libre" | "receta" | null;
```

Sigue la convención que el propio tipo ya usa para `origen` y `farmaciaId`. Un carrito viejo se
lee como `undefined` y no muestra insignia: coherente con la decisión 4.

### 7.2 Mensaje de WhatsApp

`construirMensajeLista` ya tiene el patrón: añade una `notaFarmaceutico` cuando hay ítems del
escáner. Se extiende de forma paralela — **marcador en la línea, sin poner palabras en boca del
paciente**:

```
Hola Farmacia San Rafael 👋 Vengo de *DosisYa* y quiero pedir:

1. Losartán Potásico · Tabletas 50mg x 30 (requiere récipe)
2. Acetaminofén · Tabletas 500mg x 20

¿Tienen disponibilidad? ¡Gracias!
```

Escribir «tengo el récipe» en el mensaje queda **descartado explícitamente**: le pondría al
paciente en la boca algo que puede no ser cierto. El marcador en la línea informa al farmacéutico;
el recordatorio para el paciente va **en `SelectorFarmacia`**, junto al botón de contactar, donde
hoy se dispara `track("farmacia_contactada")` — una línea visible antes de abrir WhatsApp, no un
toast que se pierda. Nadie afirma nada falso y ambos quedan informados.

`construirMensajeProducto` (ficha de producto) recibe el mismo marcador.

## 8. Curación y validación

El borrador va como migración **`011_seed_dispensacion.sql`, separada y sin aplicar**, con
cabecera que exige firma de un farmacéutico antes de ejecutarla, y `fuente='borrador-sin-validar'`
en todas las filas. El flag `ambulatorio` permite clasificar lo que una farmacia de barrio
dispensa y dejar marcados y fuera los hospitalarios (factores de coagulación, inmunoglobulinas,
soluciones IV, nutrición parenteral), que están en el catálogo pero ninguna farmacia afiliada va
a listar.

**Esta separación es deliberada:** el borrador lo redacta Claude, que no es farmacéutico
venezolano. Aplicarlo sin revisión convertiría suposiciones en afirmaciones regulatorias que la
app le hace a un paciente. La migración 010 (estructura) se puede aplicar sin riesgo; la 011
(datos) no.

## 9. Pruebas

**`canon_principio`** — los fixtures son los 15 pares que colapsan de verdad en el catálogo,
medidos contra producción el 2026-10-11:

| Raíz canónica | Variantes que colapsan | Qué resuelve |
|---|---|---|
| `acido acetilsalicilico` | `Ácido acetilsalicílico` · `Ácido Acetilsalicílico` | mayúsculas |
| `metformina clorhidrato` | `Metformina clorhidrato` · `Metformina Clorhidrato` | mayúsculas |
| `amiodarona` | `Amiodarona` · `Amiodarona clorhidrato` | sal simple |
| `biperideno` | `Biperideno` · `Biperideno lactato` | sal simple |
| `clindamicina` | `Clindamicina` · `Clindamicina clorhidrato` | sal simple |
| `clorfeniramina` | `Clorfeniramina` · `Clorfeniramina maleato` | sal simple |
| `gentamicina` | `Gentamicina` · `Gentamicina sulfato` | sal simple |
| `morfina` | `Morfina` · `Morfina sulfato` | sal simple |
| `propranolol` | `Propranolol` · `Propranolol clorhidrato` | sal simple |
| `verapamilo` | `Verapamilo` · `Verapamilo clorhidrato` | sal simple |
| `diclofenac` | `Diclofenac` · `Diclofenac sódico` | sal simple |
| `diclofenaco` | `Diclofenaco` · `Diclofenaco sódico` | sal simple |
| `dexametasona` | `Dexametasona` · `Dexametasona fosfato sódico` | sal compuesta |
| `hidrocortisona` | `Hidrocortisona` · `Hidrocortisona succinato sódico` | sal compuesta |
| `amoxicilina` | `Amoxicilina` · `Amoxicilina base o trihidratada` | sufijo descriptivo |

**Limitación conocida, asumida a propósito:** `diclofenac` y `diclofenaco` siguen siendo dos
raíces distintas. La función normaliza mayúsculas, acentos y sales, pero no variantes de escritura
del INN mismo. No hace falta maquinaria de alias para resolverlo: la tabla curada admite **las dos
raíces con la misma condición**, que es más simple y más explícito que inventar un mecanismo de
sinónimos. Lo mismo aplicará a cualquier variante futura que traiga un CSV.

**Backend** — un controlado no aparece en la búsqueda ni en el detalle (404); un desconocido sí
aparece y devuelve `null`; uno de récipe devuelve `"receta"`; el `LEFT JOIN` no duplica filas
cuando hay varias presentaciones del mismo principio activo.

**Frontend** — la insignia se pinta solo con `"receta"`; un `ItemLista` sin el campo no rompe el
carrito ni pinta insignia; el marcador aparece en el mensaje solo cuando hay al menos un ítem de
récipe.

## 10. Fuera de alcance, a propósito

- **Insignia en los resultados del escáner de récipe.** Esos ítems llevan ids sintéticos sin
  entrada de catálogo, así que no hay nada que emparejar. Entra cuando el endpoint de IA resuelva
  el nombre extraído contra el catálogo.
- **Cola de revisión con propuestas de IA** para principios activos fuera de la tabla.
- **Insignia positiva de «venta libre».** Descartada por la decisión 4, no por falta de tiempo.
- **Panel del súper admin para editar la tabla.** Por ahora se edita por SQL; se justifica cuando
  haya que reclasificar con frecuencia.

## 11. Deuda que este trabajo destapó

No es parte de esta spec. Se anota para que no se pierda.

- **La migración 006 nunca se aplicó y además está rota.** Promete tres índices
  (`idx_inventario_principio_unaccent_trgm`, `idx_inventario_marca_unaccent_trgm`,
  `idx_inventario_principio_unaccent_lower`) que **no existen en producción**, y habría fallado al
  crearlos porque `unaccent` es `STABLE`. Consecuencia actual: la búsqueda aplica `unaccent()` en
  runtime sobre columnas sin índice funcional, o sea escaneo completo en cada búsqueda. Con 533
  filas no se nota; con el catálogo de una farmacia real, sí. El envoltorio `canon_principio` de
  esta spec es la pieza que también arregla 006.
- **Supabase solo registra las migraciones 008 y 009.** Nadie sabe qué está aplicado; es la
  tercera vez que aparece una migración sin aplicar (006, y antes 008).
- **Hay una «farmacia» llamada DosisYa activa en producción** (`J-77778888-8`) con 520 items,
  entre ellos derivados sanguíneos y nutrición parenteral. Un paciente puede recibirla como
  resultado de búsqueda y ser enviado a su WhatsApp — la misma contradicción del hallazgo B-13
  («DosisYa no es una farmacia») pero en los datos. El catálogo vale la pena conservarlo:
  `inventario_maestro` es compartido y esa lista es una buena base. Lo que no vale es la ficha de
  farmacia que lo hace visible. También está activa `Farmacia Test Claude` con 0 items.
- **15 duplicados de escritura en el catálogo.** `canon_principio` los empareja para clasificar,
  pero siguen siendo filas separadas que el paciente ve como productos distintos.

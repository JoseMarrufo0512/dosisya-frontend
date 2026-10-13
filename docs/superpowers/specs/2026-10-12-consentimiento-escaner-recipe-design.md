# Consentimiento antes de subir un récipe

> Spec de diseño · 2026-10-12
> Parte del hallazgo B-04 de la auditoría de lanzamiento.

## 1. Problema

La foto de un récipe es un **dato de salud identificable**: lleva el nombre del paciente, el del
médico y el tratamiento. Hoy el paciente toca la zona de cámara, elige la foto y la imagen sale
hacia nuestro servidor y hacia Google Gemini **sin ningún paso intermedio**.

Verificado en el código: `procesarImagen` valida el archivo, genera el preview y llama a
`analizarRecipe(file)` de inmediato. Y `grep -rn "acepto\|consentimiento"` sobre `src/` devuelve
**cero coincidencias**: no existe ningún mecanismo de consentimiento en toda la aplicación.

## 2. Fundamento

Venezuela **no tiene una ley integral de protección de datos**. El marco es constitucional y
jurisprudencial:

- Constitución, artículo 28 (habeas data) y artículo 60 (privacidad).
- Ley Orgánica del TSJ (Gaceta Oficial 6.684, enero 2022), artículos 167–178.
- La Sala Constitucional ha establecido que el tratamiento exige **consentimiento previo, libre,
  informado, explícito y revocable**.

Fuentes consultadas: [Espacio Público](https://espaciopublico.ong/en-venezuela-se-regula-la-proteccion-de-datos-personales/)
y [Badell & Grau sobre el criterio del TSJ](https://badellgrau.com/sala-constitucional-del-tsj-establecio-el-habeas-data-como-mecanismo-para-la-proteccion-de-datos-personales/).

**Esto no es asesoría legal.** Son fuentes públicas interpretadas por quien escribe esta spec, que
no es abogado. Un abogado venezolano debe confirmarlo.

Un matiz que condiciona el diseño: como la imagen **no se almacena**, lo que se consiente no es una
retención sino una **transmisión a un tercero**, y esa ocurre en cada uso. Por eso «revocable» aquí
no significa «borren lo que tienen» — no hay nada que borrar — sino «no la envíen».

## 3. Decisiones tomadas

| # | Decisión | Por qué, y qué se descartó |
|---|---|---|
| 1 | **Ambos escáneres**: el del paciente y el del panel de farmacia | El del panel es el caso más expuesto: el titular del dato **no está presente para consentir**. Se descartó limitarse al del paciente |
| 2 | **Consentimiento en cada subida** | Máxima solidez: cada transmisión tiene el suyo. Se descartó recordarlo (más cómodo, más débil como «previo») y una vez por sesión (límite arbitrario). **Reparo registrado:** lo que se ve siempre se deja de leer, así que el riesgo es que degenere en trámite reflejo. La decisión 3 lo mitiga |
| 3 | **Después de elegir la foto, antes de enviarla** | Es genuinamente previo —la imagen no ha salido del dispositivo— y es cuando la decisión es real: el paciente ya ve qué está por mandar. Se descartó avisar antes de abrir la cámara (se consiente en abstracto) y la casilla junto al botón (el patrón que más se marca sin leer) |
| 4 | **Solo se registra el del farmacéutico** | El paciente no tiene cuenta y la app no lo identifica a propósito; registrar su consentimiento crearía **el único rastro persistente** de su interacción. El farmacéutico ya está autenticado, así que no se crea ningún dato personal nuevo. Asimétrico a propósito, porque las dos situaciones lo son |

## 4. Arquitectura

### 4.1 Un estado nuevo, y la garantía es estructural

Ambos escáneres tienen hoy la **misma** forma: `type Estado = "idle" | "scanning" | "results" |
"error"` y un `procesarImagen` idéntico en estructura. El cambio es simétrico en los dos.

Se añade el estado `confirmando` y `procesarImagen` se parte en dos:

- **`prepararImagen(file)`** — valida, genera el `previewUrl`, pasa a `confirmando`.
  **No transmite nada.**
- **`enviarImagen()`** — solo se alcanza desde el botón de consentimiento. Hace lo que hoy hace
  `procesarImagen` desde `analizarRecipe(file)` en adelante.

Lo importante de partirlo así: la garantía no es un flag que alguien pueda olvidar comprobar, es
que **la función que transmite no es alcanzable sin pasar por el consentimiento**.

El código ya genera `previewUrl` antes de enviar; hoy solo se usa como decoración durante el
escaneo. Esta spec lo aprovecha como el contenido de la pantalla de confirmación: el paciente
decide viendo exactamente lo que va a mandar.

Cancelar revoca el `ObjectURL` y vuelve a `idle`. La foto nunca sale del dispositivo.

### 4.2 El backend también lo exige

Los dos endpoints reciben un campo nuevo obligatorio en el formulario:

- `POST /api/v1/ia/analizar-recipe` → `consentimiento: bool`
- `POST /api/v1/farmacias/{id}/ia/analizar-recipe` → `declaracion_autorizacion: bool`

Si falta o viene en `false`, **422**. Eso convierte la garantía en algo que el servidor sostiene,
no solo la interfaz.

**Qué protege y qué no, dicho con precisión:** en el endpoint del paciente, que es público y sin
cuenta, cualquier cliente puede mandar `true` — no es una barrera contra nadie malicioso. Es una
**guarda contra nuestra propia regresión**: si alguien refactoriza el escáner y se lleva por
delante la pantalla de consentimiento, la API empieza a responder 422 y se detecta de inmediato en
vez de silenciosamente. Mismo espíritu que las guardas de SQL del hallazgo B-03.

En el endpoint de la farmacia sí es una barrera real, porque va autenticado y queda registrado.

## 5. Qué dice el aviso al paciente

Para ser «informado» tiene que cubrir cinco cosas:

1. **Qué se envía** — la foto del récipe.
2. **A dónde** — al servidor de DosisYa y de ahí a Google Gemini.
3. **Para qué** — leerla y extraer los medicamentos.
4. **Qué no hacemos** — DosisYa no la guarda.
5. **Una advertencia** — un récipe suele llevar su nombre y el de su médico.

El botón dice **«Enviar para que la lean»** — ese es el texto, no un ejemplo. Nunca un «Aceptar»
genérico: el botón tiene que nombrar la acción que autoriza. El secundario dice **«Cancelar»**.

### 5.1 Límite conocido y asumido

**No se puede decir qué hace Google con la imagen, porque no lo sabemos.** Es el hallazgo
**B-05b**, abierto: el tratamiento por parte de los proveedores de IA no está documentado.

El aviso dirá lo que sabemos y **callará lo que no**, en vez de inventarlo. Eso hace que el
consentimiento sea **honesto pero incompleto**: el paciente sabrá que su récipe viaja a Google,
pero no qué hace Google con él.

Es una mejora grande sobre el estado actual —hoy no se le dice nada— y a la vez **no cierra B-04
del todo**. Cuando B-05b se resuelva, hay que volver a este texto y completarlo. Queda anotado
aquí para que no se dé por cerrado antes de tiempo.

## 6. El lado de la farmacia

Misma mecánica, más una declaración del farmacéutico antes de enviar.

**Un matiz que conviene no confundir.** El endpoint del modo farmacéutico ya está diseñado para
devolver *«NUNCA datos del paciente o del médico»*: la **respuesta** viene saneada, solo con datos
técnicos de dispensación. Eso está bien y no hay que tocarlo — pero no resuelve nada de lo que esta
spec aborda, porque **la imagen que se transmite sí lleva el nombre del paciente y el del médico**.
Lo que se sanea es lo que vuelve, no lo que va. Es justo la clase de detalle que puede dar una
falsa sensación de que el problema ya estaba cubierto.

**El texto exacto de esa declaración va marcado como pendiente de revisión legal.** No corresponde
a esta spec decidir cuál es la base de tratamiento cuando el paciente no está presente: si es el
deber profesional del regente, si es una autorización que el paciente dio verbalmente, o ambas. Se
sigue el mismo patrón que la migración 011 de B-03: se construye el mecanismo, el contenido
jurídico espera firma.

Lo que sí se decide aquí es la **forma**, para que no quede a interpretación: en el mismo punto del
flujo que en el escáner del paciente, una **casilla** que el farmacéutico debe marcar (con el texto
pendiente de abogado) y, solo entonces, un botón **«Enviar para analizar»** que hasta ese momento
está deshabilitado. Dos actos, no uno — a diferencia del paciente, aquí quien actúa no es el
titular del dato, y la casilla obliga a detenerse a leer qué está declarando.

### 6.1 El registro

Migración **012**, tabla mínima:

```sql
CREATE TABLE consentimientos_recipe (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    farmacia_id  UUID        NOT NULL REFERENCES farmacias(id) ON DELETE CASCADE,
    fecha_hora   TIMESTAMPTZ NOT NULL DEFAULT now(),
    ip_origen    INET
);

CREATE INDEX idx_consentimientos_farmacia_fecha
    ON consentimientos_recipe (farmacia_id, fecha_hora DESC);
```

Deliberadamente **no** guarda nada del paciente ni del récipe: ni la imagen, ni los medicamentos
extraídos, ni ningún identificador del titular. Solo quién declaró y cuándo.

El endpoint ya tiene `verify_token` y autorización por recurso, así que el registro se escribe
dentro de la petición que ya existe. No hace falta un endpoint nuevo ni un viaje extra, y queda
atómico: no se puede escanear sin que quede registrado.

## 7. Fuera de alcance, a propósito

- **El chat IA** también manda a Gemini texto que escribe el paciente. Queda fuera: es texto que la
  persona redacta voluntariamente en una conversación, no un documento de salud que sube. Merece su
  propia decisión, no arrastrarse en esta.
- **El texto legal de las páginas de términos y privacidad.** Sigue necesitando abogado, entidad
  legal y un dominio para el correo de contacto. Esta spec cubre la *sustancia* que ese texto
  debería respaldar, no el texto.
- **Un panel para que la farmacia consulte sus consentimientos registrados.** La tabla existe y es
  consultable por SQL; una interfaz se justifica cuando alguien la pida.

## 8. Pruebas, sin maquillaje

**La garantía estructural no se puede testear en este repo.** Que no haya transmisión sin
consentimiento es flujo de componente, y no hay `@testing-library` — los archivos de test del
frontend son todos lógica pura. Se verifica leyendo el código y en el navegador. No se van a
inventar tests de render que no correrían.

**Lo que sí tiene cobertura real es el backend:** que ambos endpoints respondan 422 sin el campo,
422 con el campo en `false`, y que el de la farmacia escriba exactamente una fila en
`consentimientos_recipe` por subida aceptada.

Y una verificación en navegador que los tests no cubren: que al **cancelar**, la imagen no se
transmita. Se comprueba con el panel de red abierto — cero peticiones a `analizar-recipe`.

## 9. Qué queda abierto después de esto

- **B-05b** — el tratamiento por Gemini y NVIDIA sigue sin documentar, y por eso el aviso es
  incompleto.
- **La base legal del caso de la farmacia** — el mecanismo queda listo; el texto, no.
- **B-04 en su conjunto** — los textos de términos y privacidad siguen diciendo «Borrador» en
  pantalla.

# Documentos legales (Términos + Privacidad) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reescribir `src/routes/terminos.tsx` y `src/routes/privacidad.tsx` con el texto legal completo de DosisYa, fusionando los borradores actuales con el andamiaje legal de los ejemplos de plataforma.

**Architecture:** Dos rutas file-based de TanStack Router que renderizan copy legal dentro de `LegalLayout` + `Seccion` (`src/components/LegalLayout.tsx`). No hay lógica nueva ni llamadas a API: es contenido. La verificación es typecheck + build + render, no vitest (no hay comportamiento que testear).

**Tech Stack:** React 19 + TanStack Start/Router + TypeScript + Tailwind 4. Componentes existentes `LegalLayout({ titulo, actualizado, children })` y `Seccion({ titulo, children })`.

## Global Constraints

- Fecha "Última actualización" en ambos: **26 de octubre de 2026**.
- Mantener el **banner "Borrador — pendiente de revisión por abogado / no publicar"** al inicio de cada documento (estilo ámbar, igual que hoy).
- Contacto oficial: WhatsApp **+58 424-592-8624** y correo **soporte@dosisya.com**.
- Alcance geográfico = **Venezuela** (nunca nombrar Acarigua/Araure ni "hiperlocal").
- **No nombrar a Yummy** en ningún documento ("servicios de delivery de terceros").
- Placeholders explícitos con estilo `var(--tinta-tenue)`: identidad legal (nombre + RIF) y ciudad del domicilio legal.
- No tocar el backend. No crear ruta `/tratamiento-datos`.
- Verificación mínima antes de cada commit (CLAUDE.md §6): `npx tsc --noEmit && npm run build`.
- Atribución de commit: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

---

### Task 1: Reescribir Términos de uso

**Files:**
- Modify (reemplazo total del componente `Terminos`): `src/routes/terminos.tsx`

**Interfaces:**
- Consumes: `LegalLayout`, `Seccion` de `@/components/LegalLayout`; `createFileRoute` de `@tanstack/react-router`.
- Produces: ruta `/terminos` (sin cambios de contrato; solo cambia el contenido).

- [ ] **Step 1: Reemplazar el cuerpo del componente `Terminos`**

Conservar el bloque `Route`/`head`/`createFileRoute` tal cual (solo el `component: Terminos`). Reemplazar la función `Terminos` completa por:

```tsx
function Terminos() {
  return (
    <LegalLayout titulo="Términos de uso" actualizado="26 de octubre de 2026">
      <div
        className="rounded-lg border px-4 py-3 text-sm"
        style={{
          borderColor: "var(--ambar-receta)",
          background: "var(--ambar-fondo)",
          color: "var(--ambar-receta)",
        }}
      >
        <strong>Borrador.</strong> Este texto describe cómo funciona DosisYa hoy, pero todavía no
        fue revisado por un abogado. No lo tomes como asesoría legal definitiva: complétalo
        (identidad legal, ciudad del domicilio legal) y valídalo antes de publicarlo u operar con
        farmacias y pacientes reales.
      </div>

      <Seccion titulo="1. Qué es DosisYa">
        <p>
          DosisYa es un directorio y buscador de disponibilidad de medicamentos que conecta
          pacientes con farmacias afiliadas en Venezuela. DosisYa{" "}
          <strong>no es una farmacia, no vende medicamentos y no procesa pagos</strong>: solo
          muestra qué farmacia reporta tener un producto en stock y, si el paciente quiere
          contactarla, abre una conversación de WhatsApp directamente con esa farmacia.
        </p>
      </Seccion>

      <Seccion titulo="2. Aceptación y quién puede usar DosisYa">
        <p>
          Al usar DosisYa aceptas estos Términos de uso y nuestra{" "}
          <Link to="/privacidad" style={{ color: "var(--verde-cruz)", fontWeight: 500 }}>
            Política de privacidad
          </Link>
          . Si no estás de acuerdo con ellos, no uses la plataforma.
        </p>
        <p>
          Para usar DosisYa debes ser mayor de edad. Puedes buscar y contactar farmacias{" "}
          <strong>sin crear una cuenta</strong>; crear una cuenta de paciente es opcional y te
          permite guardar tu Lista Médica y acceder a beneficios.
        </p>
      </Seccion>

      <Seccion titulo="3. Dónde funciona DosisYa">
        <p>
          DosisYa está diseñado para operar en Venezuela y mostrar farmacias dentro del país. Si
          accedes desde el exterior lo haces bajo tu propia responsabilidad, y algunas funciones
          (como la cercanía de farmacias o el contacto) pueden no estar disponibles o no tener
          sentido fuera de Venezuela.
        </p>
      </Seccion>

      <Seccion titulo="4. Uso por parte del paciente">
        <p>
          Buscar medicamentos, armar tu Lista Médica y contactar farmacias en DosisYa es gratuito y
          no requiere cuenta.
        </p>
        <p>
          La disponibilidad y el precio que ves los reporta cada farmacia y pueden cambiar entre el
          momento en que buscas y el momento en que llegas o escribes: DosisYa no garantiza que un
          producto siga disponible ni que el precio final sea exactamente el mostrado. Confirma
          siempre con la farmacia antes de trasladarte.
        </p>
        <p>
          La compra, el pago y la entrega ocurren directamente entre tú y la farmacia, fuera de
          DosisYa. La farmacia es responsable de su inventario, sus precios y su logística de
          entrega (motorizado propio o servicios de delivery de terceros).
        </p>
      </Seccion>

      <Seccion titulo="5. Escáner de récipe y Asistente IA">
        <p>
          El escáner de récipe y el Asistente IA son herramientas de apoyo informativo que usan
          inteligencia artificial (Google Gemini) para leer una foto de récipe o responder preguntas
          generales sobre medicamentos. Son un auxiliar de búsqueda, no sustituyen la indicación de
          un médico ni de un farmacéutico, y <strong>DosisYa no diagnostica ni prescribe</strong>.
          Ante cualquier duda sobre dosis, interacciones, contraindicaciones o alternativas, consulta
          siempre a un profesional de la salud.
        </p>
      </Seccion>

      <Seccion titulo="6. Uso aceptable">
        <p>Al usar DosisYa te comprometes a no:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            extraer datos de forma masiva o automatizada (scraping) del directorio o del inventario;
          </li>
          <li>
            generar clics o interacciones artificiales o fraudulentas hacia las farmacias (cada
            interacción se factura, así que simularlas es fraude);
          </li>
          <li>enviar spam o comunicaciones no solicitadas a través de la plataforma;</li>
          <li>
            intentar vulnerar la seguridad del sitio, acceder a datos de terceros o interferir con su
            funcionamiento;
          </li>
          <li>usar DosisYa para fines ilícitos o que dañen a otros usuarios, a las farmacias o a DosisYa.</li>
        </ul>
      </Seccion>

      <Seccion titulo="7. Uso por parte de la farmacia">
        <p>
          Las farmacias se afilian mediante un registro que DosisYa aprueba antes de publicar su
          inventario. DosisYa cobra a la farmacia por cada interacción cobrable que genera hacia su
          WhatsApp (modelo de costo-por-lead), no por cada venta ni comisión sobre el monto vendido.
          El detalle de facturación queda disponible en el panel de la farmacia.
        </p>
        <p>
          La farmacia es responsable de la exactitud de su inventario, sus precios y de responder a
          los pacientes que la contactan a través de DosisYa.
        </p>
      </Seccion>

      <Seccion titulo="8. Propiedad intelectual y marcas">
        <p>
          La marca "DosisYa", el software, el diseño y los contenidos de la plataforma pertenecen a
          DosisYa o a sus titulares. No se te otorga ninguna licencia para copiarlos, reproducirlos o
          reutilizarlos fuera del uso normal de la aplicación sin autorización previa por escrito.
        </p>
      </Seccion>

      <Seccion titulo="9. Enlaces y servicios de terceros">
        <p>
          DosisYa se apoya en servicios de terceros y enlaza hacia ellos: WhatsApp (para el contacto
          con la farmacia), mapas (para ubicar farmacias) y servicios de delivery de terceros. DosisYa
          no controla esos servicios ni responde por su contenido, disponibilidad o condiciones; su
          uso se rige por los términos de cada proveedor.
        </p>
      </Seccion>

      <Seccion titulo="10. Límite de responsabilidad">
        <p>
          DosisYa actúa como intermediario tecnológico entre pacientes y farmacias y ofrece la
          plataforma "tal cual", según su disponibilidad. No es parte de la transacción de
          compra-venta ni de la relación de entrega entre ambos, y no responde por errores de
          inventario o precios, demoras de entrega ni por el estado de los productos entregados por la
          farmacia.
        </p>
      </Seccion>

      <Seccion titulo="11. Privacidad">
        <p>
          El tratamiento de tus datos se rige por nuestra{" "}
          <Link to="/privacidad" style={{ color: "var(--verde-cruz)", fontWeight: 500 }}>
            Política de privacidad
          </Link>
          , que forma parte de estos Términos.
        </p>
      </Seccion>

      <Seccion titulo="12. Ley aplicable y jurisdicción">
        <p>
          Estos Términos se regirán e interpretarán en todas sus partes por las leyes de la República
          Bolivariana de Venezuela. Para todos los efectos legales derivados del uso de DosisYa, las
          partes se someten a la jurisdicción de los tribunales competentes de la República
          Bolivariana de Venezuela.
        </p>
        <p style={{ color: "var(--tinta-tenue)" }}>
          [COMPLETAR: ciudad del domicilio legal (por ejemplo, "se elige como domicilio la ciudad de
          ___, Venezuela") una vez constituida la identidad legal del operador.]
        </p>
      </Seccion>

      <Seccion titulo="13. Disposiciones finales">
        <p>
          Si alguna cláusula de estos Términos se considerara inválida o inaplicable, el resto seguirá
          en plena vigencia. El hecho de que DosisYa no ejerza un derecho en un momento dado no implica
          que renuncie a él.
        </p>
      </Seccion>

      <Seccion titulo="14. Cambios a estos términos">
        <p>
          Podemos actualizar estos términos para reflejar cambios en el producto. La fecha de "Última
          actualización" en la parte de arriba indica la versión vigente.
        </p>
      </Seccion>

      <Seccion titulo="15. Contacto">
        <p>
          Para dudas sobre estos Términos, escríbenos por WhatsApp al{" "}
          <strong>+58 424-592-8624</strong> o al correo <strong>soporte@dosisya.com</strong>.
        </p>
        <p style={{ color: "var(--tinta-tenue)" }}>
          [COMPLETAR: identidad legal del operador (nombre o razón social y RIF) antes de publicar.]
        </p>
      </Seccion>
    </LegalLayout>
  );
}
```

- [ ] **Step 2: Añadir el import de `Link`**

En la parte superior de `src/routes/terminos.tsx`, el import actual es:

```tsx
import { createFileRoute } from "@tanstack/react-router";
```

Reemplazarlo por (añade `Link`, usado en las secciones 2 y 11):

```tsx
import { createFileRoute, Link } from "@tanstack/react-router";
```

- [ ] **Step 3: Verificar typecheck y build**

Run: `npx tsc --noEmit && npm run build`
Expected: ambos terminan sin errores (exit 0). Si `tsc` marca que `Link` no se usa o falta, revisar el import del Step 2.

- [ ] **Step 4: Commit**

```bash
git add src/routes/terminos.tsx
git commit -m "$(cat <<'EOF'
feat(legal): redactar Términos de uso completos de DosisYa

Fusiona el borrador fiel al modelo (directorio CPC, sin venta/pago, escáner
Gemini) con el andamiaje legal de los ejemplos de plataforma: aceptación y
mayoría de edad, alcance Venezuela, uso aceptable, propiedad intelectual,
terceros, ley aplicable (Venezuela) + jurisdicción, nulidad parcial y no
renuncia. Contacto real (WhatsApp + soporte@dosisya.com). Quedan como
[COMPLETAR] la identidad legal y la ciudad del domicilio legal.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Reescribir Política de privacidad

**Files:**
- Modify (reemplazo total del componente `Privacidad`): `src/routes/privacidad.tsx`

**Interfaces:**
- Consumes: `LegalLayout`, `Seccion` de `@/components/LegalLayout`; `createFileRoute` de `@tanstack/react-router`.
- Produces: ruta `/privacidad` (sin cambios de contrato; solo cambia el contenido).

- [ ] **Step 1: Reemplazar el cuerpo del componente `Privacidad`**

Conservar el bloque `Route`/`head`/`createFileRoute`. Reemplazar la función `Privacidad` completa por:

```tsx
function Privacidad() {
  return (
    <LegalLayout titulo="Política de privacidad" actualizado="26 de octubre de 2026">
      <div
        className="rounded-lg border px-4 py-3 text-sm"
        style={{
          borderColor: "var(--ambar-receta)",
          background: "var(--ambar-fondo)",
          color: "var(--ambar-receta)",
        }}
      >
        <strong>Borrador.</strong> Describe el manejo de datos real de la app a esta fecha e incluye
        el registro de paciente previsto (formulario + Google), que aún no está en producción. No lo
        publiques hasta que ese registro esté activo y un abogado haya revisado el texto, y completa
        la identidad legal y el canal de contacto definitivos.
      </div>

      <Seccion titulo="1. Cómo usas DosisYa: con o sin cuenta">
        <p>
          Buscar, armar tu Lista Médica y contactar farmacias en DosisYa no requiere cuenta: no
          necesitas registrarte para usar lo esencial de la app. Crear una cuenta de paciente es{" "}
          <strong>opcional</strong> y te permite guardar tu Lista Médica y acceder a beneficios.
        </p>
      </Seccion>

      <Seccion titulo="2. Qué guarda tu propio dispositivo (no nuestros servidores)">
        <p>
          Tu Lista Médica, tus favoritos y tus recordatorios de reposición se guardan únicamente en
          el almacenamiento local de tu navegador (localStorage). Si no tienes cuenta, DosisYa no
          recibe esa información en sus servidores: si borras los datos del navegador o cambias de
          dispositivo, se pierde.
        </p>
      </Seccion>

      <Seccion titulo="3. Qué recibimos cuando contactas a una farmacia">
        <p>
          Cuando tocas "Contactar por WhatsApp", "Ver mapa", "Guardar" o "Compartir" sobre un
          resultado, registramos esa interacción: la farmacia, el medicamento asociado (si aplica),
          el tipo de interacción, la fecha y hora, y tu dirección IP y user-agent del navegador.
          Usamos esto para cobrarle a la farmacia por el contacto generado (nuestro modelo de
          negocio) y para detectar clics artificiales o fraudulentos.
        </p>
        <p>
          La conversación de WhatsApp en sí ocurre directamente entre tú y la farmacia: no pasa por
          los servidores de DosisYa ni la leemos.
        </p>
        <p>
          Tu ubicación (si la compartes) se usa únicamente para calcular qué farmacias están cerca
          en el momento de la búsqueda; no queda guardada asociada a tu identidad.
        </p>
        <p>
          También registramos, de forma anónima, eventos de uso como qué buscas, cuándo agregas algo
          a tu Lista Médica y cuándo contactas a una farmacia: nos sirve para entender en qué punto
          del recorrido se pierde la gente y mejorar la app.
        </p>
      </Seccion>

      <Seccion titulo="4. Si creas una cuenta de paciente">
        <p>
          Si te registras, guardamos los datos que nos proporcionas para crear tu cuenta: nombre,
          apellido, correo electrónico, número de documento, número de teléfono y, de forma opcional,
          tu género. Si te registras con Google, recibimos los datos básicos de tu cuenta de Google
          (como tu nombre y tu correo).
        </p>
        <p>
          Usamos esos datos para crear y autenticar tu cuenta, recordarte entre sesiones y
          dispositivos, y guardar tu Lista Médica. Puedes cerrar sesión en cualquier momento y pedir
          la eliminación de tu cuenta escribiéndonos a <strong>soporte@dosisya.com</strong>.
        </p>
      </Seccion>

      <Seccion titulo="5. Escáner de récipe y Asistente IA">
        <p>
          La foto de tu récipe se procesa en memoria en nuestro servidor y se envía a la API de{" "}
          <strong>Google Gemini</strong> para extraer los medicamentos: DosisYa no la guarda ni la
          almacena en sus servidores ni en su base de datos.
        </p>
        <p>
          Los mensajes que le escribes al Asistente IA se envían a Google Gemini para generar la
          respuesta; DosisYa no guarda el historial de esa conversación en sus servidores.
        </p>
      </Seccion>

      <Seccion titulo="6. Si eres farmacia (panel B2B)">
        <p>
          Para operar tu panel guardamos los datos de tu registro: correo, nombre de la farmacia,
          RIF, WhatsApp, sector/punto de referencia y tus credenciales de acceso (contraseña
          cifrada). Los usamos para autenticarte, mostrarte tus leads y calcular tu facturación
          mensual.
        </p>
      </Seccion>

      <Seccion titulo="7. Con quién compartimos datos">
        <p>Usamos estos proveedores (subencargados) para operar DosisYa:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <strong>Google Gemini</strong> — análisis de récipes y Asistente IA.
          </li>
          <li>
            <strong>Google</strong> — registro e inicio de sesión del paciente con Google.
          </li>
          <li>
            <strong>Supabase</strong> — base de datos donde vive la información descrita arriba.
          </li>
          <li>
            <strong>Vercel</strong> — hosting de la aplicación y la API.
          </li>
          <li>
            <strong>Sentry</strong> — monitoreo de errores técnicos; puede incluir tu dirección IP
            si ocurre un fallo mientras usas la app.
          </li>
          <li>
            <strong>PostHog</strong> — analítica de uso anónima (búsquedas, uso de la Lista Médica,
            contacto con farmacias).
          </li>
          <li>
            <strong>n8n</strong> — envío de la notificación del lead al WhatsApp de la farmacia.
          </li>
        </ul>
        <p>No vendemos tus datos a terceros con fines publicitarios.</p>
      </Seccion>

      <Seccion titulo="8. Cuánto tiempo conservamos los datos">
        <p>
          Conservamos los registros de interacciones/leads durante <strong>12 meses</strong> (cubren
          la facturación de la farmacia y posibles reclamos). Los datos de la cuenta de una farmacia
          se conservan mientras la cuenta esté activa y hasta <strong>6 meses</strong> después de
          darse de baja. Los datos de tu cuenta de paciente se conservan hasta que pidas eliminarla.
        </p>
      </Seccion>

      <Seccion titulo="9. Seguridad de la información">
        <p>
          Aplicamos medidas de seguridad razonables para proteger tu información (por ejemplo, las
          contraseñas se almacenan cifradas). Sin embargo, ninguna transmisión por Internet ni
          almacenamiento electrónico es completamente seguro, por lo que no podemos garantizar una
          seguridad absoluta.
        </p>
      </Seccion>

      <Seccion titulo="10. Cookies y tecnologías similares">
        <p>
          DosisYa no usa cookies de rastreo publicitario para el paciente. Usamos el almacenamiento
          local de tu navegador (localStorage) para que la app funcione y analítica de uso anónima
          para mejorarla. Puedes borrar ese almacenamiento desde la configuración de tu navegador.
        </p>
      </Seccion>

      <Seccion titulo="11. Menores de edad">
        <p>
          DosisYa está dirigido a personas mayores de edad. No recopilamos de forma intencional
          información de menores; si crees que un menor nos proporcionó datos, escríbenos y los
          eliminaremos.
        </p>
      </Seccion>

      <Seccion titulo="12. Tus derechos">
        <p>
          Si tienes una cuenta (de paciente o de farmacia) puedes pedirnos acceder, corregir o
          eliminar tus datos escribiéndonos a <strong>soporte@dosisya.com</strong>. Si usas DosisYa
          sin cuenta, las interacciones quedan asociadas a la farmacia contactada, no a una identidad
          tuya, por lo que no tenemos un perfil tuyo que mostrarte o borrar.
        </p>
      </Seccion>

      <Seccion titulo="13. Cambios a esta política">
        <p>
          Podemos actualizar esta política si cambia cómo manejamos los datos. La fecha de "Última
          actualización" arriba indica la versión vigente.
        </p>
      </Seccion>

      <Seccion titulo="14. Contacto">
        <p>
          Para dudas sobre esta política o para ejercer tus derechos, escríbenos por WhatsApp al{" "}
          <strong>+58 424-592-8624</strong> o al correo <strong>soporte@dosisya.com</strong>.
        </p>
        <p style={{ color: "var(--tinta-tenue)" }}>
          [COMPLETAR: identidad legal del operador (nombre o razón social y RIF) antes de publicar.]
        </p>
      </Seccion>
    </LegalLayout>
  );
}
```

- [ ] **Step 2: Verificar typecheck y build**

Run: `npx tsc --noEmit && npm run build`
Expected: ambos terminan sin errores (exit 0). Esta ruta no usa `Link`, así que el import existente (`createFileRoute`) no cambia.

- [ ] **Step 3: Commit**

```bash
git add src/routes/privacidad.tsx
git commit -m "$(cat <<'EOF'
feat(legal): redactar Política de privacidad completa de DosisYa

Mantiene el manejo de datos real (sin cuenta, localStorage, interacciones+IP,
Gemini, subencargados) y añade: cuenta de paciente del registro v2 (nombre,
apellido, correo, documento, teléfono, género, Google), conservación (leads
12m, farmacia activa+6m), seguridad, cookies, menores de edad y derechos.
Contacto real (WhatsApp + soporte@dosisya.com). Queda [COMPLETAR] la identidad
legal. Documento en borrador: no publicar hasta que salga el registro v2.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review

**Spec coverage:** Las 15 secciones de Términos y las 14 de Privacidad del spec están en Task 1 y Task 2 respectivamente. Insumos acordados (Venezuela, sin Yummy, registro v2, conservación 12m/activa+6m, contacto WhatsApp+correo, ley aplicable calcada, placeholders de identidad legal y ciudad) presentes. ✓

**Placeholder scan:** Los únicos `[COMPLETAR]` son los intencionales y acordados (identidad legal, ciudad del domicilio legal), con estilo visual `var(--tinta-tenue)`. No hay TODO/TBD de implementación. ✓

**Type consistency:** `LegalLayout` y `Seccion` se usan con su firma real (`titulo`, `actualizado`, `titulo`). `Link` solo se importa en Términos (Task 1 Step 2), que es la única ruta que lo usa; Privacidad no lo importa. ✓

## Notas de secuenciación

- Ambos documentos quedan en **borrador** (banner ámbar) y **no se publican** hasta que el registro v2 (`docs/features/registro-paciente-v2.md`) esté en producción y un abogado los revise.
- Las tareas son independientes; pueden ejecutarse y commitearse por separado.

# Operación de producción

> Runbook de lo que mantiene la app viva: el vigilante, el plan de Supabase y el corte de dominio.
> Escrito el 2026-10-11, después de que producción estuviera caída ~5 semanas sin que nadie lo notara.

## 1. El vigilante (`.github/workflows/salud-produccion.yml`)

Corre cada 30 minutos y le pega a la **búsqueda real**, no a la portada.

**Por qué no basta con pinguear la portada.** Con la base de datos apagada,
`https://dosisya-frontend.vercel.app/` sigue respondiendo **200**. Verificado el 11 de octubre:
la portada daba 200 mientras `GET /api/v1/medicamentos/buscar` daba 500. Un monitor de uptime
convencional no habría detectado nada en cinco semanas — y de hecho no lo detectó.

El workflow exige las tres cosas, en orden:

| Check | Qué fallo detecta |
|---|---|
| `HTTP 200` | backend caído, función reventada, Supabase pausado |
| cuerpo con `"status":"success"` | el envelope de la API responde 200 en algunos caminos de error |
| cuerpo **sin** `"total":0` | la BD está viva pero el inventario es invisible — típicamente `farmacias.ubicacion` en `(0,0)`, que deja todo fuera del radio de `ST_DWithin` |

El tercero es el que ataja el fallo descrito en CLAUDE.md §5: *"subí el inventario y no aparece
en el buscador" casi nunca es el inventario, es la ubicación.*

### Limitación que hay que conocer

**GitHub desactiva los workflows programados tras ~60 días sin actividad en el repo.** Dado que
este repo pasó septiembre y octubre de 2026 con 0 commits, es un modo de fallo real: el vigilante
se duerme justo en el escenario en que más se necesita, y GitHub avisa por correo pero es fácil
ignorarlo.

Por eso el vigilante de Actions es la **red secundaria**. La primaria debería ser un monitor
externo, que no depende de la actividad del repo:

- Cualquier servicio de uptime con **check por palabra clave** (UptimeRobot y similares lo tienen
  en el plan gratuito, cada 5 min).
- URL a vigilar: `https://proyecto-dosis-ya.vercel.app/api/v1/medicamentos/buscar?q=losartan&lat=9.55&lng=-69.20`
- Palabra clave requerida: `"status":"success"` — **no** configurarlo como simple check de HTTP 200,
  por lo explicado arriba.
- Alerta a correo y, si el servicio lo soporta, a Telegram o WhatsApp.

## 2. Plan de Supabase

El proyecto `bhqvijerlvdnbdgpbish` está en plan gratuito. Eso implica dos límites que ya nos
mordieron:

- **Pausa por inactividad a la semana.** Tres recurrencias: 5 sep, 14 sep, 11 oct de 2026.
- **Solo 2 proyectos activos** por cuenta gratuita. Hay tres proyectos en la organización
  (`psico-aliexis`, `Finanzas en Pareja`, `DosisYa`), así que no pueden estar los tres arriba a la vez.

**Pro: desde $25/mes por proyecto.** Incluye $10/mes de créditos de cómputo (cubren un proyecto en
Micro), 8 GB de disco, 250 GB de egreso. Lo que importa aquí es una sola frase de su documentación:
*«Projects on paid plans are not paused for inactivity.»*

No hay forma de resolver la pausa dentro del plan gratuito. Un cron que pinguee la base cada pocos
días la mantendría «activa», pero es un parche que depende de que el cron siga vivo —
exactamente el mismo problema que tiene el vigilante de Actions.

**Regla:** mientras DosisYa siga en plan gratuito, no comprometer una fecha de lanzamiento ni
afiliar una farmacia que pague. La app se apaga sola cada semana y no hay arreglo de código posible.

## 2b. Vercel: el plan Hobby no sirve para cobrar

La documentación de Vercel es explícita: *«the Hobby plan restricts users to non-commercial,
personal use only»*. En el momento en que DosisYa le factura a la primera farmacia, deja de ser
uso personal y el plan Hobby ya no aplica. **Pro cuesta $20/mes por asiento de desarrollador**
(un fundador solo = un asiento).

Un detalle que conviene aprovechar en el orden de compras: **Pro pagado incluye el primer año de
dominio gratis** (no aplica durante el periodo de prueba, solo en un equipo Pro ya pagando). Si
Vercel Pro va a ser necesario de todas formas, conviene contratarlo **antes** de registrar el
dominio, no después.

### Costo fijo mínimo para operar cobrando

| Concepto | Costo |
|---|---|
| Supabase Pro (sin pausas) | $25/mes |
| Vercel Pro (uso comercial) | $20/mes |
| Dominio | ~$11-14/año · **primer año gratis con Pro** |
| **Fijo mensual** | **~$45/mes** |

Sin contar Gemini, n8n ni OpenWA, que son variables, ni el tiempo propio.

### El número que hay que tener presente antes de negociar

A la tarifa actual de `$0.10` por lead, cubrir solo esos $45/mes de infraestructura exige
**unos 450 leads cobrables al mes** en toda la red. Con el supuesto de 300 leads/mes por farmacia
activa que se usa en la auditoría, son **una y media a dos farmacias activas solo para no perder
dinero** — antes de que el proyecto pague nada de tiempo.

No es una objeción al modelo: es la aritmética que conviene tener en la cabeza al decidir la
tarifa y al fijar cuántas farmacias hacen falta en el piloto. Si el volumen real por farmacia
resulta ser mucho menor que 300, la tarifa es el parámetro que hay que revisar, y es justo el
dato que las entrevistas del hallazgo B-09 permitirían estimar.

## 3. Checklist de corte de dominio

Cuando el dominio esté registrado, esto es todo lo que hay que cambiar. **El primer punto es el
que rompe la app en silencio si se olvida.**

### Bloqueante

- [ ] **`FRONTEND_CORS_ORIGINS`** en Vercel → proyecto del **backend** → Settings → Environment
      Variables. Añadir el dominio nuevo (con y sin `www`, si se usan los dos).
      Si se olvida, el navegador bloquea **todas** las llamadas desde el dominio nuevo y el
      síntoma es el "Failed to fetch" de `docs/contexto/errores-conocidos.md`: la app carga y no
      funciona nada, sin error visible en el servidor.

- [ ] Dejar el dominio viejo de Vercel en la lista durante la transición, hasta confirmar que
      nadie entra por ahí.

### Si la API se mueve a un subdominio (`api.<dominio>`)

- [ ] **`VITE_API_URL`** en Vercel → proyecto del **frontend**.
      Nunca apuntarla al propio frontend: genera loops de red (CLAUDE.md §4).
- [ ] [`src/lib/api.ts:71`](../../src/lib/api.ts) — el fallback hardcodeado
      `https://proyecto-dosis-ya.vercel.app`. Solo se usa si `VITE_API_URL` no está definida,
      pero conviene actualizarlo para que el fallback no apunte a un host que algún día se apague.
- [ ] [`src/dosisya/main.py`](../../../DosisYa-Backend/src/dosisya/main.py) (repo del backend,
      líneas ~141-142) — la lista de emergencia de CORS que se usa cuando
      `FRONTEND_CORS_ORIGINS` no está configurada.

### No hay que tocar

- `FRONTEND_CORS_ORIGIN_REGEX` — valida los previews por rama, que siguen viviendo en
  `*.vercel.app`. Cambiar el dominio de producción no los afecta.

### Lo que el dominio desbloquea

Tres cosas de la auditoría de lanzamiento dependen de tener un dominio y hoy no se pueden hacer:

- [ ] **`public/robots.txt` y `sitemap.xml`** (hallazgo B-11). Necesitan el host canónico.
      Sin esto queda cerrado el canal de captación más barato que tiene el producto: alguien
      buscando «losartán Acarigua» en Google.
- [ ] **`canonical` y `og:url`** en [`src/routes/__root.tsx`](../../src/routes/__root.tsx).
      Hoy hay `og:title`, `og:description` y `og:type`, pero **no** hay `og:url` ni `canonical` —
      precisamente porque no había dominio. Sin `og:url`, compartir un enlace por WhatsApp
      (el canal natural de este producto) da una tarjeta incompleta.
- [ ] **Canal de contacto en la política de privacidad** (parte del hallazgo B-04). La propia
      página admite que falta: un correo tipo `privacidad@<dominio>` cierra ese punto, y no existe
      sin dominio.

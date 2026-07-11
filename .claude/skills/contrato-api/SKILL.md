---
name: contrato-api
description: Usar antes de escribir o modificar cualquier código frontend que llame a la API de DosisYa (/api/v1/*) — nuevos endpoints, campos en payloads, tipos de interacción de leads, o al dudar de un nombre de campo/enum. También cuando un lead "se pierde en silencio" o el backend responde 422/404 inesperado.
---

# Contrato API — verificar contra el backend real

## Principio

El backend (`/home/josemarrufo/Escritorio/DosisYa-Backend`) es la única fuente de verdad del contrato. Todo bug caro de este proyecto vino de *asumir* el contrato en vez de leerlo: `tipo_accion` en vez de `tipo_interaccion`, `medicamento_ids` (array) cuando la columna es un UUID único.

## Pasos

1. **Localiza el endpoint** en `DosisYa-Backend/src/dosisya/routers/*.py` (leads.py, medicamentos.py, auth.py, farmacias.py, b2b.py). Anota la ruta exacta — incluido el **trailing slash** (`POST /api/v1/leads/` lo lleva).
2. **Lee el modelo Pydantic** del request/response en `src/dosisya/models.py`: nombres de campos, tipos, cuáles son opcionales (`| None`).
3. **Verifica enums** en `models.py` Y en `db/schema.sql` (los `CREATE TYPE ... AS ENUM`). Usa solo valores canónicos, nunca los alias legacy de Lovable.
4. **Confirma la forma en BD** en `db/schema.sql` — si la columna es escalar (ej. `medicamento_buscado_id UUID`), el frontend no puede mandar arrays: multi-producto = fan-out (un POST por ítem).
5. **Valida con curl** contra producción antes de dar por bueno el payload: un `404` con UUID ficticio significa payload bien formado; un `422` significa contrato roto.
6. Si descubres un gotcha nuevo, **añádelo a "Lecciones Pagadas" en CLAUDE.md**.

## Referencia rápida (verificada 2026-07-11)

| Dato | Valor canónico |
|---|---|
| Campo del tipo de lead | `tipo_interaccion` |
| Enum canónico | `clic_whatsapp`, `clic_llamar`, `ver_mapa`, `ver_detalle`, `compartir`, `capture_pantalla` |
| Alias legacy (NO usar) | `click_whatsapp`, `abrir_mapa`, `expandir_detalle` |
| `medicamento_buscado_id` | UUID único, nullable — jamás array |
| Endpoint leads | `POST /api/v1/leads/` (con trailing slash) |

Si el backend cambió desde esa fecha, los pasos 1–4 mandan sobre esta tabla.

## Errores reales que este skill previene

| Error cometido | Consecuencia |
|---|---|
| Inventar `tipo_accion` sin leer models.py | Leads multi-producto perdidos en silencio (fix `b071fc0`) |
| Asumir `medicamento_ids: []` sin leer schema.sql | Campo inexistente en BD; rediseño a fan-out (fix `ac555ca`) |
| Omitir trailing slash en `/leads/` | Redirect/fallo silencioso en producción |

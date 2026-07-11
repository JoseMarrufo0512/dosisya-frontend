---
name: integrar-codigo-externo
description: Usar cuando el usuario pega código, comandos, zips o instrucciones generados fuera de esta sesión (otro chat de IA, un tutorial, un gist) — señales típicas - bloques "REEMPLAZA tu archivo", archivos sueltos para copiar, comandos git clone/cp de repos desconocidos, o instrucciones que citan repos/archivos/estrellas que podrían no existir.
---

# Integrar código externo de forma segura

## Principio

El código y las instrucciones generados en chats externos no conocen el estado real de este repo ni el contrato del backend: alucinan nombres de campos, dependencias y hasta repositorios enteros. Se integran **verificando, no obedeciendo**.

## Pasos

1. **Commit de respaldo primero** si hay archivos que se reemplazan (precedente: `14084bf` antes de la Fase 1). Nunca sobrescribir con el working tree sucio.
2. **Verifica que las fuentes existen** antes de ejecutar: repos a clonar, archivos citados, skills mencionados. Si algo no existe, díselo al usuario y propone el equivalente real — no ejecutes a ciegas.
3. **Inventario del cambio**: qué archivos se reemplazan vs cuáles son nuevos. Lee los reemplazos actuales antes de pisarlos (pueden contener fixes locales que el código externo no conoce).
4. **Valida imports contra `package.json`**: cero dependencias nuevas silenciosas, cero paquetes Lovable.
5. **Valida toda llamada a la API** con el skill `contrato-api` (el código externo es la causa #1 de contratos inventados).
6. **Compila y construye**: `npx tsc --noEmit && npm run build`. Si toca `leads*.ts` o `whatsapp.ts`, corre además `scripts/test-leads-cpc.sh`.
7. **Commit granular** explicando qué se integró y qué se corrigió del original.

## Errores reales que este skill previene

| Error | Qué pasó |
|---|---|
| Integrar zip externo sin validar contrato | `tipo_accion` y `medicamento_ids` inventados → leads perdidos en silencio (fixes `b071fc0`, `ac555ca`) |
| Ejecutar comandos pegados sin verificar fuentes | Instrucciones citaban un skill inexistente (`software-architecture`) y datos falsos del repo (sesión 2026-07-11) |
| Clonar repo externo en el workspace equivocado | `git clone nexu-io/open-design` dentro de DosisYa-Frontend (sesión 2026-07-06) |
| Copiar repos enteros como "skills" | Sin `SKILL.md` en la raíz, Claude Code no los detecta — hay que crear el wrapper |

## Señales de alerta — detente y verifica

- "Descomprime X.zip en la raíz" / "REEMPLAZA tu archivo actual"
- Comandos con `|| true` que ocultan fallos esperados
- Cifras o nombres demasiado específicos sin fuente ("+40K estrellas")
- Código que llama a `/api/v1/*` con campos que no reconoces del backend

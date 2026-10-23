#!/usr/bin/env bash
# ============================================================
# DosisYa — Verificación E2E anti-fraude de leads (A-01 + M-04)
# ============================================================
# Comprueba, contra un deploy real, las dos defensas que endurece
# el backend PR #19:
#
#   A-01  client_ip() ya NO confía en X-Forwarded-For (forjable) +
#         rate-limit 5/min con storage compartido (Upstash).
#         → Rotar X-Forwarded-For NO debe evadir el 429.
#
#   M-04  dedup atómico (pg_advisory_xact_lock transaccional).
#         → N POST idénticos concurrentes = 1 solo lead facturable.
#
# Uso:
#   bash scripts/test-antifraude-leads.sh API_BASE [FARMACIA_REAL_UUID] [MEDICAMENTO_UUID]
#
#   API_BASE          p.ej. https://dosisya-frontend.vercel.app  (recomendado:
#                     el dominio del FRONTEND, para probar el proxy mismo-origen
#                     real — es el único camino que valida Fase 0 de verdad).
#                     O http://localhost:8000 contra el backend local.
#   FARMACIA_REAL     UUID de una farmacia EXISTENTE. Solo necesario para la
#                     Fase 2 (dedup). OMÍTELO para correr solo la Fase 1.
#   MEDICAMENTO_UUID  (opcional) UUID de medicamento para el lead de dedup.
#
# ⚠️  La Fase 2 CREA LEADS FACTURABLES REALES en FARMACIA_REAL (1 por corrida).
#     La Fase 1 usa una farmacia inexistente → NO crea leads (solo 404 + 429).
#
# Requiere: curl, python3
# ============================================================

set -uo pipefail   # NO -e: queremos correr todas las fases y sumar fallos.

API="${1:-}"
FARMACIA_REAL="${2:-}"
MEDICAMENTO="${3:-}"

# Farmacia inexistente para la Fase 1: dispara 404 (tras consumir rate-limit)
# SIN insertar ningún lead → prueba el 429 sin ensuciar facturación.
FARMACIA_FAKE="99999999-9999-9999-9999-999999999999"

RATE_LIMIT=5          # @limiter.limit("5/minute") en routers/leads.py
BURST=8               # requests de la ráfaga de Fase 1 (> RATE_LIMIT)
CONCURRENTES=4        # POST simultáneos de Fase 2 (≤ RATE_LIMIT para no auto-429)
VENTANA_SEG=62        # espera para que el rate-limit por IP se reponga

GREEN="\033[0;32m"; RED="\033[0;31m"; YELLOW="\033[1;33m"; BLUE="\033[0;34m"; NC="\033[0m"
FAILURES=0

TMP="$(mktemp -d "${TMPDIR:-/tmp}/antifraude.XXXXXX")"
trap 'rm -rf "$TMP"' EXIT

if [ -z "$API" ]; then
  echo -e "${RED}Falta API_BASE.${NC} Uso: bash scripts/test-antifraude-leads.sh API_BASE [FARMACIA_REAL] [MEDICAMENTO]"
  exit 2
fi
API="${API%/}"   # sin barra final

# POST a /api/v1/leads/ — imprime: "<http_code>\t<body_json>"
# $1 farmacia  $2 tipo  $3 valor de X-Forwarded-For  $4 medicamento(opcional)
post_lead() {
  local farmacia="$1" tipo="$2" xff="$3" med="${4:-}"
  local body="{\"farmacia_id\":\"$farmacia\",\"tipo_interaccion\":\"$tipo\""
  [ -n "$med" ] && body+=",\"medicamento_buscado_id\":\"$med\""
  body+="}"
  local resp code json
  resp="$(curl -s -w $'\n%{http_code}' -X POST "$API/api/v1/leads/" \
      -H "Content-Type: application/json" \
      -H "X-Forwarded-For: $xff" \
      -d "$body")"
  code="$(printf '%s' "$resp" | tail -n1)"
  json="$(printf '%s' "$resp" | sed '$d')"
  printf '%s\t%s' "$code" "$json"
}

# Lee data.id_interaccion / data.duplicado de un body de respuesta.
campo_data() {  # $1 json  $2 clave
  printf '%s' "$1" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    print((d.get('data') or {}).get('$2', ''))
except Exception:
    print('')
" 2>/dev/null
}

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║  DosisYa — Verificación anti-fraude de leads      ║"
echo "╚══════════════════════════════════════════════════╝"
echo -e "API      : ${BLUE}$API${NC}"
echo "Farmacia : ${FARMACIA_REAL:-'(solo Fase 1 — rate-limit)'}"
echo ""

# ─── Health check ────────────────────────────────────────────
HEALTH_CODE="$(curl -s -o /dev/null -w '%{http_code}' "$API/api/v1/health" 2>/dev/null || echo 000)"
if [ "$HEALTH_CODE" != "200" ]; then
  # /health directo del backend (sin prefijo) por si se apunta al backend local
  HEALTH_CODE="$(curl -s -o /dev/null -w '%{http_code}' "$API/health" 2>/dev/null || echo 000)"
fi
if [ "$HEALTH_CODE" = "200" ]; then
  echo -e "Health   : ${GREEN}✅ backend accesible${NC}"
else
  echo -e "Health   : ${YELLOW}⚠️  /health devolvió $HEALTH_CODE (sigo igual; puede no exponer /health)${NC}"
fi

# ════════════════════════════════════════════════════════════
# FASE 1 — A-01: rotar X-Forwarded-For NO debe evadir el 429
# ════════════════════════════════════════════════════════════
echo ""
echo -e "${BLUE}── Fase 1 · A-01 — spoof de IP + rate-limit compartido ──${NC}"
echo "Disparo $BURST POST rotando X-Forwarded-For (farmacia inexistente → no factura)."
echo "Si client_ip() siguiera confiando en X-Forwarded-For[0], cada IP falsa"
echo "sería una llave nueva y NUNCA habría 429. Esperado: 429 tras ~$RATE_LIMIT."
echo ""

n_429=0; n_pre=0; n_otro=0; primer_429_en=0
for i in $(seq 1 "$BURST"); do
  OUT="$(post_lead "$FARMACIA_FAKE" "clic_whatsapp" "203.0.113.$i")"   # 203.0.113.0/24 = TEST-NET-3
  CODE="${OUT%%$'\t'*}"
  case "$CODE" in
    429)
      n_429=$((n_429+1))
      [ "$primer_429_en" -eq 0 ] && primer_429_en=$i
      echo -e "  req $i (XFF 203.0.113.$i) → ${YELLOW}429${NC} rate-limited"
      ;;
    404|201)
      n_pre=$((n_pre+1))
      echo -e "  req $i (XFF 203.0.113.$i) → ${GREEN}$CODE${NC} (pasó el rate-limit)"
      ;;
    *)
      n_otro=$((n_otro+1))
      echo -e "  req $i (XFF 203.0.113.$i) → ${RED}$CODE${NC} (inesperado)"
      ;;
  esac
done

echo ""
if [ "$n_429" -ge 1 ] && [ "$n_otro" -eq 0 ]; then
  echo -e "  ${GREEN}✅ PASS${NC}  Aparece 429 pese a rotar X-Forwarded-For (primer 429 en req #$primer_429_en)."
  echo -e "          → client_ip() ignora X-Forwarded-For y el contador es efectivo."
  if [ "$primer_429_en" -ne 0 ] && [ "$primer_429_en" -gt $((RATE_LIMIT + 2)) ]; then
    echo -e "  ${YELLOW}⚠️  Nota${NC}  El 429 llegó en req #$primer_429_en (>$RATE_LIMIT+2). Si apuntas a prod con"
    echo -e "          varias instancias, un umbral inconsistente sugiere storage NO compartido"
    echo -e "          (revisa RATELIMIT_STORAGE_URI de Upstash)."
  fi
elif [ "$n_429" -eq 0 ]; then
  echo -e "  ${RED}❌ FAIL${NC}  Ningún 429 en $BURST requests con IP rotada."
  echo -e "          Causas posibles: (a) client_ip() aún confía en X-Forwarded-For (fix A-01 no desplegado),"
  echo -e "          (b) storage por-instancia y cada request cayó en instancia distinta (falta Upstash),"
  echo -e "          (c) el deploy del PR #19 no está activo en este API_BASE."
  FAILURES=$((FAILURES+1))
else
  echo -e "  ${RED}❌ FAIL${NC}  Respuestas inesperadas ($n_otro) — revisa el detalle arriba."
  FAILURES=$((FAILURES+1))
fi

# ════════════════════════════════════════════════════════════
# FASE 2 — M-04: N POST concurrentes idénticos = 1 solo lead
# ════════════════════════════════════════════════════════════
echo ""
echo -e "${BLUE}── Fase 2 · M-04 — dedup atómico bajo concurrencia ──${NC}"

if [ -z "$FARMACIA_REAL" ]; then
  echo -e "  ${YELLOW}⏭️  OMITIDA${NC}  No se pasó FARMACIA_REAL. El dedup necesita una farmacia que"
  echo    "          exista (si no, todo da 404 y no hay INSERT que deduplicar)."
  echo    "          Reejecuta con:  bash scripts/test-antifraude-leads.sh \"$API\" <FARMACIA_UUID> [MEDICAMENTO_UUID]"
else
  echo -e "  ${YELLOW}⚠️  Esto CREA 1 lead facturable real en la farmacia $FARMACIA_REAL.${NC}"
  CONFIRM="${CONFIRM:-}"
  if [ -z "$CONFIRM" ] && [ -t 0 ]; then
    read -r -p "  Escribe 'si' para continuar con la Fase 2: " CONFIRM
  fi
  if [ "$CONFIRM" != "si" ]; then
    echo -e "  ${YELLOW}⏭️  OMITIDA${NC}  (sin confirmación; o exporta CONFIRM=si para modo no interactivo)."
  else
    if [ "$n_pre" -gt 0 ] || [ "$n_429" -gt 0 ]; then
      echo "  Esperando ${VENTANA_SEG}s a que el rate-limit por IP se reponga (Fase 1 lo consumió)..."
      sleep "$VENTANA_SEG"
    fi
    echo "  Disparo $CONCURRENTES POST idénticos EN PARALELO (misma farmacia+tipo+IP+medicamento)."
    echo "  Esperado: exactamente 1 con id_interaccion, el resto con duplicado:true."
    echo ""
    for i in $(seq 1 "$CONCURRENTES"); do
      post_lead "$FARMACIA_REAL" "clic_whatsapp" "198.51.100.7" "$MEDICAMENTO" > "$TMP/dedup_$i.out" &
    done
    wait

    n_reales=0; n_dup=0; n_429_2=0; n_otro_2=0; ids=""
    for i in $(seq 1 "$CONCURRENTES"); do
      OUT="$(cat "$TMP/dedup_$i.out")"
      CODE="${OUT%%$'\t'*}"
      JSON="${OUT#*$'\t'}"
      if [ "$CODE" = "429" ]; then
        n_429_2=$((n_429_2+1))
        echo -e "  req $i → ${YELLOW}429${NC} (rate-limit; reduce CONCURRENTES o espera la ventana)"
      elif [ "$CODE" = "201" ]; then
        ID="$(campo_data "$JSON" id_interaccion)"
        DUP="$(campo_data "$JSON" duplicado)"
        if [ -n "$ID" ]; then
          n_reales=$((n_reales+1)); ids+="$ID "
          echo -e "  req $i → ${GREEN}201 LEAD${NC}  id=$ID"
        elif [ "$DUP" = "True" ] || [ "$DUP" = "true" ]; then
          n_dup=$((n_dup+1))
          echo -e "  req $i → ${GREEN}201 dup${NC}   duplicado:true (suprimido)"
        else
          n_otro_2=$((n_otro_2+1))
          echo -e "  req $i → ${RED}201 ???${NC}  body: $JSON"
        fi
      else
        n_otro_2=$((n_otro_2+1))
        echo -e "  req $i → ${RED}$CODE${NC}  body: $JSON"
      fi
    done

    echo ""
    if [ "$n_reales" -eq 1 ] && [ "$n_otro_2" -eq 0 ] && [ "$n_429_2" -eq 0 ]; then
      echo -e "  ${GREEN}✅ PASS${NC}  1 lead real + $n_dup duplicado(s) suprimido(s). Dedup atómico OK."
    elif [ "$n_reales" -gt 1 ]; then
      echo -e "  ${RED}❌ FAIL${NC}  Se crearon $n_reales leads reales (ids: $ids) — la carrera NO se serializó."
      echo -e "          → pg_advisory_xact_lock no está protegiendo (revisa el fix M-04 desplegado)."
      FAILURES=$((FAILURES+1))
    elif [ "$n_429_2" -gt 0 ]; then
      echo -e "  ${YELLOW}⚠️  INCONCLUSO${NC}  Hubo 429 ($n_429_2): el rate-limit comió cupo. Vuelve a correr"
      echo -e "          la Fase 2 sola tras esperar 60s, o baja CONCURRENTES."
      FAILURES=$((FAILURES+1))
    else
      echo -e "  ${RED}❌ FAIL${NC}  Resultado inesperado (reales=$n_reales dup=$n_dup otros=$n_otro_2)."
      FAILURES=$((FAILURES+1))
    fi
  fi
fi

# ─── Nota: usuario legítimo (verificación manual) ────────────
echo ""
echo -e "${BLUE}── Verificación manual recomendada (no automatizable rápido) ──${NC}"
echo "  Usuario legítimo: clics espaciados (uno cada ~15s, misma IP real) NO deben"
echo "  recibir 429 de más. El rate-limit de 5/min debe permitir uso humano normal."

echo ""
if [ "$FAILURES" -gt 0 ]; then
  echo -e "${RED}═══ Verificación con $FAILURES fallo(s) ═══${NC}"
  echo ""
  exit 1
else
  echo -e "${GREEN}═══ Verificación sin fallos ═══${NC}"
  echo ""
fi

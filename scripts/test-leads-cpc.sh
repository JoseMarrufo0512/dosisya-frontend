#!/usr/bin/env bash
# ============================================================
# DosisYa — Smoke Test del Motor de Leads CPC
# Uso: bash scripts/test-leads-cpc.sh [FARMACIA_UUID] [MEDICAMENTO_UUID]
# ============================================================
# Requiere: curl, jq
# El backend debe estar corriendo en localhost:8000
#
# Tipos que se prueban (los mismos que dispara TarjetaResultado.tsx):
#   clic_whatsapp, ver_mapa, capture_pantalla, compartir
# ============================================================

set -euo pipefail

API="http://localhost:8000"
FARMACIA_ID="${1:-00000000-0000-0000-0000-000000000001}"
MEDICAMENTO_ID="${2:-}"

# Colores
GREEN="\033[0;32m"
RED="\033[0;31m"
YELLOW="\033[1;33m"
NC="\033[0m"

echo ""
echo "╔════════════════════════════════════════╗"
echo "║  DosisYa — Smoke Test Motor Leads CPC  ║"
echo "╚════════════════════════════════════════╝"
echo ""
echo "Backend : $API"
echo "Farmacia: $FARMACIA_ID"
echo "Medic.  : ${MEDICAMENTO_ID:-'(sin medicamento)'}"
echo ""

# ─── Función de test ────────────────────────────────────────
test_lead() {
  local tipo="$1"
  local desc="$2"

  BODY="{\"farmacia_id\":\"$FARMACIA_ID\",\"tipo_interaccion\":\"$tipo\""
  if [ -n "$MEDICAMENTO_ID" ]; then
    BODY+=",\"medicamento_buscado_id\":\"$MEDICAMENTO_ID\""
  fi
  BODY+="}"

  RESPONSE=$(curl -s -w "\n%{http_code}" \
    -X POST "$API/api/v1/leads/" \
    -H "Content-Type: application/json" \
    -d "$BODY")

  HTTP_CODE=$(echo "$RESPONSE" | tail -1)
  BODY_RESP=$(echo "$RESPONSE" | head -n -1)
  STATUS_FIELD=$(echo "$BODY_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('status','?'))" 2>/dev/null || echo "parse_error")

  if [ "$HTTP_CODE" = "201" ] && [ "$STATUS_FIELD" = "success" ]; then
    LEAD_ID=$(echo "$BODY_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data']['id_interaccion'])" 2>/dev/null || echo "?")
    echo -e "  ${GREEN}✅ PASS${NC}  [$tipo] $desc → lead_id: $LEAD_ID"
  elif [ "$HTTP_CODE" = "429" ]; then
    echo -e "  ${YELLOW}⚡ RATE-LIMIT${NC}  [$tipo] $desc → 429 Too Many Requests (esperado si se repiten tests rápido)"
  else
    echo -e "  ${RED}❌ FAIL${NC}  [$tipo] $desc → HTTP $HTTP_CODE | $BODY_RESP"
  fi
}

# ─── Test de salud ───────────────────────────────────────────
echo "1. Health check..."
HEALTH=$(curl -s "$API/health" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('status','?'))" 2>/dev/null || echo "error")
if [ "$HEALTH" = "success" ]; then
  echo -e "  ${GREEN}✅ Backend operativo${NC}"
else
  echo -e "  ${RED}❌ Backend no responde. ¿Está corriendo? uvicorn dosisya.main:app --port 8000${NC}"
  exit 1
fi

echo ""
echo "2. Leads CPC (4 tipos de interacción)..."
test_lead "clic_whatsapp"   "Botón WhatsApp"
test_lead "ver_mapa"        "Botón Ver mapa"
test_lead "capture_pantalla" "Botón Guardar info"
test_lead "compartir"       "Botón Compartir"

echo ""
echo "3. Valor inválido (debe retornar 400)..."
INVALID=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "$API/api/v1/leads/" \
  -H "Content-Type: application/json" \
  -d "{\"farmacia_id\":\"$FARMACIA_ID\",\"tipo_interaccion\":\"tipo_invalido_xyz\"}")
if [ "$INVALID" = "400" ]; then
  echo -e "  ${GREEN}✅ PASS${NC}  Rechazó tipo inválido con HTTP 400"
else
  echo -e "  ${RED}❌ FAIL${NC}  Tipo inválido devolvió HTTP $INVALID (esperado 400)"
fi

echo ""
echo "4. Farmacia inexistente (debe retornar 404)..."
NOTFOUND=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "$API/api/v1/leads/" \
  -H "Content-Type: application/json" \
  -d '{"farmacia_id":"99999999-9999-9999-9999-999999999999","tipo_interaccion":"clic_whatsapp"}')
if [ "$NOTFOUND" = "404" ]; then
  echo -e "  ${GREEN}✅ PASS${NC}  Farmacia inexistente devuelve HTTP 404"
else
  echo -e "  ${YELLOW}⚠️  INFO${NC}  Farmacia inexistente devolvió HTTP $NOTFOUND"
fi

echo ""
echo -e "${GREEN}═══ Test completado ═══${NC}"
echo ""

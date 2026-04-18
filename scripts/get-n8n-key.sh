#!/usr/bin/env bash
# Get n8n API key via login + cookie
set -euo pipefail

RESP=$(curl -is http://localhost:5678/rest/login \
  -H "Content-Type: application/json" \
  -X POST \
  -d '{"emailOrLdapLoginId":"admin@oficina.local","password":"OficinaDemo2026!"}' 2>&1)

COOKIE=$(echo "$RESP" | tr -d '\r' | grep -i "set-cookie" | grep "n8n-auth" | head -1 | sed 's/.*n8n-auth=//' | sed 's/;.*//')

if [ ${#COOKIE} -lt 10 ]; then
  echo "FAIL: no cookie"
  exit 1
fi

RESULT=$(curl -s "http://localhost:5678/api/v1/me/api-keys" \
  -H "Cookie: n8n-auth=${COOKIE}" \
  -H "Content-Type: application/json" \
  -X POST \
  -d '{"label":"oficina"}' 2>&1)

KEY=$(echo "$RESULT" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('data',{}).get('apiKey',d.get('apiKey','')))" 2>/dev/null)

if [ -n "$KEY" ] && [ "$KEY" != "" ]; then
  echo "$KEY" > /opt/oficina/.n8n_api_key
  echo "N8N_API_KEY=$KEY"
else
  echo "FAIL: $RESULT"
fi

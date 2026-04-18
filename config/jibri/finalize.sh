#!/usr/bin/env bash
# Jibri finalize script — runs after each recording completes.
# Uploads the recording to Nextcloud and triggers indexing via n8n.

set -euo pipefail

RECORDING_DIR="${1:-}"

: "${NEXTCLOUD_URL:?NEXTCLOUD_URL required}"
: "${NEXTCLOUD_USER:?NEXTCLOUD_USER required}"
: "${NEXTCLOUD_PASS:?NEXTCLOUD_PASS required}"
: "${N8N_URL:?N8N_URL required}"
: "${N8N_WEBHOOK_TOKEN:?N8N_WEBHOOK_TOKEN required}"

if [ -z "$RECORDING_DIR" ] || [ ! -d "$RECORDING_DIR" ]; then
  echo "[finalize] No recording directory: $RECORDING_DIR"
  exit 0
fi

RECORDING_FILE=$(find "$RECORDING_DIR" \( -name "*.mp4" -o -name "*.mkv" \) | head -1)
if [ -z "$RECORDING_FILE" ]; then
  echo "[finalize] No video file found in $RECORDING_DIR"
  exit 0
fi

FILENAME=$(basename "$RECORDING_FILE")
DATE=$(date +%Y-%m-%d)
DEST_PATH="/Recordings/${DATE}/${FILENAME}"

echo "[finalize] Uploading ${FILENAME} to Nextcloud..."

curl -sf -X MKCOL \
  -u "${NEXTCLOUD_USER}:${NEXTCLOUD_PASS}" \
  "${NEXTCLOUD_URL}/remote.php/dav/files/${NEXTCLOUD_USER}/Recordings/" 2>/dev/null || true

curl -sf -X MKCOL \
  -u "${NEXTCLOUD_USER}:${NEXTCLOUD_PASS}" \
  "${NEXTCLOUD_URL}/remote.php/dav/files/${NEXTCLOUD_USER}/Recordings/${DATE}/" 2>/dev/null || true

if curl -sf -X PUT \
    -u "${NEXTCLOUD_USER}:${NEXTCLOUD_PASS}" \
    -H "Content-Type: video/mp4" \
    --data-binary "@${RECORDING_FILE}" \
    "${NEXTCLOUD_URL}/remote.php/dav/files/${NEXTCLOUD_USER}${DEST_PATH}"; then
  echo "[finalize] Uploaded to Nextcloud: ${DEST_PATH}"

  PAYLOAD=$(printf '{"file_path":"%s","filename":"%s","date":"%s","source":"jibri"}' \
    "$DEST_PATH" "$FILENAME" "$DATE")
  curl -sf -X POST \
    "${N8N_URL}/webhook/recording-ready" \
    -H "Content-Type: application/json" \
    -H "X-Webhook-Token: ${N8N_WEBHOOK_TOKEN}" \
    -d "$PAYLOAD" >/dev/null 2>&1 || echo "[finalize] Indexing webhook failed"

  echo "[finalize] Indexing triggered"
else
  echo "[finalize] Upload failed"
  exit 1
fi

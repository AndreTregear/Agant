#!/usr/bin/env bash
# Jibri finalize script — runs after each recording completes.
# Uploads the recording to Nextcloud and triggers indexing via n8n.

RECORDING_DIR="$1"
NEXTCLOUD_URL="${NEXTCLOUD_URL:-http://nextcloud}"
NEXTCLOUD_USER="${NEXTCLOUD_USER:-admin}"
NEXTCLOUD_PASS="${NEXTCLOUD_PASS:-admin}"
N8N_URL="${N8N_URL:-http://n8n:5678}"

if [ -z "$RECORDING_DIR" ] || [ ! -d "$RECORDING_DIR" ]; then
  echo "[finalize] No recording directory: $RECORDING_DIR"
  exit 0
fi

# Find the recording file
RECORDING_FILE=$(find "$RECORDING_DIR" -name "*.mp4" -o -name "*.mkv" | head -1)
if [ -z "$RECORDING_FILE" ]; then
  echo "[finalize] No video file found in $RECORDING_DIR"
  exit 0
fi

FILENAME=$(basename "$RECORDING_FILE")
DATE=$(date +%Y-%m-%d)
DEST_PATH="/Recordings/${DATE}/${FILENAME}"

echo "[finalize] Uploading ${FILENAME} to Nextcloud..."

# Create date folder
curl -sf -X MKCOL \
  -u "${NEXTCLOUD_USER}:${NEXTCLOUD_PASS}" \
  "${NEXTCLOUD_URL}/remote.php/dav/files/${NEXTCLOUD_USER}/Recordings/" 2>/dev/null || true

curl -sf -X MKCOL \
  -u "${NEXTCLOUD_USER}:${NEXTCLOUD_PASS}" \
  "${NEXTCLOUD_URL}/remote.php/dav/files/${NEXTCLOUD_USER}/Recordings/${DATE}/" 2>/dev/null || true

# Upload recording
curl -sf -X PUT \
  -u "${NEXTCLOUD_USER}:${NEXTCLOUD_PASS}" \
  -H "Content-Type: video/mp4" \
  --data-binary "@${RECORDING_FILE}" \
  "${NEXTCLOUD_URL}/remote.php/dav/files/${NEXTCLOUD_USER}${DEST_PATH}"

if [ $? -eq 0 ]; then
  echo "[finalize] Uploaded to Nextcloud: ${DEST_PATH}"

  # Notify n8n for indexing
  curl -sf -X POST \
    "${N8N_URL}/webhook/recording-ready" \
    -H "Content-Type: application/json" \
    -d "{\"file_path\": \"${DEST_PATH}\", \"filename\": \"${FILENAME}\", \"date\": \"${DATE}\", \"source\": \"jibri\"}" 2>/dev/null || true

  echo "[finalize] Indexing triggered"
else
  echo "[finalize] Upload failed"
fi

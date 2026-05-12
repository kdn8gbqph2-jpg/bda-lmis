#!/usr/bin/env sh
# Seed a temporary self-signed cert at the path nginx.conf expects so the
# HTTPS server block can boot before the first Let's Encrypt issuance.
# Idempotent — only writes if no fullchain.pem exists yet.
#
# Usage (from the project root, on the host):
#   docker compose -f docker-compose.prod.yml run --rm --entrypoint sh \
#       -v letsencrypt:/etc/letsencrypt \
#       certbot /opt/ssl-bootstrap.sh
#
# Or via a throwaway alpine container if certbot isn't installed yet:
#   docker run --rm -v <project>_letsencrypt:/etc/letsencrypt alpine sh /opt/ssl-bootstrap.sh
set -e

DOMAIN="${CERTBOT_DOMAINS:-lmis.bdabharatpur.org}"
LIVE_DIR="/etc/letsencrypt/live/$DOMAIN"

if [ -f "$LIVE_DIR/fullchain.pem" ]; then
  echo "[ssl-bootstrap] $LIVE_DIR/fullchain.pem already exists — leaving alone."
  exit 0
fi

echo "[ssl-bootstrap] Seeding self-signed cert at $LIVE_DIR ..."
mkdir -p "$LIVE_DIR"
apk add --no-cache openssl >/dev/null 2>&1 || true
openssl req -x509 -newkey rsa:2048 -nodes -days 1 \
  -subj "/CN=$DOMAIN" \
  -keyout "$LIVE_DIR/privkey.pem" \
  -out    "$LIVE_DIR/fullchain.pem"
echo "[ssl-bootstrap] done."

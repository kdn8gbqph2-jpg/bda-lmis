# BDA LMIS — Production Deployment

This stack is built around Docker Compose + Nginx + Gunicorn. Tested on
Ubuntu 24.04 with Docker 29.x and Compose v5.

## Layout

```
nginx (80)
  ├── / and /assets/        → frontend static bundle (Vite build)
  ├── /api/, /admin/        → Gunicorn → Django on backend:8000
  ├── /static/              → Django's collectstatic output
  └── /media/               → User uploads (FileField targets)

backend  → Gunicorn (3 workers by default)
celery   → background tasks
db       → PostgreSQL 14 + PostGIS 3.3
redis    → cache + Celery broker
```

Only port **80** is exposed to the host. SSL terminates at Nginx; add Let's
Encrypt via `certbot --nginx` after DNS is pointing at the box.

## First-time setup

```bash
sudo mkdir -p /opt/bda-lmis
sudo chown -R $USER:$USER /opt/bda-lmis
cd /opt
git clone https://github.com/kdn8gbqph2-jpg/bda-lmis.git
cd bda-lmis
git checkout develop          # or main when promoted

# Generate a real .env
cp .env.example .env
# Edit .env — at minimum:
#   SECRET_KEY            : python -c "import secrets; print(secrets.token_urlsafe(50))"
#   DEBUG                 : False
#   ALLOWED_HOSTS         : lmis.bdabharatpur.org
#   DB_PASSWORD           : a strong random string
#   CORS_ALLOWED_ORIGINS  : https://lmis.bdabharatpur.org
#   CSRF_TRUSTED_ORIGINS  : https://lmis.bdabharatpur.org,http://lmis.bdabharatpur.org

# Build everything
docker compose -f docker-compose.prod.yml build

# First boot — backend's entrypoint runs `migrate` automatically
docker compose -f docker-compose.prod.yml up -d

# Wait ~20 s for the frontend bundle to write into the named volume,
# then verify
curl -I http://localhost/
curl  http://localhost/api/auth/captcha/   # should return JSON

# Create the first admin user (interactive)
docker compose -f docker-compose.prod.yml exec backend \
  python manage.py createsuperuser
```

## Updating to a newer commit

```bash
cd /opt/bda-lmis
git pull
docker compose -f docker-compose.prod.yml build backend frontend-build
docker compose -f docker-compose.prod.yml up -d
```

Backend container runs `migrate --noinput` on every start, so schema
changes apply automatically.

## SSL (after DNS is pointing here)

```bash
# Stop nginx briefly, run certbot in --standalone mode, then mount the
# certs into the nginx container. The full set of steps depends on your
# certbot/Caddy preference — pick one.
```

## Common operations

```bash
# Tail logs
docker compose -f docker-compose.prod.yml logs -f backend nginx

# Open a shell in the backend
docker compose -f docker-compose.prod.yml exec backend bash

# Run a Django management command
docker compose -f docker-compose.prod.yml exec backend python manage.py <cmd>

# Flush the dashboard cache (after manual DB edits)
docker compose -f docker-compose.prod.yml exec backend python manage.py shell -c \
  "from django.core.cache import cache; cache.delete_many(['dashboard:stats','dashboard:colony-progress','dashboard:zone-breakdown','dashboard:charts'])"
```

## What's **not** auto-loaded

Bulk patta ledger import is left as a manual step — never run during a
deploy. To import after the stack is up:

```bash
docker compose -f docker-compose.prod.yml cp ./Patta\ Ledger\ Format.xlsx \
  backend:/app/patta_ledger.xlsx
docker compose -f docker-compose.prod.yml exec backend \
  python manage.py import_patta_ledger --file /app/patta_ledger.xlsx --dry-run
docker compose -f docker-compose.prod.yml exec backend \
  python manage.py import_patta_ledger --file /app/patta_ledger.xlsx
```

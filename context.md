# BDA LMIS — Context

Bharatpur Development Authority **Land Management Information System**. Django + DRF + PostGIS backend, React + Vite + Tailwind frontend, deployed at <https://lmis.bdabharatpur.org>.

> **Branch policy:** all active work on `develop`. Push to `upstream` after every session. Server pulls from `origin` (same GitHub repo, different alias).

---

## 1. Project Scope

Digitize and govern BDA's land records. Surfaces a public read-only portal for citizens (search colonies, view layouts, download maps) and an authenticated portal for staff (manage pattas, plots, colonies, documents, GIS layers).

| Quantity | Approx. count |
|---|---|
| Colonies | 200+ (BDA scheme, private approved, regularized, pending layout, rejected layout) |
| Plots | 2,000+ |
| Pattas | 500+ in app DB; 7,000+ scanned documents in mirrored DMS |
| Khasras | 300+ |
| Custom GIS layers | water / sewerage / electricity / roads / drainage |

**Out of scope (this phase):** auction tracking, missing-patta automated case generation.

---

## 2. Production Environment

| Piece | Value |
|---|---|
| Domain | `lmis.bdabharatpur.org` (Let's Encrypt cert, autorenew) |
| Server SSH | `ssh worksserver` (alias to `itadmin@122.177.15.86:2222`) — sudoless for ops commands (see `/etc/sudoers.d/itadmin-ops`) |
| Project path | `/opt/bda-lmis` |
| Compose file | `docker-compose.prod.yml` |
| Services | `db` (Postgres 14 + PostGIS 3.3), `redis`, `backend` (gunicorn), `celery` (worker), `celery-beat` (scheduler), `frontend-build` (builds bundle into named volume), `nginx` (TLS + static) |
| Deploy | GitHub Actions `.github/workflows/deploy.yml` (manual `workflow_dispatch`) — pulls `develop`, rebuilds containers, reloads nginx |
| External DMS | `ssh dmsserver` (MySQL 5.7 + .NET API on 5001), reached via persistent SSH tunnel from worksserver (`ops/dms-tunnel.service`) |

**Local dev** — `docker-compose.yml` boots the same five services with hot-reload mounts. `.env.example` is the template.

---

## 3. Tech Stack

**Backend:** Python 3.11, Django 4.2.8, DRF, simplejwt, PostGIS, fiona, shapely, pyproj, openpyxl, PyMySQL (for DMS sync), requests (for Google Input Tools).

**Frontend:** React 19, Vite 7 (rolldown), Tailwind v4 (`@import "tailwindcss"` — no `tailwind.config.js`), TanStack Query v5, Zustand (persist), React Router v7 (`createBrowserRouter`), MapLibre GL (drop-in for Mapbox), framer-motion, amCharts 5 (donut + bar), Recharts (public dashboard), lucide-react icons.

**Infra:** Docker Compose, nginx, certbot, autossh-style SSH tunnel via systemd.

---

## 4. Django Apps

App labels deliberately use a `bda_` prefix where they'd collide with potential future Django built-ins (gis, dms_sync, approvals, transliterate).

| App | Responsibility |
|---|---|
| `users` | `CustomUser` (email/username/emp_id sign-in, `role`, `mobile`, `is_active`), JWT auth, math-CAPTCHA on login, password change, user CRUD, SSO-ID availability check |
| `colonies` | `Colony` (PostGIS MultiPolygon, 5-way `colony_type`, `revenue_village`, `layout_approval_date`, `rejection_reason`, layout map files + KML boundary), `Khasra`, public + staff serializers, GeoJSON endpoints, map download (PDF/JPEG/PNG), bulk imports |
| `plots` | `Plot` (Polygon, `area_sqy` + auto `area_sqm`, 7 status values), `PlotKhasraMapping`, GeoJSON with status color, bulk-import XLSX |
| `pattas` | `Patta` (CharField patta_number zero-padded to 4 via `normalize_patta_number`), `PlotPattaMapping` (multi-plot pattas), Excel export. `PattaVersion` retained for legacy data; no longer written. |
| `documents` | `Document` (FileField on local FS, `dms_file_number` BHR-format), per-doc preview/verify endpoints |
| `gis` | `CustomLayer` + `LayerFeature` (admin-uploaded GeoJSON / KML / KMZ / Shapefile-ZIP, auto-reprojected to EPSG:4326), `BasemapSource` for imported tile URLs, ColonyGeoJSON / KhasraGeoJSON / PlotGeoJSON view proxies |
| `dashboard` | Aggregate KPIs, colony progress, zone breakdown, dashboard charts data |
| `audit` | `AuditLog` writes for every save/delete on Colony/Plot/Patta/Document via signals. Carries `submitted_by` + `change_request` FKs to attribute approval-flow writes |
| `transliterate` | Single `GET /api/transliterate/?q=<word>` proxy to Google Input Tools (`inputtools.google.com`), 24h Redis cache. Drives the `<HindiInput>` / `<HindiTextarea>` components |
| `dms_sync` | `DmsFile` mirror of `dmsworkflow.filedetails` + `filedirectories`. Nightly Celery beat job at 02:00 IST pulls metadata + paths over the SSH tunnel via PyMySQL. Carries `department_name`, `has_ns`, `has_cs` flags so the UI knows which scan types are fetchable. `GET /api/dms/file/<dms_number>/?type=ns\|cs` streams the actual PDF via the DMS API |
| `approvals` | `ChangeRequest` (target_type/_id, operation, JSON payload, status, requested_by, resolved_by). `StaffApprovalMixin` intercepts Staff JSON writes on Patta/Colony/Plot viewsets — writes go to the queue instead of the real models. Remarks-only edits bypass the queue. Admin/Super approve/reject via `/api/approvals/{id}/approve\|reject/`. On approve, audit log records both submitter and approver |

---

## 5. Approval Workflow (the most-touched feature)

```
Staff submit (JSON write)              Admin/Super approves
─────────────────────────              ─────────────────────────
PUT /api/pattas/42/                    POST /api/approvals/7/approve/
  │                                      │
  ▼                                      ▼
StaffApprovalMixin._enqueue            registered WriteSerializer runs
  │  payload + target_id stored          │   on the real model
  │  ChangeRequest(status=pending)       │
  │  202 Accepted →                      ▼
  │   { change_request_id: 7,          AuditLog row written with
  │     status: 'pending' }            submitted_by + change_request
  ▼                                      │
toast "Sent for approval" fires        ▼
(axios interceptor on 202)             ChangeRequest(status=approved)
```

**Bypass rules:**
- `Content-Type: multipart/form-data` — files (colony map, KML, plot template) pass through directly.
- Remarks-only diff — `_is_remarks_only_change()` lets `remarks` / `rejection_reason` edits through.
- Role ≠ `staff` — admin / superintendent / viewer writes never queue.

**UI surfaces (all under `frontend/src/components/approvals/`):**
- `ApprovalsBell.jsx` — topbar dropdown, expandable diff rows, inline Approve / Reject.
- `PendingBanner.jsx` — on detail pages; for resolvers, includes full `FieldDiff` + Approve / Reject; for staff, compact summary.
- `PendingFieldChip.jsx` — amber "Pending approval" badge next to any form field whose value differs from the live record (used in PattaEditModal + PlotEditModal via the `labelExtra` slot on Input/Select/HindiInput/HindiTextarea).
- `EditHistory.jsx` — read-only timeline of AuditLog entries; one-line summary by default, click to expand into the same `FieldDiff` component used everywhere else. Shows green "Approved by X" pill when the entry came in through approval.

Shared rendering primitives:
- `frontend/src/lib/fieldLabels.js` — single source of truth for human-readable field names.
- `frontend/src/components/history/FieldDiff.jsx` — one diff renderer (modes: `diff`, `create`).
- `frontend/src/stores/useToastStore.js` + `components/ui/ToastViewport.jsx` — global toast surface; axios interceptor pushes the "Sent for approval" toast automatically on any 202 response with `change_request_id`.

---

## 6. Data Model — essentials

```
CustomUser ─< ColonyAssignment >─ Colony ──< Khasra
                                   │           │
                                   │           │
                                   └──< Plot ─┴─< PlotKhasraMapping
                                          │
                                          └──< PlotPattaMapping >── Patta ──── Document
                                                                       │           ▲
                                                                       └─[link]────┘
                                                                                   ▲
                                                                  dms_file_number  │
                                                                       │           │
                                                                  DmsFile (mirror) │
                                                                                   │
                                                                              audit.AuditLog
                                                                              (Colony, Plot,
                                                                               Patta, Document)
                                                                                   │
                                                                              ChangeRequest ──┘
                                                                              (submitted_by FK
                                                                               on AuditLog)
```

Foreign-key conventions:
- `target_id`, `entity_id`: integer PKs of the referenced model, looked up at view time. Not enforced at DB level.
- `Patta.document` (nullable FK → Document); `Document.linked_patta` (nullable reverse). Both directions kept in sync by the import command and the approval-resolution path.
- All PostGIS geometries stored in **EPSG:4326** (WGS 84). Bharatpur centre: `[77.4933, 27.2152]`.

---

## 7. Authentication & Roles

JWT (`rest_framework_simplejwt`) with sliding refresh; access token attached by the axios request interceptor; silent refresh on 401 deduped via a single in-flight promise (`client.js`).

Math-CAPTCHA on `/api/auth/login/` — single-use, 5-minute Redis TTL.

| Role | Can read | Can write | Approval needed for writes? |
|---|---|---|---|
| `admin` | all | all | no |
| `superintendent` | all | all | no |
| `staff` | all | Patta / Plot / Colony | **yes** (except multipart + remarks-only) |
| `viewer` | all | none | n/a |
| `public` | public endpoints only | none | n/a |

Sign-in accepts email **or** SSO ID / username (case-insensitive) — `CustomTokenObtainPairSerializer.validate()` resolves identifier → email before delegating.

`useAuthStore` (Zustand) exposes `isAdmin()`, `isSuperintendent()`, `isStaffOrAbove()`; pages gate Add/Edit buttons via `isStaffOrAbove`.

---

## 8. Conventions (non-negotiable)

1. **Separation of concerns** — API calls only in `src/api/`; business logic never in UI components; Django views thin (delegate to serializers / managers); each file one clear responsibility.
2. **Logging in production** — backend: `import logging; logger = logging.getLogger(__name__)`; `logger.info` for actions, `logger.warning` recoverable, `logger.error(..., exc_info=True)` for exceptions. **No bare `print()`**. Frontend: `console.warn` allowed in known-silent failure paths; otherwise prefer toasts.
3. **Maintainability** — no magic numbers; UI primitives live in `src/components/ui/`; API helpers consolidated in `src/api/endpoints.js`; Django models get `__str__`, `Meta.ordering`, and inline comments on non-obvious fields; functions > 30 lines should be refactored; **no `TODO` comments in committed code** — open an issue instead.
4. **PostGIS** — all geometry in EPSG:4326. Reproject inbound data via `pyproj` (handled in `gis/geo_utils.py` for shapefile imports).
5. **Patta numbers** — pure digits → zero-padded to 4 chars on save via `normalize_patta_number()`. Alphanumeric values left as-is. Same normalizer used by the import command's `get_or_create` lookup.
6. **Audit immutable** — `AuditLog` has no delete endpoint and no update path. Edit History UI is read-only by design.
7. **Backdrop component** — every full-page surface (login, staff shell, public layout, public sidebar) uses `<Backdrop />` for the gradient + 32px coordinate-grid texture. One source of truth in `frontend/src/components/ui/Backdrop.jsx`.

---

## 9. Important File Locations

```
backend/
├── config/settings.py             ← Django settings (DBs, Redis, Celery beat)
├── config/urls.py                 ← root URL router
├── approvals/mixins.py            ← StaffApprovalMixin — drop into any ModelViewSet
├── approvals/views.py             ← approve/reject + resolver registry
├── audit/signals.py               ← AuditLog writes on save/delete
├── audit/middleware.py            ← thread-local user/IP/CR context
├── colonies/management/commands/
│   ├── import_patta_ledger.py     ← Excel ledger → Patta/Plot/Khasra/Document upsert
│   ├── import_rejected_layouts.py ← Krutidev Excel → rejected_layout colonies
│   └── _krutidev.py               ← Krutidev 010 → Devanagari converter
├── dms_sync/management/commands/sync_dms.py  ← nightly DMS mirror pull
├── transliterate/views.py         ← Google Input Tools proxy

frontend/src/
├── api/client.js                  ← axios instance, JWT refresh, 202 toast hook
├── api/endpoints.js               ← every backend endpoint
├── stores/useAuthStore.js         ← auth + persist
├── stores/useToastStore.js        ← global toast queue
├── lib/fieldLabels.js             ← human-readable field names
├── components/ui/Backdrop.jsx     ← shared gradient + grid
├── components/ui/HindiInput.jsx   ← English→Hindi transliteration input
├── components/approvals/          ← bell, banner, per-field chip
├── components/history/            ← EditHistory, FieldDiff
└── components/dashboard/          ← amCharts donut + column

ops/
└── dms-tunnel.service             ← systemd unit on worksserver (autossh-style)
```

Credentials and rotation playbook → `credentials.txt` (gitignored, kept locally).

---

## 10. Deploy Commands

```bash
ssh worksserver
cd /opt/bda-lmis
git pull origin develop

# When backend or its requirements changed:
docker compose -f docker-compose.prod.yml build --no-cache backend frontend-build
docker compose -f docker-compose.prod.yml up -d --force-recreate \
    backend celery celery-beat frontend-build

# After backend recreate — re-resolve upstream IP:
docker compose -f docker-compose.prod.yml exec nginx nginx -s reload

# Apply migrations if any:
docker compose -f docker-compose.prod.yml exec backend python manage.py migrate
```

`--no-cache` matters: a syntax error in any frontend file (or a skipped layer) silently caches the previous successful image and Docker happily ships the old bundle. Use `--no-cache` for the build whenever results don't match the commit you just pushed.

GitHub Actions workflow does the same dance plus an nginx reload step automatically; trigger via the Actions tab → "build-and-deploy" → Run workflow.

---

## 11. Recurring "gotchas"

| Symptom | Cause | Fix |
|---|---|---|
| Frontend missing latest code after deploy | Vite build cache reused previous successful artifact | `docker compose build --no-cache frontend-build` |
| 502 on every API call after deploying backend | nginx pinned to old container IP | `docker compose exec nginx nginx -s reload` (or restart nginx) |
| "Models in app X have changes not reflected in migration" | benign warning from a prior model tweak; migrations actually apply | ignore unless `migrate` reports failure |
| Login 401 "no active account" for a newly created user | Django requires `set_password()` for proper hashing | use the admin user form or `u.set_password('…'); u.save()` from shell |
| Backend can't reach DMS tunnel | UFW blocks bridge → host, OR docker bridge is a custom one not docker0 | tunnel binds `0.0.0.0:3307` + `0.0.0.0:5101`; UFW allow `from 172.16.0.0/12 to any port 3307,5101 proto tcp` |
| AppRegistryNotReady when running mgmt commands | `manage.py shell -c` imports models before app load | always wrap in `python manage.py shell -c "..."` — `shell` calls `django.setup()` for you |

---

## 12. Standing Operating Rules

These are in `~/.claude/projects/.../memory/MEMORY.md` and apply to every session:

- **Always commit + push `context.md` updates to `develop` on `upstream`** after every session or whenever implementation status changes.
- Run **separation-of-concerns** checks before committing: API calls confined to `src/api/`, no inline `print()` in backend, no `console.log` in production paths, no `TODO` left in committed code.
- When deploying a frontend-only change use `--no-cache` for the `frontend-build` image — bitten too many times by Docker caching pre-fix code.
- Prefer **inline UI affordances** over modals where possible — the bell dropdown's expandable rows, PendingBanner's inline diff, EditHistory's expandable summaries are the templates to follow.

---

*Doc rev: 2026-05-14 — current as of approval-workflow refactor (consolidated FIELD_LABELS / FieldDiff / PendingBanner).*

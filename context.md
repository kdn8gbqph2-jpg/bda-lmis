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
| External DMS | `ssh dmsserver` (MySQL 5.7 + .NET API on 5001), reached via persistent SSH tunnel from worksserver (`ops/dms-tunnel.service`). **LMIS is read-only against dmsserver** — only the `dms_sync` Celery task pulls metadata; the local `documents.Document` mirror is a stub for BHR-number linkage. |

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
| `colonies` | `Colony` (PostGIS MultiPolygon, 5-way `colony_type`, `revenue_village`, `layout_approval_date`, `rejection_reason`, layout map files + KML boundary), `Khasra`, public + staff serializers, GeoJSON endpoints, map download (PDF/JPEG/PNG with `?disposition=inline` for browser preview), bulk imports including the **per-colony Patta-Ledger import** at `POST /api/colonies/{id}/import-ledger/` |
| `plots` | `Plot` (Polygon, `area_sqy` + auto `area_sqm`, 7 status values), `PlotKhasraMapping`, GeoJSON with status color, bulk-import XLSX |
| `pattas` | `Patta` (CharField patta_number zero-padded to 4 via `normalize_patta_number`), `PlotPattaMapping` (multi-plot pattas), Excel export. `PattaVersion` retained for legacy data; no longer written. |
| `documents` | `Document` (FileField on local FS, `dms_file_number` BHR-format), per-doc preview/verify endpoints. `linked_patta` FK is `on_delete=SET_NULL` so wiping pattas never cascades to docs. |
| `gis` | `CustomLayer` + `LayerFeature` (admin-uploaded GeoJSON / KML / KMZ / Shapefile-ZIP, auto-reprojected to EPSG:4326), `BasemapSource` for imported tile URLs, ColonyGeoJSON / KhasraGeoJSON / PlotGeoJSON view proxies |
| `dashboard` | Aggregate KPIs, colony progress, zone breakdown, dashboard charts data |
| `audit` | `AuditLog` writes for every save/delete on Colony/Plot/Patta/Document via signals. Round-trips snapshots through `DjangoJSONEncoder` (Decimal/datetime/UUID safe). **Per-field trim**: after each write, prior entries for the same record have their overlapping fields stripped; rows that lose all fields are deleted — bounds the table at one row per (record, field). `submitted_by` is the durable "this came through approval" marker; the `change_request` FK is `SET_NULL` so it survives CR hard-deletes. |
| `transliterate` | Single `GET /api/transliterate/?q=<word>` proxy to Google Input Tools (`inputtools.google.com`), 24h Redis cache. Drives `<HindiInput>`, `<HindiTextarea>`, and the Combobox search field. |
| `dms_sync` | `DmsFile` mirror of `dmsworkflow.filedetails` + `filedirectories`. Nightly Celery beat job at 02:00 IST pulls metadata + paths over the SSH tunnel via PyMySQL. Carries `department_name`, `has_ns`, `has_cs` flags so the UI knows which scan types are fetchable. `GET /api/dms/file/<dms_number>/?type=ns\|cs` streams the actual PDF via the DMS API. |
| `approvals` | `ChangeRequest` (target_type/_id, operation, JSON payload, status, requested_by, resolved_by). `StaffApprovalMixin` intercepts Staff JSON writes on Patta/Colony/Plot viewsets. **Hard-delete on resolve**: approved CRs are deleted after the WriteSerializer runs (the AuditLog row keeps `submitted_by`, FK to CR is `SET_NULL`). Rejected CRs stay until the submitter dismisses them or `approvals.sweep_old_rejected` purges them after 7 days. List endpoint includes `payload` so the bell/banner/chip can render diffs without a second round-trip. Honors `?target_type=…&target_id=…` for per-record lookups. |

---

## 5. Approval Workflow

```
Staff submit (JSON write)              Admin/Super approves
─────────────────────────              ─────────────────────────
PUT /api/pattas/42/                    POST /api/approvals/7/approve/
  │                                      │
  ▼                                      ▼
StaffApprovalMixin._enqueue            registered WriteSerializer runs on the real model
  │  payload + target_id stored          │
  │  ChangeRequest(status=pending)       │  audit signal writes AuditLog
  │  202 Accepted →                      │  (submitted_by + change_request FK)
  │   { change_request_id: 7,            │
  │     status: 'pending' }              ▼
  ▼                                    cr.delete()  ─→  AuditLog.change_request SET_NULL
toast "Sent for approval" fires        sibling pending CRs for same record deleted too
(axios interceptor on 202)
```

**`BYPASS_FIELDS` (`approvals/mixins.py`)** — saves that only touch these fields apply directly, no queue:
- `remarks` / `rejection_reason` — free-form notes
- `regulation_file_present` — tri-state filing flag
- `dms_file_number` — DMS linkage; re-derived by the nightly sync

These fields are *also* excluded from audit (`audit/signals.py::_UNTRACKED_FIELDS`), so toggling them leaves no AuditLog row.

**Other bypass rules:**
- `Content-Type: multipart/form-data` — files (colony map, KML, plot template) pass through directly.
- Role ≠ `staff` — admin / superintendent / viewer writes never queue.

**Per-field chip lifecycle** (used in PattaEditModal / PlotEditModal / ColonyEditModal):

| State | Source | Visual |
|---|---|---|
| Pending | local diff (staff role) OR server-side CR for this field | amber chip `🕐 PENDING APPROVAL` + inline `~~old~~ → new` strikethrough |
| Approved | recent AuditLog within 24h, `submitted_by` populated, no later non-approval edit | green chip `✓ APPROVED` (transient) |
| Settled | no CR, no recent approval | nothing |

A later non-approval edit on the same field clears the green chip so it never falsely claims "approved" for a value that's since been overwritten.

**Rejected CRs** stay in the table with `status='rejected'` + `resolved_by`/`resolved_at`/`resolution_notes`. The submitter sees them in the bell with a `Dismiss` button (`POST /api/approvals/{id}/dismiss/`). The `approvals.sweep_old_rejected` Celery task at 03:00 IST hard-deletes anything older than 7 days.

**UI surfaces (all under `frontend/src/components/approvals/`):**
- `ApprovalsBell.jsx` — topbar dropdown. Resolvers see pending; staff see their own pending + rejected (with `Dismiss`).
- `PendingBanner.jsx` — top of edit modals + detail pages; for resolvers, includes full `FieldDiff` + Approve/Reject buttons that close the modal on success.
- `PendingFieldChip.jsx` — amber/green chip next to any form field via the `labelExtra` slot on Input/Select/HindiInput/HindiTextarea.
- `recentApprovalMap.js` — derives the per-field recently-approved metadata from a paged audit response. Also exports `valuesEqual` — the shared comparator that treats `''` / `null` / `undefined` as one empty state.

Shared rendering primitives:
- `frontend/src/lib/fieldLabels.js` — single source of truth for human-readable field names.
- `frontend/src/components/history/FieldDiff.jsx` — one diff renderer (modes: `diff`, `create`). Exports `fmt` + `diffEntries`.
- `frontend/src/stores/useToastStore.js` + `components/ui/ToastViewport.jsx` — global toast surface. Axios interceptor pushes the "Sent for approval" toast automatically on any 202 with `change_request_id`; edit modals push their own "Saved." / "Validation failed: …" toasts on direct admin writes.

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
                                                                               on AuditLog;
                                                                               change_request
                                                                               FK is SET_NULL)
```

Foreign-key conventions:
- `target_id`, `entity_id`: integer PKs of the referenced model, looked up at view time. Not enforced at DB level.
- `Patta.document` (nullable FK → Document); `Document.linked_patta` (nullable reverse). Both directions kept in sync by the import command and the approval-resolution path.
- `Patta.patta_number` is **globally unique**, not per-colony. The Excel ledger import can hit cross-colony collisions on common low numbers — the importer skips those rows (logs a count); rename one side or relax to `(colony, patta_number)` if it becomes an issue.
- All PostGIS geometries stored in **EPSG:4326** (WGS 84). Bharatpur centre: `[77.4933, 27.2152]`.

---

## 7. Authentication & Roles

JWT (`rest_framework_simplejwt`) with sliding refresh; access token attached by the axios request interceptor; silent refresh on 401 deduped via a single in-flight promise (`client.js`).

Math-CAPTCHA on `/api/auth/login/` — single-use, 5-minute Redis TTL.

| Role | Can read | Can write | Approval needed for writes? |
|---|---|---|---|
| `admin` | all | all | no |
| `superintendent` | all | all | no |
| `staff` | all | Patta / Plot / Colony | **yes** (except multipart, bypass-list-only diffs) |
| `viewer` | all | none | n/a |
| `public` | public endpoints only | none | n/a |

Sign-in accepts email **or** SSO ID / username (case-insensitive) — `CustomTokenObtainPairSerializer.validate()` resolves identifier → email before delegating.

`useAuthStore` (Zustand) exposes `isAdmin()`, `isSuperintendent()`, `isStaffOrAbove()`; pages gate Add/Edit buttons via `isStaffOrAbove`.

---

## 8. Public Portal

Layout: single full-width column under a sticky `TopNavbar` — the left sidebar was removed because it duplicated the dashboard's category cards and the colonies-list filter bar. `TopNavbar` carries the BDA brand block (logo + portal title) that used to live in the sidebar header.

**Dashboard** (`PublicDashboardPage`) is a single above-the-fold band:
- Hero row: heading + Hindi subline + 2 CTAs on the left; a 280px-wide GIS-themed SVG (`HeroIllustration`: coordinate grid + parcel polygons + compass ring with the live colony total) sits at the top-right on lg+. Grid uses `items-start` so the SVG aligns with the heading, not with the row's vertical centre — otherwise the row stretches taller than the text and leaves dead space above the cards.
- "Browse by category" row directly below — five `CategoryCard`s, each linking to `/public/colonies?colony_type=…`. Cards use `flex flex-col h-full` so CSS-grid row-stretch propagates: all five sit at the same height regardless of body length.
- **Empty-category UX**: when the backend explicitly returned `count === 0` for a category, the bare numeral is suppressed and the card shows a small uppercase "Compiling" pill in the top-right slot + an italic "Information is being compiled." footer pinned to the bottom via `mt-auto`. Loading state (`count == null`) still shows `—` so it's distinguishable from a real zero.
- Trust-indicator strip as a hairline-divided footer inside the band.

**Colony list** (`PublicColoniesPage`) filter bar:
- Search (substring on colony name).
- **Multi-select Schemes** — colony types as comma-separated `?colony_type=a,b,c`; backend uses `BaseInFilter` for `__in` lookup.
- **Zone** (East / West).
- **Revenue Village** — fetched once from `GET /api/public/revenue-villages/` (distinct values from active colonies).
- Each row shows revenue village + a colour-coded khasra-preview strip (up to 6 pills + "+N more"); colours derived from a deterministic hash so the same khasra is the same colour on every page.
- Empty state for `colony_type=pending_layout` reads "Information is being compiled" instead of the generic "no colonies found" message.

**Colony detail** (`PublicColonyDetailPage`):
- Summary grid: Approval Date · Revenue Village · Zone (no residential/commercial counts).
- `<LayoutPreview>` renders the map inline: PDF in an `<iframe>` (X-Frame-Options=SAMEORIGIN, ASCII filename), images via `<img>`. Format pills switch between uploaded formats; Open / Download buttons preserve the original save-to-disk semantics.

Map endpoints support `?disposition=inline` so the preview iframe gets `Content-Disposition: inline` + `X-Frame-Options: SAMEORIGIN`; default behaviour stays `attachment` for plain link clicks.

**Public footer** (`PublicFooter`): three columns (Authority + portal identity / Portal links / Help & Contact) over a thin legal band. Bottom legal band carries the copyright line *and* a credit line — `Designed, Hosted & Maintained by IT Cell, Bharatpur Development Authority` — stacked on the left; socials + version on the right. The "About this Portal" links were removed (no `/public/about` route is wired up); the "Help" column shifted to a real contact panel (email + authoritative-source note + last-synced date).

---

## 9. Conventions (non-negotiable)

1. **Separation of concerns** — API calls only in `src/api/`; business logic never in UI components; Django views thin (delegate to serializers / managers); each file one clear responsibility.
2. **Logging in production** — backend: `import logging; logger = logging.getLogger(__name__)`; `logger.info` for actions, `logger.warning` recoverable, `logger.error(..., exc_info=True)` for exceptions. **No bare `print()`**. Audit signal logs every write outcome at `INFO` and silent failures at `WARNING` — never swallow exceptions without a log line.
3. **Maintainability** — no magic numbers; UI primitives live in `src/components/ui/`; API helpers consolidated in `src/api/endpoints.js`; Django models get `__str__`, `Meta.ordering`, and inline comments on non-obvious fields; functions > 30 lines should be refactored; **no `TODO` comments in committed code** — open an issue instead.
4. **PostGIS** — all geometry in EPSG:4326. Reproject inbound data via `pyproj` (handled in `gis/geo_utils.py` for shapefile imports).
5. **Patta numbers** — pure digits → zero-padded to 4 chars on save via `normalize_patta_number()`. Alphanumeric values left as-is. Same normalizer used by the import command's `get_or_create` lookup.
6. **Audit is lossy + bounded** — `AuditLog` is per-field, not per-event; older entries get their fields trimmed when a newer write supersedes them. EditHistory UI is read-only (no admin endpoint mutates rows directly), but the trim machinery and the CR hard-delete on resolve are deliberate. Older "audit is immutable" wording is *no longer accurate*.
7. **Backdrop component** — every full-page surface (login, staff shell, public layout) uses `<Backdrop />` for the gradient + 32px coordinate-grid texture. One source of truth in `frontend/src/components/ui/Backdrop.jsx`.
8. **Filename safety on `Content-Disposition`** — the wsgi layer MIME-encodes the whole header if it spots non-ASCII chars in `filename="…"`, which silently breaks `inline` rendering. Stick to ASCII names (`colony-{pk}-{fmt}.{fmt}`) and let the page itself carry the readable label.
9. **Hindi typing** — any text input that benefits from inline transliteration imports `useTransliterate` + `HindiToggleButton` + `HindiSuggestionPopover` from `HindiInput.jsx` (plus `loadHindiEnabled` / `saveHindiEnabled` for the shared localStorage toggle). The Combobox search field uses the same pieces.

---

## 10. Important File Locations

```
backend/
├── config/settings.py             ← Django settings (DBs, Redis, Celery beat)
├── config/urls.py                 ← root URL router
├── approvals/mixins.py            ← StaffApprovalMixin + BYPASS_FIELDS
├── approvals/views.py             ← approve / reject / dismiss + resolver registry
├── approvals/tasks.py             ← sweep_old_rejected (celery-beat 03:00 IST)
├── audit/signals.py               ← AuditLog writes + per-field trim + DjangoJSONEncoder
├── audit/middleware.py            ← thread-local user/IP/CR context
├── colonies/management/commands/
│   ├── import_patta_ledger.py     ← Excel ledger → Patta/Plot/Khasra/Document upsert
│   │                                 (exposes Command.run_import for API reuse)
│   ├── import_rejected_layouts.py ← Krutidev Excel → rejected_layout colonies
│   └── _krutidev.py               ← Krutidev 010 → Devanagari converter
├── colonies/views.py              ← ColonyViewSet incl. /import-ledger/
├── colonies/views_public.py       ← public list / detail / map / revenue-villages
├── colonies/filters.py            ← ColonyFilter w/ CharInFilter on colony_type
├── dms_sync/management/commands/sync_dms.py  ← nightly DMS mirror pull
├── transliterate/views.py         ← Google Input Tools proxy

frontend/src/
├── api/client.js                  ← axios instance, JWT refresh, 202 toast hook
├── api/endpoints.js               ← every backend endpoint
├── stores/useAuthStore.js         ← auth + persist
├── stores/useToastStore.js        ← global toast queue
├── lib/fieldLabels.js             ← human-readable field names
├── components/ui/Backdrop.jsx     ← shared gradient + grid
├── components/ui/Combobox.jsx     ← searchable dropdown (Hindi-typing aware)
├── components/ui/HindiInput.jsx   ← English→Hindi transliteration; exports hook + popover + toggle
├── components/approvals/          ← bell, banner, per-field chip, recentApprovalMap
├── components/history/            ← EditHistory, FieldDiff (+ diffEntries helper)
├── components/layout/PublicLayout.jsx  ← sidebar-free public shell
└── components/public/TopNavbar.jsx     ← brand + search + login

ops/
└── dms-tunnel.service             ← systemd unit on worksserver (autossh-style)
```

Credentials and rotation playbook → `credentials.txt` (gitignored, kept locally).

---

## 11. Deploy Commands

```bash
ssh worksserver
cd /opt/bda-lmis
git pull origin develop

# Full deploy (backend + frontend):
docker compose -f docker-compose.prod.yml build --no-cache backend frontend-build
docker compose -f docker-compose.prod.yml up -d --force-recreate \
    backend celery celery-beat frontend-build

# After backend recreate — re-resolve upstream IP:
docker compose -f docker-compose.prod.yml exec nginx nginx -s reload

# Apply migrations if any:
docker compose -f docker-compose.prod.yml exec backend python manage.py migrate

# Frontend-only changes — skip backend rebuild:
docker compose -f docker-compose.prod.yml build --no-cache frontend-build
docker compose -f docker-compose.prod.yml up -d --force-recreate --no-deps frontend-build
```

`--no-cache` matters: a syntax error in any frontend file (or a skipped layer) silently caches the previous successful image and Docker happily ships the old bundle. Use `--no-cache` for the build whenever results don't match the commit you just pushed.

GitHub Actions workflow does the same dance plus an nginx reload step automatically; trigger via the Actions tab → "build-and-deploy" → Run workflow.

---

## 12. Recurring "gotchas"

| Symptom | Cause | Fix |
|---|---|---|
| Frontend missing latest code after deploy | Vite build cache reused previous successful artifact | `docker compose build --no-cache frontend-build` |
| 502 on every API call after deploying backend | nginx pinned to old container IP | `docker compose exec nginx nginx -s reload` |
| EditHistory empty after a save that clearly happened | Audit signal raised silently on a non-JSON-safe value (e.g. unhandled type) | Check `docker compose logs backend` for `AuditLog write failed for …` lines; the `_serialize` round-trip via `DjangoJSONEncoder` covers Decimal/datetime/UUID — if it's something else, add it there |
| PDF / image preview iframe shows the browser's "blocked" placeholder | `X-Frame-Options: DENY` (Django default) or `Content-Disposition` MIME-encoded because a Unicode filename slipped in | Confirm endpoint emits `inline` + `SAMEORIGIN` when `?disposition=inline`; keep filename ASCII |
| `Patta.objects.get(patta_number=…)` fails with `MultipleObjectsReturned` after import | `patta_number` is globally unique-indexed, so a duplicate digit in another colony collides | Rename the colliding row in the source ledger or relax to `unique_together = ('colony', 'patta_number')` if this is recurring |
| "Models in app X have changes not reflected in migration" | Benign warning from a prior model tweak; migrations actually apply | Ignore unless `migrate` reports failure |
| Login 401 "no active account" for a newly created user | Django requires `set_password()` for proper hashing | Use the admin user form or `u.set_password('…'); u.save()` from shell |
| Backend can't reach DMS tunnel | UFW blocks bridge → host, OR docker bridge is a custom one not docker0 | Tunnel binds `0.0.0.0:3307` + `0.0.0.0:5101`; UFW allow `from 172.16.0.0/12 to any port 3307,5101 proto tcp` |
| AppRegistryNotReady when running mgmt commands | `manage.py shell -c` imports models before app load | Always wrap in `python manage.py shell -c "..."` — `shell` calls `django.setup()` for you |
| `colony_name` import creates a *new* colony alongside the existing one | Trailing whitespace in the Excel sheet name fell through to `get_or_create(name=…)` | Already patched: `import_patta_ledger` strips the sheet-name fallback and normalises the `--colony` filter |

---

## 13. Standing Operating Rules

These live in `~/.claude/projects/.../memory/MEMORY.md` and apply to every session:

- **Always commit + push `context.md` updates to `develop` on `upstream`** after every session or whenever implementation status changes.
- **dmsserver is read-only.** Never delete or modify rows on the external DMS host; LMIS mirrors via the nightly Celery task and never writes back. Stay away from `dms_sync.DmsFile` in cleanup workflows — that table is the local mirror, owned by the sync job.
- Run **separation-of-concerns** checks before committing: API calls confined to `src/api/`, no inline `print()` in backend, no `console.log` in production paths, no `TODO` left in committed code.
- When deploying a frontend-only change, use `--no-cache` for the `frontend-build` image — bitten too many times by Docker caching pre-fix code.
- Prefer **inline UI affordances** over modals where possible — the bell dropdown's expandable rows, PendingBanner's inline diff, EditHistory's expandable summaries are the templates to follow.

---

*Doc rev: 2026-05-15 — current as of the public-portal redesign + approval lifecycle (per-field chip + green Approved state, AuditLog per-field trim, CR hard-delete on resolve, sidebar removal, Patta-Ledger import on Colony modal, dashboard hero layout polish + IT-Cell footer credit).*

# BDA LMIS — COMPLETE CONTEXT DOCUMENT FOR CLAUDE CODE SESSIONS

> **How to use:** Paste this entire document into Claude at the start of any code session.
> Say: *"Based on this BDA LMIS context document, implement [what you need]"*

---

## TABLE OF CONTENTS

1. [Project Overview](#1-project-overview)
2. [Colony Data](#2-colony-data)
3. [Data Model](#3-data-model)
4. [Database Schema](#4-database-schema)
5. [API Design](#5-api-design)
6. [Frontend Architecture](#6-frontend-architecture)
7. [MapMyIndia Integration](#7-mapmyindia-integration)
8. [Role-Based Access Control](#8-role-based-access-control)
9. [Key Workflows](#9-key-workflows)
10. [Project Structure](#10-project-structure)
11. [Technology Stack](#11-technology-stack)
12. [Performance & Optimization](#12-performance--optimization)
13. [Quick Reference](#13-quick-reference)

---

## 1. PROJECT OVERVIEW

### Organization
- **Name:** Bharatpur Development Authority (BDA)
- **Location:** Bharatpur, Rajasthan, India
- **System:** Land Management Information System (LMIS)
- **Purpose:** Digitize land records, track pattas, manage documents, detect missing pattas

### System Scope
- **41+ colonies** across multiple zones
- **2,375+ total plots** (residential + commercial)
- **2,000+ pattas** (land deeds)
- **2,500+ scanned documents** (PDFs, images)
- **300+ khasras** (revenue blocks, avg 7 per colony)
- **Custom utility map layers** (water, sewerage, electricity, roads, drainage)

### Key Principles (Non-negotiable)

1. **Multi-plot pattas are common** — One patta covers 2-3 plots frequently. Use junction table.
2. **Plots cross khasra boundaries** — ~5-10% of plots span multiple khasras. Use junction table.
3. **No auction tracking in this phase** — Focus on patta ledger, documents, missing cases.
4. **MapMyIndia as base map** — Raster tile layer + custom GeoJSON overlays on top.
5. **Government compliance** — 7-year document retention, full audit trail required.
6. **Role-based UI** — Admin, Superintendent, Staff see different features.
7. **Large dataset** — 2,375 plots requires cursor pagination, DB indexing, Redis caching.

### User Roles

| Role | Count | Key Responsibilities |
|------|-------|----------------------|
| Admin | 1-2 | Full access, user management, audit logs |
| Superintendent | 3-5 | Approve linkages, assign staff, reports |
| Staff | 10-15 | Upload docs, link pattas, create cases |
| Public | Unlimited | View public map only (read-only) |

---

## 2. COLONY DATA

> **NOTE:** Colony names below are placeholders. The actual colony names must be
> sourced from the Google Sheet:
> https://docs.google.com/spreadsheets/d/18YQQE1ycKABtGVl-WXDNta2DXz9Z6LXYkCaiDHLJndE
> Update this section once the sheet data is confirmed.

### Zone Distribution

```
ZONE          APPROX COLONIES   APPROX PLOTS
─────────────────────────────────────────────
North                8              420
South                6              360
East                 6              360
West                 7              440
Central              6              360
North-East           4              220
South-East           2              105
South-West           2              110
─────────────────────────────────────────────
TOTAL               41            2,375
```

### Colony Fields (Per Record)

```
name                VARCHAR(100)  UNIQUE  — Official colony name from BDA records
zone                VARCHAR(50)           — North/South/East/West/Central/North-East/South-East/South-West
status              VARCHAR(20)           — active | new | archived
conversion_date     DATE                  — Date of conversion from agri to urban land
layout_approval_date DATE                 — Layout sanctioned date
dlc_file_number     VARCHAR(50)   UNIQUE  — DLC reference number
notified_area_bigha DECIMAL(8,2)          — Total area in Bigha
total_residential_plots INT               — Count of residential plots
total_commercial_plots  INT               — Count of commercial plots
```

### Key Scale Metrics

```
Total Colonies:          41+
Total Plots:           2,375
  Residential:         1,700 (approx)
  Commercial:            675 (approx)
Total Khasras:           300+ (avg 7.3 per colony)
Total Pattas:          2,000+
Total Documents:       2,500+
Multi-plot Pattas:       ~25% (500+ pattas covering 2+ plots)
Boundary-crossing Plots: ~5-10% (120-190 plots in 2 khasras)
```

---

## 3. DATA MODEL

### Entity Relationship Overview

```
COLONY
└── KHASRA (revenue block)
    └── PLOT  ← Central entity
        ├── M:N PATTA          (via PlotPattaMapping)
        ├── M:N KHASRA         (via PlotKhasraMapping, if boundary-crossing)
        ├── M:N DOCUMENT       (scanned files)
        └── 1:N MISSING_CASE
            └── 1:N CASE_ACTIVITY (timeline)

PATTA
├── M:N PLOT (via PlotPattaMapping)
└── 1:N PATTA_VERSION (amendment history)

CUSTOM_LAYER (utility overlays)
└── 1:N LAYER_FEATURE (individual features)
```

### Critical Junction Table 1: PlotPattaMapping

**Problem it solves:** One patta document issued for 3 adjacent plots.

```
pattas_plotpattamapping
├── plot_id              FK → plots_plot
├── patta_id             FK → pattas_patta
├── ownership_share_pct  DECIMAL(5,2)   e.g., 60.00, 40.00
├── allottee_role        VARCHAR(50)    owner | co-owner | legatee | heir
├── document_status      VARCHAR(30)    issued | missing | verified
│                                       (can differ per plot)
└── notes                TEXT           e.g., "West portion of patta"

EXAMPLE:
  Patta BDA/2016/0001, Allottee: Ramesh Chand Gupta
  ├── Plot SN-001: 57% share  (120 sqm, Owner)
  ├── Plot SN-002: 38% share  (80 sqm, Co-owner)
  └── Plot SN-045: 24% share  (50 sqm boundary area)

QUERY — Get all pattas for plot SN-001:
  SELECT p.* FROM pattas_patta p
  JOIN pattas_plotpattamapping ppm ON p.id = ppm.patta_id
  WHERE ppm.plot_id = (SELECT id FROM plots_plot WHERE plot_number = 'SN-001')
```

### Critical Junction Table 2: PlotKhasraMapping

**Problem it solves:** Plot SN-045 boundary line falls inside khasra 113, but the plot's main area is in khasra 112/2.

```
plots_plotkhasramapping
├── plot_id                FK → plots_plot
├── khasra_id              FK → colonies_khasra
├── intersection_area_sqm  DECIMAL(10,2)   area of plot within this khasra
├── geometry               GEOMETRY(Polygon, 4326)   intersection polygon
└── notes                  TEXT   e.g., "Boundary runs east-west"

EXAMPLE:
  Plot SN-045 (200 sqm total):
  ├── Khasra 112/2: 150 sqm  (primary_khasra_id points here)
  └── Khasra 113:   50 sqm   (secondary, in junction table)

QUERY — Find all plots in khasra 113 (including partial):
  SELECT DISTINCT p.* FROM plots_plot p
  JOIN plots_plotkhasramapping pkm ON p.id = pkm.plot_id
  WHERE pkm.khasra_id = (SELECT id FROM colonies_khasra WHERE number='113')
  -- Returns SN-045 even though its primary_khasra != 113
```

### Plot Status State Machine

```
available
  ↓ (scheme allocation)
allotted_lottery    ← Via lottery draw
allotted_seniority  ← Via seniority list
ews                 ← EWS / reserved category
  ↓ (patta issued)
patta_ok            ← Patta issued and digitally linked
  OR
patta_missing       ← Patta issued but physical file not found
  ↓ (resolved)
patta_ok            ← Duplicate issued or found

cancelled           ← Removed from scheme at any point
```

### Patta Status Values

```
issued      → Normal, in ledger
missing     → File not found during scanning
cancelled   → Voided / cancelled by authority
amended     → Updated / modified
superseded  → Replaced by a new duplicate patta
```

### Missing Case Status Values

```
under_inquiry          → Being investigated
duplicate_issued       → Duplicate patta issued, pending gazette
gazette_pending        → Awaiting official gazette notification
ledger_update_pending  → Patta found but ledger not updated
resolved               → Case closed
```

---

## 4. DATABASE SCHEMA

### All Tables (Production DDL)

#### users_customuser
```sql
CREATE TABLE users_customuser (
    id              SERIAL PRIMARY KEY,
    username        VARCHAR(150) UNIQUE NOT NULL,
    email           VARCHAR(254) UNIQUE,
    password_hash   VARCHAR(255),
    first_name      VARCHAR(150),
    last_name       VARCHAR(150),
    emp_id          VARCHAR(20) UNIQUE NOT NULL,
    role            VARCHAR(20) NOT NULL,
        -- admin | superintendent | staff | public
    department      VARCHAR(30),
    mobile          VARCHAR(10),
    is_active       BOOLEAN DEFAULT TRUE,
    last_login      TIMESTAMP,
    last_login_ip   INET,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE users_colonyassignment (
    id          SERIAL PRIMARY KEY,
    user_id     INT NOT NULL REFERENCES users_customuser(id) ON DELETE CASCADE,
    colony_id   INT NOT NULL REFERENCES colonies_colony(id) ON DELETE CASCADE,
    UNIQUE(user_id, colony_id)
);

CREATE INDEX idx_user_role ON users_customuser(role);
CREATE INDEX idx_user_empid ON users_customuser(emp_id);
```

#### colonies_colony
```sql
CREATE TABLE colonies_colony (
    id                       SERIAL PRIMARY KEY,
    name                     VARCHAR(100) UNIQUE NOT NULL,
    zone                     VARCHAR(50) NOT NULL,
    status                   VARCHAR(20) DEFAULT 'active',
        -- active | new | archived
    conversion_date          DATE NOT NULL,
    layout_approval_date     DATE NOT NULL,
    dlc_file_number          VARCHAR(50) UNIQUE NOT NULL,
    notified_area_bigha      DECIMAL(8,2) NOT NULL,
    total_residential_plots  INT NOT NULL DEFAULT 0,
    total_commercial_plots   INT NOT NULL DEFAULT 0,
    boundary                 GEOMETRY(MultiPolygon, 4326) NULL,
    created_at               TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at               TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by_id            INT REFERENCES users_customuser(id)
);

CREATE INDEX idx_colony_zone   ON colonies_colony(zone);
CREATE INDEX idx_colony_status ON colonies_colony(status);
CREATE INDEX idx_colony_geom   ON colonies_colony USING GIST(boundary);
```

#### colonies_khasra
```sql
CREATE TABLE colonies_khasra (
    id          SERIAL PRIMARY KEY,
    colony_id   INT NOT NULL REFERENCES colonies_colony(id) ON DELETE CASCADE,
    number      VARCHAR(50) NOT NULL,   -- e.g., "112/1", "112/2", "113"
    total_bigha DECIMAL(8,4) NOT NULL,
    geometry    GEOMETRY(Polygon, 4326) NOT NULL,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(colony_id, number)
);

CREATE INDEX idx_khasra_colony ON colonies_khasra(colony_id);
CREATE INDEX idx_khasra_geom   ON colonies_khasra USING GIST(geometry);
```

#### plots_plot
```sql
CREATE TABLE plots_plot (
    id                  SERIAL PRIMARY KEY,
    plot_number         VARCHAR(50) NOT NULL UNIQUE,  -- e.g., "SN-001"
    colony_id           INT NOT NULL REFERENCES colonies_colony(id) ON DELETE CASCADE,
    primary_khasra_id   INT NOT NULL REFERENCES colonies_khasra(id),
    type                VARCHAR(20) NOT NULL,   -- Residential | Commercial
    area_sqm            DECIMAL(10,2) NOT NULL,
    status              VARCHAR(30) NOT NULL DEFAULT 'available',
        -- available | allotted_lottery | allotted_seniority | ews
        -- | patta_ok | patta_missing | cancelled
    geometry            GEOMETRY(Polygon, 4326) NOT NULL,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by_id       INT REFERENCES users_customuser(id)
);

CREATE INDEX idx_plot_number   ON plots_plot(plot_number);
CREATE INDEX idx_plot_colony   ON plots_plot(colony_id);
CREATE INDEX idx_plot_khasra   ON plots_plot(primary_khasra_id);
CREATE INDEX idx_plot_status   ON plots_plot(status);
CREATE INDEX idx_plot_type     ON plots_plot(type);
CREATE INDEX idx_plot_geom     ON plots_plot USING GIST(geometry);
```

#### plots_plotkhasramapping
```sql
CREATE TABLE plots_plotkhasramapping (
    id                     SERIAL PRIMARY KEY,
    plot_id                INT NOT NULL REFERENCES plots_plot(id) ON DELETE CASCADE,
    khasra_id              INT NOT NULL REFERENCES colonies_khasra(id) ON DELETE CASCADE,
    intersection_area_sqm  DECIMAL(10,2) NOT NULL,
    geometry               GEOMETRY(Polygon, 4326) NOT NULL,
    notes                  TEXT,
    created_at             TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at             TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(plot_id, khasra_id)
);

CREATE INDEX idx_pkm_plot   ON plots_plotkhasramapping(plot_id);
CREATE INDEX idx_pkm_khasra ON plots_plotkhasramapping(khasra_id);
```

#### pattas_patta
```sql
CREATE TABLE pattas_patta (
    id                SERIAL PRIMARY KEY,
    patta_number      VARCHAR(50) UNIQUE NOT NULL,   -- e.g., "BDA/2016/0001"
    colony_id         INT NOT NULL REFERENCES colonies_colony(id),
    allottee_name     VARCHAR(255) NOT NULL,
    allottee_contact  VARCHAR(20),
    issue_date        DATE NOT NULL,
    amendment_date    DATE,
    status            VARCHAR(30) NOT NULL,
        -- issued | missing | cancelled | amended | superseded
    document_id       INT REFERENCES documents_document(id) ON DELETE SET NULL,
    superseded_by_id  INT REFERENCES pattas_patta(id) ON DELETE SET NULL,
    created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by_id     INT REFERENCES users_customuser(id)
);

CREATE INDEX idx_patta_number   ON pattas_patta(patta_number);
CREATE INDEX idx_patta_colony   ON pattas_patta(colony_id);
CREATE INDEX idx_patta_status   ON pattas_patta(status);
CREATE INDEX idx_patta_allottee ON pattas_patta(allottee_name);
CREATE INDEX idx_patta_fts      ON pattas_patta
    USING GIN(to_tsvector('english', allottee_name));
```

#### pattas_plotpattamapping
```sql
CREATE TABLE pattas_plotpattamapping (
    id                   SERIAL PRIMARY KEY,
    plot_id              INT NOT NULL REFERENCES plots_plot(id) ON DELETE CASCADE,
    patta_id             INT NOT NULL REFERENCES pattas_patta(id) ON DELETE CASCADE,
    ownership_share_pct  DECIMAL(5,2) NOT NULL DEFAULT 100.0,
    allottee_role        VARCHAR(50),   -- owner | co-owner | legatee | heir
    document_status      VARCHAR(30),   -- issued | missing | verified
    notes                TEXT,
    created_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(plot_id, patta_id)
);

CREATE INDEX idx_ppm_plot   ON pattas_plotpattamapping(plot_id);
CREATE INDEX idx_ppm_patta  ON pattas_plotpattamapping(patta_id);
```

#### documents_document
```sql
CREATE TABLE documents_document (
    id                  SERIAL PRIMARY KEY,
    original_filename   VARCHAR(255) NOT NULL,
    file_path           VARCHAR(500) NOT NULL,   -- S3 key or local path
    file_size_bytes     INT,
    file_type           VARCHAR(20),   -- pdf | jpg | png
    mime_type           VARCHAR(50),
    document_type       VARCHAR(30),   -- patta | survey | mutation | amendment
    linked_plot_id      INT REFERENCES plots_plot(id) ON DELETE SET NULL,
    linked_patta_id     INT REFERENCES pattas_patta(id) ON DELETE SET NULL,
    status              VARCHAR(30),   -- uploaded | verified | linked
    uploaded_by_id      INT NOT NULL REFERENCES users_customuser(id),
    uploaded_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    verified_by_id      INT REFERENCES users_customuser(id),
    verified_at         TIMESTAMP,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_doc_plot   ON documents_document(linked_plot_id);
CREATE INDEX idx_doc_patta  ON documents_document(linked_patta_id);
CREATE INDEX idx_doc_status ON documents_document(status);
CREATE INDEX idx_doc_type   ON documents_document(document_type);
```

#### missing_cases_missingcase
```sql
CREATE TABLE missing_cases_missingcase (
    id              SERIAL PRIMARY KEY,
    case_id         VARCHAR(50) UNIQUE NOT NULL,   -- e.g., "MC-001"
    plot_id         INT NOT NULL REFERENCES plots_plot(id),
    patta_id        INT REFERENCES pattas_patta(id),
    colony_id       INT NOT NULL REFERENCES colonies_colony(id),
    status          VARCHAR(30) NOT NULL,
        -- under_inquiry | duplicate_issued | gazette_pending
        -- | ledger_update_pending | resolved
    assigned_to_id  INT REFERENCES users_customuser(id),
    reported_date   DATE NOT NULL,
    resolved_date   DATE,
    remarks         TEXT,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by_id   INT REFERENCES users_customuser(id)
);

CREATE INDEX idx_mc_status      ON missing_cases_missingcase(status);
CREATE INDEX idx_mc_plot        ON missing_cases_missingcase(plot_id);
CREATE INDEX idx_mc_colony      ON missing_cases_missingcase(colony_id);
CREATE INDEX idx_mc_assigned_to ON missing_cases_missingcase(assigned_to_id);
```

#### missing_cases_caseactivity
```sql
CREATE TABLE missing_cases_caseactivity (
    id             SERIAL PRIMARY KEY,
    case_id        INT NOT NULL REFERENCES missing_cases_missingcase(id) ON DELETE CASCADE,
    activity_type  VARCHAR(50),   -- comment | status_change | document_added
    old_value      VARCHAR(255),
    new_value      VARCHAR(255),
    notes          TEXT,
    activity_by_id INT NOT NULL REFERENCES users_customuser(id),
    activity_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_ca_case        ON missing_cases_caseactivity(case_id);
CREATE INDEX idx_ca_activity_at ON missing_cases_caseactivity(activity_at);
```

#### gis_customlayer
```sql
CREATE TABLE gis_customlayer (
    id           SERIAL PRIMARY KEY,
    name         VARCHAR(255) NOT NULL,
    layer_type   VARCHAR(30) NOT NULL,
        -- WATER | SEWERAGE | ELECTRICITY | ROADS | DRAINAGE | OTHER
    geometry     GEOMETRY(GeometryCollection, 4326),
    style        JSONB,
        -- {stroke_color, stroke_width, fill_color, opacity}
    created_by_id INT NOT NULL REFERENCES users_customuser(id),
    uploaded_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    source_file  VARCHAR(255),
    is_public    BOOLEAN DEFAULT TRUE,
    colony_id    INT REFERENCES colonies_colony(id) ON DELETE SET NULL,
    metadata     JSONB,
        -- {source, last_verified, responsible_officer, notes}
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_cl_type     ON gis_customlayer(layer_type);
CREATE INDEX idx_cl_public   ON gis_customlayer(is_public);
CREATE INDEX idx_cl_colony   ON gis_customlayer(colony_id);
CREATE INDEX idx_cl_geom     ON gis_customlayer USING GIST(geometry);
```

#### gis_layerfeature
```sql
CREATE TABLE gis_layerfeature (
    id               SERIAL PRIMARY KEY,
    custom_layer_id  INT NOT NULL REFERENCES gis_customlayer(id) ON DELETE CASCADE,
    feature_id       VARCHAR(100),   -- e.g., "WL-001"
    geometry         GEOMETRY(Geometry, 4326) NOT NULL,
    properties       JSONB,   -- {diameter, material, depth} etc.
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_lf_layer    ON gis_layerfeature(custom_layer_id);
CREATE INDEX idx_lf_feat_id  ON gis_layerfeature(feature_id);
CREATE INDEX idx_lf_geom     ON gis_layerfeature USING GIST(geometry);
```

#### audit_auditlog
```sql
CREATE TABLE audit_auditlog (
    id           SERIAL PRIMARY KEY,
    user_id      INT REFERENCES users_customuser(id),
    entity_type  VARCHAR(50),   -- plot | patta | document | missing_case
    entity_id    INT,
    action       VARCHAR(20),   -- create | update | delete
    old_values   JSONB,
    new_values   JSONB,
    ip_address   INET,
    user_agent   TEXT,
    timestamp    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_al_user      ON audit_auditlog(user_id);
CREATE INDEX idx_al_entity    ON audit_auditlog(entity_type, entity_id);
CREATE INDEX idx_al_timestamp ON audit_auditlog(timestamp);
```

---

## 5. API DESIGN

### Base URL
```
Development:  http://localhost:8000/api
Production:   https://api.bda-lmis.gov.in/api
```

### Auth

```
POST  /auth/login/          Body: {email, password}
                            Resp: {access_token, refresh_token, user}

POST  /auth/refresh/        Body: {refresh_token}
                            Resp: {access_token, refresh_token}

POST  /auth/logout/         Header: Authorization: Bearer {token}

GET   /auth/me/             Resp: {id, emp_id, name, role, department}
```

### Colonies

```
GET    /colonies/            ?zone=North&status=active&search=X&page=1&limit=50
POST   /colonies/            admin only
GET    /colonies/{id}/
PUT    /colonies/{id}/       admin only
DELETE /colonies/{id}/       admin only (soft delete)
GET    /colonies/{id}/stats/ {total_plots, pattas_issued, pattas_missing, scan_pct}
GET    /colonies/{id}/geojson/
```

### Khasras

```
GET    /khasras/             ?colony=1
GET    /khasras/{id}/
GET    /khasras/{id}/plots/  includes multi-khasra info per plot
GET    /khasras/{id}/geojson/
```

### Plots

```
GET    /plots/               ?colony=1&khasra=5&status=patta_ok&search=SN-001&page=1&limit=50
POST   /plots/               staff+
GET    /plots/{id}/          full detail: pattas, documents, missing_case
PUT    /plots/{id}/          staff+
DELETE /plots/{id}/          admin+ (marks as cancelled)
GET    /plots/{id}/pattas/   [{patta_number, allottee, share_pct, co_plots, ...}]
GET    /plots/{id}/documents/
GET    /plots/{id}/history/  audit trail
POST   /plots/bulk-import/   admin+ (CSV upload)
GET    /plots/export/        ?format=excel&colony=1
GET    /plots/geojson/       ?colony=1&status=patta_ok  → FeatureCollection
```

### Pattas

```
GET    /pattas/              ?colony=1&status=issued&search=BDA/2016&page=1&limit=50
POST   /pattas/              staff+ | Body: {patta_number, colony_id, allottee_name,
                             issue_date, plots:[{plot_id, ownership_share_pct}], document_id}
GET    /pattas/{id}/         full detail: plots_covered, document, superseded_by
PUT    /pattas/{id}/         staff+
GET    /pattas/{id}/versions/
POST   /pattas/{id}/link-document/  Body: {document_id}
GET    /pattas/export/       ?format=excel&colony=1&status=issued
```

### Documents

```
GET    /documents/           ?colony=1&type=patta&status=verified&page=1
POST   /documents/           staff+ | multipart: file, document_type, linked_plot_id?, linked_patta_id?
GET    /documents/{id}/
GET    /documents/{id}/preview/
DELETE /documents/{id}/      staff+ (owner)
GET    /documents/{id}/versions/
POST   /documents/{id}/verify/  superintendent+
```

### Missing Cases

```
GET    /missing-cases/       ?status=under_inquiry&colony=1&assigned_to=3&page=1
POST   /missing-cases/       staff+
GET    /missing-cases/{id}/  full detail + activity_timeline
PUT    /missing-cases/{id}/  staff+
POST   /missing-cases/{id}/activity/   add timeline entry
PUT    /missing-cases/{id}/resolve/    Body: {resolved_date, resolution_notes}
GET    /missing-cases/report/          ?format=excel&status=under_inquiry
```

### GIS

```
GET    /gis/colonies/geojson/          all 41 colonies FeatureCollection
GET    /gis/khasras/geojson/           ?colony=1
GET    /gis/plots/geojson/             ?colony=1
                                       properties include: plot_number, status, color, pattas[]
GET    /gis/custom-layers/             list all layers
POST   /gis/custom-layers/             upload new layer (GeoJSON or Shapefile ZIP)
GET    /gis/custom-layers/{id}/geojson/
PUT    /gis/custom-layers/{id}/        update style/metadata
DELETE /gis/custom-layers/{id}/
POST   /gis/custom-layers/{id}/validate/
GET    /gis/export/rajdhara/           ?include=colonies,khasras,plots,utilities
```

### Dashboard

```
GET    /dashboard/stats/               global KPIs
GET    /dashboard/colony-progress/     [{colony, total_plots, pattas_issued, scan_pct, missing}]
GET    /dashboard/zone-breakdown/      [{zone, colony_count, total_plots, ...}]
```

### Reports

```
GET    /reports/patta-ledger/          ?format=excel&colony=1&status=issued
GET    /reports/scanning-status/       ?format=excel&colony=1
GET    /reports/missing-cases/         ?format=pdf&status=under_inquiry
GET    /reports/colony-summary/        ?format=excel  (41 colonies summary)
```

### Admin

```
GET    /users/                         admin only
POST   /users/                         admin only
PUT    /users/{id}/
DELETE /users/{id}/
POST   /users/{id}/assign-colonies/    Body: {colony_ids: [1, 3, 5]}
GET    /audit-logs/                    ?user_id&entity_type&action&days=7
```

---

## 6. FRONTEND ARCHITECTURE

### Route Structure

```
/login                    LoginPage
/dashboard                DashboardPage
/colonies                 ColoniesPage
/colonies/{id}            ColonyDetailPage
/plots                    PlotsPage
/plots/{id}               PlotDetailPage
/map                      MapPage  (internal, all layers)
/patta-ledger             PattaLedgerPage
/patta-ledger/{id}        PattaDetailPage
/missing-cases            MissingCasesPage
/missing-cases/{id}       MissingCaseDetailPage
/documents                DocumentsPage
/reports                  ReportsPage
/admin                    AdminPanel  (admin only)
/admin/users              UserManagementPage
/admin/audit-logs         AuditLogPage
/public/map               PublicMapPage  (no auth required)
```

### Component Tree

```
App
├── AuthContext
├── FilterContext
├── NotificationContext
│
├── <LoginPage>                     (if unauthenticated)
│
├── <PublicMapPage>                 (no auth, /public/map)
│   ├── MapContainer
│   ├── ColonyInfoPanel
│   └── ExportButton
│
└── <MainLayout>                    (authenticated)
    ├── <Sidebar>
    │   ├── OrgBranding
    │   ├── <NavMenu>               (role-aware, hide admin-only for staff)
    │   ├── <UserProfileCard>
    │   └── LogoutButton
    │
    ├── <Topbar>
    │   ├── PageTitle
    │   ├── Breadcrumbs
    │   └── DateTime
    │
    └── Main Content Area
        ├── <DashboardPage>
        │   ├── AlertBanner         (if missing cases > 0)
        │   ├── StatsGrid           (4 KPI cards)
        │   ├── ColonyProgressChart (bar, 41 colonies)
        │   ├── ZoneBreakdownChart  (pie, 8 zones)
        │   ├── PlotStatusDonut
        │   ├── RecentActivityTable
        │   └── MissingCasesSummary
        │
        ├── <ColoniesPage>
        │   ├── FilterBar           (zone, search, status)
        │   ├── ColonyTable         (paginated, 41 rows)
        │   ├── ExportButton
        │   └── <ColonyDetailModal>
        │       ├── BasicInfo
        │       ├── KhasraList      (expandable)
        │       ├── StatCards
        │       ├── ScanProgressBar
        │       └── ActionButtons
        │
        ├── <PlotsPage>
        │   ├── FilterBar           (colony, khasra, status, search)
        │   ├── PlotTable           (cursor paginated, 2375 rows)
        │   ├── ExportButton
        │   └── <PlotDetailModal>
        │       ├── PlotBasicInfo
        │       ├── PattasSection   (with co-plots and share %)
        │       ├── DocumentGallery
        │       ├── UploadDocumentForm
        │       ├── MissingCaseInfo (if exists)
        │       └── ActionButtons   (role-based)
        │
        ├── <MapPage>
        │   ├── <MapContainer>      (Mapbox GL)
        │   │   ├── MapMyIndia raster base layer
        │   │   ├── ColonyBoundariesLayer
        │   │   ├── KhasraGridLayer
        │   │   ├── PlotPolygonsLayer (color-coded by status)
        │   │   ├── CustomUtilityLayers[]
        │   │   ├── ZoomControls
        │   │   └── <FeatureTooltip>  (on hover)
        │   │
        │   ├── <LayerControlPanel>
        │   │   ├── BaseLayerSelector  (LIGHT / DARK / HYBRID)
        │   │   ├── BDALayerToggles    (Colonies, Khasras, Plots)
        │   │   ├── CustomLayerToggles (per layer)
        │   │   ├── SearchBox
        │   │   ├── UploadLayerButton
        │   │   └── PlotStatusLegend
        │   │
        │   └── <UploadLayerModal>
        │       ├── FilePicker         (GeoJSON / Shapefile ZIP)
        │       ├── LayerNameInput
        │       ├── LayerTypeSelect
        │       ├── ColorPicker
        │       ├── TransparencySlider
        │       ├── ScopeToggle        (Public / Private)
        │       └── UploadButton
        │
        ├── <PattaLedgerPage>
        │   ├── FilterBar             (colony, type, status, search)
        │   ├── PattaTable            (cursor paginated, 2000+ rows)
        │   ├── ExportButton
        │   └── <PattaDetailModal>
        │       ├── PattaBasicInfo
        │       ├── PlotsCoveredSection (with share %)
        │       ├── DocumentLink
        │       ├── VersionHistory
        │       └── ActionButtons
        │
        ├── <MissingCasesPage>
        │   ├── StatusFilterButtons   (tabs: All, Under Inquiry, Resolved, ...)
        │   ├── CaseTable             (paginated)
        │   ├── CreateCaseButton
        │   └── <CaseDetailModal>
        │       ├── CaseHeader
        │       ├── <CaseTimeline>    (activity log)
        │       ├── StatusUpdateForm
        │       ├── AssignmentForm
        │       ├── AddCommentForm
        │       ├── AttachDocumentButton
        │       └── ResolveButton
        │
        ├── <DocumentsPage>
        │   ├── <UploadZone>          (drag-drop area)
        │   ├── <DocumentGallery>     (filterable grid)
        │   └── <DocumentViewerModal>
        │       ├── DocumentPreview   (PDF/image)
        │       ├── DocumentMetadata
        │       ├── LinkToPlotButton
        │       ├── LinkToPattaButton
        │       └── DownloadButton
        │
        ├── <ReportsPage>
        │   ├── <ReportCardGrid>      (8 report types)
        │   └── <GenerateReportModal>
        │       ├── ColonyFilter
        │       ├── DateRangePicker
        │       ├── StatusFilter
        │       ├── FormatSelect       (Excel / PDF / CSV)
        │       └── GenerateButton     (async, shows progress)
        │
        └── <AdminPanel>              (admin only)
            ├── <UserManagementTable>
            │   ├── UserForm
            │   ├── RoleAssignment
            │   └── ColonyAssignment
            └── <AuditLogViewer>
                ├── Filters
                └── LogTable
```

### State Management

```javascript
// AuthContext
{
  currentUser: { id, emp_id, name, role, department },
  accessToken: string,
  login(email, password) → Promise,
  logout() → void,
  refreshToken() → Promise
}

// FilterContext
{
  colonyFilter: number | null,
  khasraFilter: number | null,
  statusFilter: string | null,
  searchQuery: string,
  setFilters(partial) → void,
  clearFilters() → void
}

// NotificationContext
{
  toast(message, type) → void,   // success | error | warning | info
  success(message) → void,
  error(message) → void
}
```

### Custom Hooks

```javascript
useQuery(url, params)         // GET with caching, loading, error state
useMutation(method, url)      // POST/PUT/DELETE with loading, error, success
useForm(initialValues, onSubmit, validate) // form state + validation
useDebounce(value, 300)       // debounce search input
useLocalStorage(key, initial) // persist filter state to localStorage
usePagination(cursorUrl)      // cursor-based pagination helper
```

### Status Color Mapping (Use Everywhere Consistently)

```javascript
// lib/plotStatus.js
export const PLOT_STATUS = {
  available:          { color: '#16A34A', bg: '#DCFCE7', label: 'Available' },
  allotted_lottery:   { color: '#7C3AED', bg: '#F3E8FF', label: 'Lottery' },
  allotted_seniority: { color: '#0891B2', bg: '#CFFAFE', label: 'Seniority' },
  ews:                { color: '#0F766E', bg: '#CCFBF1', label: 'EWS' },
  patta_ok:           { color: '#166534', bg: '#DCFCE7', label: 'Patta OK' },
  patta_missing:      { color: '#DC2626', bg: '#FEE2E2', label: 'Missing' },
  cancelled:          { color: '#6B7280', bg: '#F3F4F6', label: 'Cancelled' },
};
```

---

## 7. MAPMYINDIA INTEGRATION

### API Key Setup

```
# frontend/.env
VITE_MAPMYINDIA_API_KEY=your_api_key_here
VITE_MAPMYINDIA_STYLE=LIGHT

# Get API key: https://www.mappls.com/
# Styles: LIGHT | DARK | HYBRID
```

### Map Center (Bharatpur)

```javascript
const BHARATPUR_CENTER = [77.4933, 27.2152];  // [lng, lat]
const DEFAULT_ZOOM = 12;
```

### MapMyIndia Raster Tile URL

```javascript
const tileUrl =
  `https://mapi.mappls.com/advancedmaps/v1/auto/{z}/{x}/{y}?` +
  `key=${import.meta.env.VITE_MAPMYINDIA_API_KEY}&` +
  `style=${import.meta.env.VITE_MAPMYINDIA_STYLE}`;
```

### Adding Raster Tiles via Mapbox GL

```javascript
// Initialize Mapbox GL map
const map = new mapboxgl.Map({
  container: mapContainerRef.current,
  style: 'mapbox://styles/mapbox/empty-v9',   // Empty base
  center: BHARATPUR_CENTER,
  zoom: DEFAULT_ZOOM
});

// Add MapMyIndia raster tiles
map.on('load', () => {
  map.addSource('mmi-tiles', {
    type: 'raster',
    tiles: [tileUrl],
    tileSize: 256,
    attribution: '© MapMyIndia'
  });
  map.addLayer({ id: 'mmi-layer', type: 'raster', source: 'mmi-tiles' });

  // Then add GeoJSON overlays
  loadColonyBoundaries(map);
  loadPlotPolygons(map);
  loadCustomLayers(map);
});
```

### GeoJSON Overlay Pattern

```javascript
// Each overlay follows this pattern:
function addGeoJSONLayer(map, sourceId, layerId, geojsonUrl, paintConfig) {
  fetch(geojsonUrl)
    .then(r => r.json())
    .then(geojson => {
      map.addSource(sourceId, { type: 'geojson', data: geojson });
      map.addLayer({ id: layerId, type: 'fill', source: sourceId, paint: paintConfig });
    });
}

// Plots layer (color from property)
addGeoJSONLayer(map, 'plots', 'plots-fill', '/api/gis/plots/geojson/?colony=1', {
  'fill-color': ['get', 'color'],   // color is in GeoJSON properties
  'fill-opacity': 0.6,
  'fill-outline-color': ['get', 'color']
});
```

### Zoom-Level Behaviour

```
Zoom 0-9:   Show colony circles (clustered by zone)
Zoom 10-11: Show individual colony boundaries
Zoom 12-13: Show khasra boundaries
Zoom 14-15: Show individual plot polygons
Zoom 16+:   Show plot numbers inside polygons + tooltip detail
```

### Layer Control Panel (UI Spec)

```
┌───────────────────────────────┐
│  Base Layer                   │
│  ○ LIGHT  ○ DARK  ○ HYBRID    │
├───────────────────────────────┤
│  BDA Layers                   │
│  ☑  Colony Boundaries         │
│  ☑  Khasra Grid               │
│  ☑  Plots  [legend ▼]         │
│     ● Available   ● Patta OK  │
│     ● Missing     ● EWS       │
│     ● Lottery     ● Seniority │
├───────────────────────────────┤
│  Utility Layers               │
│  ☑  Water Mains               │
│  ☐  Sewerage Lines            │
│  ☐  Electricity Poles         │
│  ☐  Roads                     │
│  ☐  Drainage                  │
├───────────────────────────────┤
│  [🔍 Search plot/khasra...]   │
│  [⬆ Upload New Layer]         │
└───────────────────────────────┘
```

### Custom Layer Upload (Frontend → Backend)

```
POST /api/gis/custom-layers/
  Content-Type: multipart/form-data
  Fields:
    file           → GeoJSON (.geojson) OR Shapefile ZIP (.zip with .shp, .dbf, .prj, .shx)
    name           → "Water Mains - West Zone"
    layer_type     → WATER | SEWERAGE | ELECTRICITY | ROADS | DRAINAGE | OTHER
    style          → {"stroke_color":"#0000FF","stroke_width":2,"opacity":0.7}
    is_public      → true | false
    colony_id      → 1  (optional, colony-specific)

Backend process:
  1. Parse file (fiona for shapefiles, json for GeoJSON)
  2. Validate geometries (shapely.is_valid)
  3. Reproject to EPSG:4326 if needed
  4. Store in gis_customlayer + gis_layerfeature tables
  5. Return GeoJSON for immediate map rendering
```

---

## 8. ROLE-BASED ACCESS CONTROL

### Permission Matrix

```
FEATURE                     ADMIN  SUPDT  STAFF  PUBLIC
─────────────────────────────────────────────────────────
Add / edit colony            ✓
View colony list             ✓      ✓      ✓
View colony stats            ✓      ✓      ✓
─────────────────────────────────────────────────────────
Edit plot status             ✓      ✓      ✓
Bulk import plots            ✓
Export plots                 ✓      ✓      ✓*
─────────────────────────────────────────────────────────
Add patta entry              ✓      ✓      ✓
Link document to patta       ✓      ✓      ✓
View patta ledger            ✓      ✓      ✓
Export patta ledger          ✓      ✓      ✓*
─────────────────────────────────────────────────────────
Upload documents             ✓      ✓      ✓
Verify documents             ✓      ✓
─────────────────────────────────────────────────────────
Create missing case          ✓      ✓      ✓
Assign missing case          ✓      ✓
Update missing case          ✓      ✓      ✓
Close missing case           ✓      ✓      ✓
─────────────────────────────────────────────────────────
View internal map            ✓      ✓      ✓
Upload custom layer          ✓      ✓      ✓
Edit own custom layer        ✓      ✓      ✓*
View public map              ✓      ✓      ✓      ✓
Export GeoJSON               ✓      ✓      ✓      ✓
─────────────────────────────────────────────────────────
Generate reports             ✓      ✓      ✓*
View audit logs              ✓
Manage users                 ✓
─────────────────────────────────────────────────────────
  * = own assigned colonies only
```

### Django Permission Classes (Pattern)

```python
# users/permissions.py

class IsAdmin(BasePermission):
    def has_permission(self, request, view):
        return request.user.role == 'admin'

class IsAdminOrSuperintendent(BasePermission):
    def has_permission(self, request, view):
        return request.user.role in ('admin', 'superintendent')

class IsStaffOrAbove(BasePermission):
    def has_permission(self, request, view):
        return request.user.role in ('admin', 'superintendent', 'staff')

class IsAssignedColony(BasePermission):
    """Staff can only modify their assigned colonies"""
    def has_object_permission(self, request, view, obj):
        if request.user.role in ('admin', 'superintendent'):
            return True
        colony_id = getattr(obj, 'colony_id', None)
        return ColonyAssignment.objects.filter(
            user=request.user, colony_id=colony_id
        ).exists()
```

---

## 9. KEY WORKFLOWS

### Workflow A: Scanning & Linking a Patta

```
ACTOR: Staff member (scanning cell)

1. Upload scanned PDF
   → POST /api/documents/
   → file: "GC-062_patta_2019.pdf"
   → document_type: "patta"
   → System auto-suggests: linked_plot_id = GC-062 (from filename)
   → Staff confirms → document created (status: "uploaded")

2. Go to Patta Ledger, search "GC-062"
   → Find: Patta BDA/2019/1456, Owner "Priya Devi"
   → Status badge: RED "missing"

3. Click "Link Document"
   → POST /api/pattas/{id}/link-document/
   → Body: {document_id: <uploaded_doc_id>}

4. System auto-updates
   → PlotPattaMapping.document_status = "verified"
   → Patta.status = "issued"
   → If missing case exists → case status → "resolved"

RESULT: ✓ Linked  ✓ Ledger updated  ✓ Case closed
```

### Workflow B: Recording a Multi-Plot Patta

```
ACTOR: Staff member

SCENARIO: Patta BDA/2016/0001 issued for 3 adjacent plots.
  SN-001 (120 sqm), SN-002 (80 sqm), SN-045 (50 sqm boundary portion)

1. POST /api/pattas/
   Body: {
     patta_number: "BDA/2016/0001",
     colony_id: 1,
     allottee_name: "Ramesh Chand Gupta",
     issue_date: "2016-07-15",
     plots: [
       {plot_id: 1, ownership_share_pct: 57},
       {plot_id: 2, ownership_share_pct: 38},
       {plot_id: 45, ownership_share_pct: 24}
     ]
   }

2. System creates PlotPattaMapping entries
   ├── (plot=SN-001, patta=BDA/2016/0001, share=57%, role=Owner)
   ├── (plot=SN-002, patta=BDA/2016/0001, share=38%, role=Co-owner)
   └── (plot=SN-045, patta=BDA/2016/0001, share=24%, role=Co-owner)

3. Patta Ledger shows for each plot
   SN-001: BDA/2016/0001 (57%, co-plots: SN-002, SN-045)
   SN-002: BDA/2016/0001 (38%, co-plots: SN-001, SN-045)
   SN-045: BDA/2016/0001 (24%, co-plots: SN-001, SN-002)

RESULT: ✓ Multi-plot patta correctly recorded
```

### Workflow C: Missing Patta Detection & Case Resolution

```
ACTOR: Staff (scanning) → Superintendent (supervision) → Officer (resolution)

1. During scanning: Ledger has entry for SN-045, Patta BDA/2011/0892
   But no physical file found.

2. Celery nightly task auto-creates missing case
   → POST /api/missing-cases/ (automated)
   → case_id: "MC-003", status: "under_inquiry"
   → assigned_to: Ram Prasad Yadav (default inquiry officer)

3. Officer adds timeline entries
   → POST /api/missing-cases/MC-003/activity/
   → {activity_type: "comment", notes: "Checked vault, file missing"}

4. Status progresses
   under_inquiry
     → PUT status: "duplicate_issued"  (duplicate patta issued)
     → PUT status: "gazette_pending"   (waiting for gazette)
     → PUT status: "resolved"          (gazette published)

5. On resolve: Plot SN-045 status auto-updates to "patta_ok"

RESULT: ✓ Full timeline captured  ✓ Compliance documented
```

### Workflow D: Adding a Custom Utility Layer

```
ACTOR: Admin / Superintendent

1. Click "Upload Layer" in Map page layer panel

2. Fill modal:
   - File: water_mains_2024.geojson
   - Name: "Water Mains - West Zone"
   - Type: WATER
   - Color: #2563EB  (blue)
   - Opacity: 0.7
   - Scope: Public

3. POST /api/gis/custom-layers/
   Backend: parse → validate → store in PostGIS → return GeoJSON

4. Layer appears in map sidebar (checkbox)
   Toggle ON → blue lines render over MapMyIndia base map
   Click feature → tooltip: {Diameter: 100mm, Material: PVC, Depth: 1.5m}

5. Other users: toggle on/off, download GeoJSON, cannot edit

RESULT: ✓ Utility data shared  ✓ Overlays BDA plots correctly
```

---

## 10. PROJECT STRUCTURE

### Backend (Django)

```
backend/
├── config/
│   ├── settings.py
│   ├── settings_dev.py
│   ├── settings_prod.py
│   ├── urls.py
│   ├── wsgi.py
│   └── celery.py
│
├── apps/
│   ├── users/
│   │   ├── models.py       ← CustomUser, ColonyAssignment
│   │   ├── serializers.py
│   │   ├── views.py
│   │   ├── urls.py
│   │   ├── permissions.py  ← IsAdmin, IsStaffOrAbove, IsAssignedColony
│   │   └── admin.py
│   │
│   ├── colonies/
│   │   ├── models.py       ← Colony, Khasra
│   │   ├── serializers.py
│   │   ├── views.py
│   │   ├── urls.py
│   │   └── admin.py
│   │
│   ├── plots/
│   │   ├── models.py       ← Plot, PlotKhasraMapping
│   │   ├── serializers.py
│   │   ├── views.py
│   │   ├── urls.py
│   │   ├── filters.py
│   │   └── admin.py
│   │
│   ├── pattas/
│   │   ├── models.py       ← Patta, PlotPattaMapping, PattaVersion
│   │   ├── serializers.py
│   │   ├── views.py
│   │   ├── urls.py
│   │   └── admin.py
│   │
│   ├── documents/
│   │   ├── models.py       ← Document
│   │   ├── serializers.py
│   │   ├── views.py
│   │   ├── urls.py
│   │   └── storage.py      ← S3 / local storage abstraction
│   │
│   ├── missing_cases/
│   │   ├── models.py       ← MissingCase, CaseActivity
│   │   ├── serializers.py
│   │   ├── views.py
│   │   ├── urls.py
│   │   └── tasks.py        ← Celery: auto-create missing cases
│   │
│   ├── gis/
│   │   ├── models.py       ← CustomLayer, LayerFeature
│   │   ├── serializers.py
│   │   ├── views.py
│   │   ├── urls.py
│   │   └── geo_utils.py    ← Shapefile parsing, GeoJSON helpers
│   │
│   ├── dashboard/
│   │   ├── serializers.py
│   │   ├── views.py
│   │   └── urls.py
│   │
│   └── audit/
│       ├── models.py       ← AuditLog
│       ├── middleware.py   ← Auto-log all create/update/delete
│       └── admin.py
│
├── manage.py
├── requirements.txt
├── .env
└── Dockerfile
```

### Frontend (React + Vite)

```
frontend/
├── src/
│   ├── api/
│   │   ├── client.js          ← Axios instance + interceptors (JWT refresh)
│   │   └── endpoints.js       ← All API URL constants
│   │
│   ├── context/
│   │   ├── AuthContext.jsx
│   │   ├── FilterContext.jsx
│   │   └── NotificationContext.jsx
│   │
│   ├── hooks/
│   │   ├── useQuery.js
│   │   ├── useMutation.js
│   │   ├── useForm.js
│   │   ├── useDebounce.js
│   │   └── useLocalStorage.js
│   │
│   ├── lib/
│   │   ├── plotStatus.js      ← Status → color/label mapping
│   │   ├── formatters.js      ← Date, currency, area formatters
│   │   └── geoUtils.js        ← GeoJSON helpers
│   │
│   ├── components/
│   │   ├── common/
│   │   │   ├── Modal.jsx
│   │   │   ├── DataTable.jsx
│   │   │   ├── FilterBar.jsx
│   │   │   ├── StatusBadge.jsx
│   │   │   ├── Pagination.jsx
│   │   │   └── LoadingSpinner.jsx
│   │   │
│   │   ├── layout/
│   │   │   ├── Sidebar.jsx
│   │   │   ├── Topbar.jsx
│   │   │   └── MainLayout.jsx
│   │   │
│   │   ├── map/
│   │   │   ├── MapContainer.jsx
│   │   │   ├── LayerControlPanel.jsx
│   │   │   ├── FeatureTooltip.jsx
│   │   │   └── UploadLayerModal.jsx
│   │   │
│   │   └── plots/
│   │       └── InteractivePlotLayout.jsx  ← SVG grid view
│   │
│   ├── pages/
│   │   ├── LoginPage.jsx
│   │   ├── DashboardPage.jsx
│   │   ├── ColoniesPage.jsx
│   │   ├── PlotsPage.jsx
│   │   ├── MapPage.jsx
│   │   ├── PattaLedgerPage.jsx
│   │   ├── MissingCasesPage.jsx
│   │   ├── DocumentsPage.jsx
│   │   ├── ReportsPage.jsx
│   │   ├── PublicMapPage.jsx
│   │   └── AdminPanel.jsx
│   │
│   ├── App.jsx                ← Router setup + PrivateRoute
│   ├── main.jsx
│   └── index.css
│
├── .env
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
└── package.json
```

---

## 11. TECHNOLOGY STACK

### Backend

| Technology | Version | Purpose |
|-----------|---------|---------|
| Python | 3.11+ | Language |
| Django | 4.2 LTS | Framework |
| Django REST Framework | 3.14+ | REST API |
| PostgreSQL | 14+ | Database |
| PostGIS | 3.3+ | Spatial / GIS queries |
| Redis | 7+ | Cache + Celery broker |
| Celery | 5.3+ | Async tasks (auto-case creation, report export) |
| Gunicorn | 20+ | WSGI server |
| Nginx | 1.24+ | Reverse proxy |
| django-storages | 1.14+ | S3 / local file storage |
| fiona + shapely | Latest | Shapefile parsing + geometry validation |
| openpyxl | 3.1+ | Excel report generation |
| reportlab | 4.0+ | PDF report generation |
| drf-yasg | 1.21+ | Swagger API documentation |
| djangorestframework-simplejwt | 5.3+ | JWT authentication |

### Frontend

| Technology | Version | Purpose |
|-----------|---------|---------|
| JavaScript | ES2023 | Language |
| React | 18+ | UI framework |
| Vite | 4.4+ | Build tool / dev server |
| Tailwind CSS | 3.3+ | Utility-first styling |
| Mapbox GL JS | 2.15+ | Map rendering |
| MapMyIndia | API | Raster base tiles |
| React Query | 3.39+ | Server state + caching |
| Axios | 1.4+ | HTTP client |
| React Hook Form | 7.45+ | Form state management |
| React Router | 6+ | Client-side routing |
| Lucide React | Latest | Icons |

### Infrastructure

| Technology | Purpose |
|-----------|---------|
| Docker + Docker Compose | Containerization |
| GitHub Actions | CI/CD pipeline |
| AWS S3 | Document file storage |
| AWS CloudFront | CDN for document downloads |

---

## 12. PERFORMANCE & OPTIMIZATION

### Database Rules

```
1. ALWAYS use cursor-based pagination for plots/pattas (2375+ rows)
   → Never: OFFSET 2000 (slow)
   → Use: WHERE id > last_seen_id LIMIT 50

2. Use SELECT DISTINCT with JOINs, never subqueries with IN()
   → Slow: WHERE id IN (SELECT patta_id FROM ... WHERE plot_id=123)
   → Fast: JOIN pattas_plotpattamapping ppm ON p.id = ppm.patta_id WHERE ppm.plot_id=123

3. Use GIST indexes for all geometry columns (already in schema above)

4. Use full-text search for allottee_name, patta_number
   → Already indexed: idx_patta_fts using GIN + to_tsvector
```

### Caching (Redis TTLs)

```
colonies:all          → 1 hour    (invalidate on colony create/update)
colony:{id}:stats     → 10 min    (invalidate on any plot/patta change)
pattas:colony:{id}    → 10 min    (invalidate on patta create/update)
dashboard:stats       → 5 min     (invalidate on any change)
custom_layers         → 1 hour    (invalidate on layer upload/delete)
geojson:plots:{colony_id}  → 30 min  (invalidate on plot status change)
```

### Map Performance

```
Problem: Rendering 2375 plot polygons is slow.
Solution:
  1. Only render plots when zoom >= 14
  2. Use clustering (Mapbox supercluster) at zoom < 14
  3. Lazy-load: only fetch plots for visible colony (by bounding box)
  4. Pre-generate GeoJSON files per colony (cache on S3)
  5. Use vector tiles for production (if needed)
```

### Async Jobs (Celery)

```python
# Run these as background tasks, NOT in the request-response cycle:

@shared_task
def auto_create_missing_cases(colony_id):
    """
    Nightly: find plots with pattas in ledger but no linked document.
    Create missing_case if not already exists.
    """
    pass

@shared_task
def generate_report_file(report_type, params, user_id):
    """
    Generate Excel/PDF asynchronously.
    Save to S3. Email download link to user.
    """
    pass

@shared_task
def parse_uploaded_shapefile(layer_id, file_path):
    """
    Parse shapefile in background.
    Update gis_customlayer status when done.
    """
    pass
```

---

## 13. QUICK REFERENCE

### Endpoint Summary

```
Auth:           /api/auth/login | refresh | logout | me
Colonies:       /api/colonies/
Khasras:        /api/khasras/
Plots:          /api/plots/
Pattas:         /api/pattas/
Documents:      /api/documents/
Missing Cases:  /api/missing-cases/
GIS:            /api/gis/
Dashboard:      /api/dashboard/
Reports:        /api/reports/
Users:          /api/users/         (admin)
Audit Logs:     /api/audit-logs/    (admin)
```

### Status Values

```
Plot:
  available | allotted_lottery | allotted_seniority | ews | patta_ok | patta_missing | cancelled

Patta:
  issued | missing | cancelled | amended | superseded

Missing Case:
  under_inquiry | duplicate_issued | gazette_pending | ledger_update_pending | resolved

Document:
  uploaded | verified | linked

User Role:
  admin | superintendent | staff | public
```

### Django App → DB Table Mapping

```
users          → users_customuser, users_colonyassignment
colonies       → colonies_colony, colonies_khasra
plots          → plots_plot, plots_plotkhasramapping
pattas         → pattas_patta, pattas_plotpattamapping
documents      → documents_document
missing_cases  → missing_cases_missingcase, missing_cases_caseactivity
gis            → gis_customlayer, gis_layerfeature
audit          → audit_auditlog
```

### Coordinate Reference System

```
All geometries stored in EPSG:4326 (WGS 84 / GPS coordinates)
Bharatpur, Rajasthan approximate center: 77.4933°E, 27.2152°N
```

### Important Business Rules

```
1. Patta shares must sum to ~100% across all plots in a patta.
   (Can be slightly off due to boundary areas.)

2. primary_khasra_id is always set. PlotKhasraMapping is ONLY for
   plots that cross a boundary (5-10% of all plots).

3. When a patta is superseded, old patta status = "superseded",
   superseded_by_id = new patta id. All PlotPattaMapping entries
   must be updated to point to the new patta.

4. Missing cases are auto-created by Celery nightly job.
   Staff can also create them manually.

5. Document retention: 7 years minimum (government compliance).
   Soft delete only — never hard delete documents.

6. Audit log: every create/update/delete on plots, pattas,
   documents, missing_cases must be logged via middleware.

7. Colony data (names, zones, etc.) comes from the Google Sheet:
   https://docs.google.com/spreadsheets/d/18YQQE1ycKABtGVl-WXDNta2DXz9Z6LXYkCaiDHLJndE
   Always use actual colony names from that sheet.
```

---

## HOW TO USE THIS DOCUMENT IN CLAUDE CODE SESSIONS

**Starting a session:**
```
Paste this full document and say:
"I am working on BDA LMIS. Based on this context document, please [task]."
```

**Example prompts:**

```
"Implement the Django Colony and Khasra models with PostGIS geometry fields."

"Create the PlotPattaMapping model and a DRF serializer that returns co-plots."

"Write the GET /api/plots/geojson/ endpoint returning FeatureCollection
 with plot status color in properties."

"Create the React MapComponent using Mapbox GL with MapMyIndia raster tiles
 and a GeoJSON overlay for plots."

"Implement cursor-based pagination for the patta ledger API endpoint."

"Write the Celery task that auto-creates missing cases nightly."

"Create the LayerControlPanel React component with toggles for BDA and
 custom utility layers."
```

---

*Document Version: 4.1 | Status: Ready for Implementation*
*Note: Update colony names section from Google Sheet before data import.*
*Sheet: https://docs.google.com/spreadsheets/d/18YQQE1ycKABtGVl-WXDNta2DXz9Z6LXYkCaiDHLJndE*

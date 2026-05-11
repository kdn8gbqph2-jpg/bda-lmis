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

BDA divides Bharatpur into **two zones — East and West**. Colony-to-zone
assignment is maintained in the admin (no automatic geographic split).

```
ZONE          APPROX COLONIES   APPROX PLOTS
─────────────────────────────────────────────
East                 ~            ~
West                 ~            ~
─────────────────────────────────────────────
TOTAL                72         2,375
```

### Colony Fields (Per Record)

```
name                     VARCHAR(200)  UNIQUE  — Official colony name from BDA records
colony_type              VARCHAR(30)           — bda_scheme | private_approved | suo_moto | pending_layout | rejected_layout
zone                     VARCHAR(20)           — East | West
status                   VARCHAR(20)           — active | new | archived
chak_number              INT (nullable)        — Revenue block number (चक नम्बर)
conversion_date          DATE (nullable)       — Date of conversion from agri to urban land
layout_application_date  DATE (nullable)       — Date layout plan was submitted for approval
layout_approval_date     DATE (nullable)       — Layout sanctioned date
dlc_file_number          VARCHAR(100)  UNIQUE (nullable) — DLC reference number
notified_area_bigha      DECIMAL(10,2) (nullable)        — Total area in Bigha
total_residential_plots  INT DEFAULT 0         — Count of residential plots
total_commercial_plots   INT DEFAULT 0         — Count of commercial plots
rejection_reason         TEXT (blank)          — Required when colony_type='rejected_layout'; shown publicly
remarks                  TEXT (blank)          — Internal/public notes
map_pdf                  FileField (nullable)  — Uploaded PDF layout plan  → colony_maps/pdf/
map_svg                  FileField (nullable)  — Uploaded SVG boundary map → colony_maps/svg/
map_png                  FileField (nullable)  — Uploaded PNG thumbnail    → colony_maps/png/

Computed properties (not DB columns):
  total_plots              = total_residential_plots + total_commercial_plots
  has_map                  = bool(map_pdf or map_svg or map_png)
  available_map_formats    = list of uploaded formats, e.g. ['pdf', 'png']
```

### Colony Type Choices

```
bda_scheme        → BDA Scheme (default)
private_approved  → Private Approved Colony
suo_moto          → SUO-Moto Colony Case
pending_layout    → Pending Colony Layout
rejected_layout   → Rejected Colony Layout (rejection_reason required)
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

### Colonies (Staff — auth required)

```
GET    /colonies/                    ?zone=East&status=active&colony_type=bda_scheme&search=X&page=1
POST   /colonies/                    admin only
GET    /colonies/{id}/
PUT    /colonies/{id}/               admin only
DELETE /colonies/{id}/               admin only (soft delete)
GET    /colonies/{id}/stats/         {total_plots, pattas_issued, pattas_missing, scan_pct}
GET    /colonies/{id}/geojson/
GET    /colonies/{id}/map/<fmt>/     fmt = pdf | svg | png  → FileResponse attachment
GET    /colonies/geojson/            FeatureCollection of all colonies
```

### Public Colony Dashboard (no auth required)

```
GET    /public/colony-types/              [{value, label}, ...] — the 5 choices
GET    /public/colonies/                  ?colony_type=&zone=&search=&page=&page_size=
GET    /public/colonies/geojson/          ?colony_type=&zone=
GET    /public/colonies/{id}/             full detail + khasras + available_map_formats
GET    /public/colonies/{id}/map/<fmt>/   fmt = pdf | svg | png → download map file
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
── Guest routes (redirect to /dashboard if already logged in) ──
/login                         LoginPage

── Public colony dashboard (no auth required) ──────────────────
/public                        PublicDashboardPage    (5 category cards + search)
/public/colonies               PublicColoniesPage     (filterable list by type/zone)
/public/colonies/:id           PublicColonyDetailPage (khasras + map downloads)

── Staff routes (RequireAuth guard — redirect to /login) ───────
/dashboard                     DashboardPage
/colonies                      ColoniesPage
/plots                         PlotsPage
/map                           MapPage  (internal, all layers)
/patta-ledger                  PattaLedgerPage
/patta-ledger/:id              PattaDetailPage
/documents                     DocumentsPage
/reports                       ReportsPage

── Admin only (RequireAdmin guard) ─────────────────────────────
/admin/users                   UsersPage
/admin/audit-logs              AuditLogsPage
```

**Router API:** `createBrowserRouter` (React Router v7 data router — NOT legacy `<BrowserRouter>` + `<Routes>`)

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
        │   ├── ZoneBreakdownChart  (pie, 2 zones)
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
| FileSystemStorage | Django built-in | Local file storage (no S3) |
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
| Local filesystem + Nginx | Document file storage and serving |

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

*Document Version: 4.2 | Status: In Development*

---

## 14. ACTUAL DATA — PATTA LEDGER EXCEL ANALYSIS

> Source: `Patta Ledger Format.xlsx` — the real ledger file used for data import.
> Analysed: 2026-05-07

### Excel Structure

Each **sheet = one colony**. The workbook has **~72 colony sheets** (not 41 as originally estimated).
Three sheets are empty placeholders (Sheet1, Sheet2, Sheet3).

**Sheet header rows (rows 1–6) per colony:**

| Row | Hindi Label | English | Example Value |
|-----|-------------|---------|---------------|
| 1 | योजना का नाम | Colony/Scheme Name | बौद्ध बिहार भरतपुर |
| 2 | ग्राम का नाम | Village/Town | भरतपुर |
| 3 | चक नम्बर | Chak (Block) Number | 1, 2, 3 |
| 4 | लेआउट प्लान अनुमोदन दिनांक | Layout Approval Date | 01/04/2022 |
| 5 | लेआउट प्लान अनुसार कुल भुखण्डों की संख्या | Total Plots per Layout | 61 |
| 6 | खसरा नम्बर | Khasra Numbers (comma-separated) | 1448,1449,1450,1451,... |

**Data columns (row 7 header, row 9+ data):**

| Col | Hindi Header | English | DB Field |
|-----|--------------|---------|----------|
| A | क्र.सं. | Serial Number | — |
| B | आवंटी का नाम | Allottee Name | `pattas_patta.allottee_name` |
| C | आवंटी का पता | Allottee Address | `pattas_patta.allottee_address` *(new field)* |
| D | खसरा नम्बर | Khasra Number(s) | `plots_plotkhasramapping` |
| E | भूखण्ड संख्या | Plot Number | `plots_plot.plot_number` |
| F | भूखण्ड का कुल क्षेत्रफल (वर्गगज) | Plot Area in **Square Yards** | `plots_plot.area_sqy` *(see note)* |
| G | पट्टा संख्या | Patta Number (integer) | `pattas_patta.patta_number` |
| H | पट्टा जारी करने की दिनांक | Patta Issue Date | `pattas_patta.issue_date` |
| I | चालान संख्या | Challan Number | `pattas_patta.challan_number` *(new field)* |
| J | चालान जारी करने की दिनांक | Challan Date | `pattas_patta.challan_date` *(new field)* |
| K | लीज जमा का विवरण — राशि | Lease Amount Paid | `pattas_patta.lease_amount` *(new field)* |
| L | लीज जमा का विवरण — अवधि | Lease Duration | `pattas_patta.lease_duration` *(new field)* |
| M | नियमन पत्रावली उपस्थित | Regulation File Present (हाँ/नही) | `pattas_patta.regulation_file_present` *(new field)* |
| N | DMS FILE NUMBER | DMS Scanned Doc Reference | `documents_document` linked via `pattas_patta` |
| O | विशेष विवरण | Special Remarks | `pattas_patta.remarks` *(new field)* |

### Critical Corrections to Original Data Model

These differ from the original context.md assumptions:

#### 1. Area Unit is Square Yards, NOT Square Metres
```
Excel stores area in वर्गगज (Square Yards).
1 Square Yard = 0.836127 sqm

Action: Add area_sqy DECIMAL(10,2) to plots_plot.
        Keep area_sqm as a computed/stored column (area_sqy * 0.836127).
        Import from Excel using area_sqy. Display both in UI.
```

#### 2. Patta Number is a Plain Integer, NOT "BDA/YYYY/XXXX"
```
Excel column G: 3498, 2578, 2984, 1509 ...
The "BDA/2016/0001" format in original context was assumed — it does not exist.

Action: Store patta_number as VARCHAR(20), import the raw integer as string.
        Example stored values: "3498", "2578", "1509"
```

#### 3. DMS File Number Format is BHR + 6 digits
```
Column N: BHR102703, BHR102702, BHR103676, BHR105647 ...
This is the scanned document reference in the DMS (Document Management System).
Maps to documents_document linked to a patta.
Some plots show "NO" — means not yet scanned/uploaded.
```

#### 4. Plot Numbers Can Be Alphanumeric with Sub-Plots
```
Examples seen: 27, 27A, 27B, 4A, 10, 10A, 10B, 17, 17A, 18, 18A
These are genuine sub-divisions of a plot that were split between multiple allottees.
VARCHAR(20) on plots_plot.plot_number is correct — already handled.
```

#### 5. Regulation File Present is a Boolean Field on the Patta
```
Column M values: हाँ (Yes), नही (No), None (blank)
This directly tracks whether the paper file is physically present.
Maps to regulation_file_present BOOLEAN on pattas_patta.
This replaces the "missing patta" detection workflow (which is excluded from scope).
```

#### 6. Chak Number ≠ Zone
```
"चक नम्बर" (Chak Number) = revenue block identifier (1, 2, 3...)
This is NOT the same as the zone (East/West).
Zones need to be assigned separately — not present in Excel.
Chak number can be stored in colonies_colony as a separate field.
```

#### 7. Actual Colony Count is ~72, Not 41
```
The workbook contains ~72 data sheets (colony tabs), not 41.
All colony names are in Hindi script.
The zone assignment for each colony must be done manually or via a reference sheet.
```

#### 8. New Fields Needed on pattas_patta

```sql
ALTER TABLE pattas_patta ADD COLUMN allottee_address TEXT;
ALTER TABLE pattas_patta ADD COLUMN challan_number    VARCHAR(50);
ALTER TABLE pattas_patta ADD COLUMN challan_date      DATE;
ALTER TABLE pattas_patta ADD COLUMN lease_amount      DECIMAL(12,2);
ALTER TABLE pattas_patta ADD COLUMN lease_duration    VARCHAR(20);  -- e.g. "10 वर्ष"
ALTER TABLE pattas_patta ADD COLUMN regulation_file_present BOOLEAN DEFAULT NULL;
ALTER TABLE pattas_patta ADD COLUMN remarks           TEXT;
```

#### 9. New Field Needed on colonies_colony

```sql
ALTER TABLE colonies_colony ADD COLUMN chak_number INT;
```

#### 10. New Field Needed on plots_plot

```sql
ALTER TABLE plots_plot ADD COLUMN area_sqy DECIMAL(10,2);
-- area_sqm = area_sqy * 0.836127 (computed on import)
```

### Actual Colony Names (from Excel Sheet Tabs)

Full list of ~72 colonies in Hindi as they appear in the source file:

```
बौद्ध बिहार, जगन्नाथपुरी फेज-3, तेजसिंह नगर, विष्णु नगर,
पुष्प विहार, शेरसिंह नगर सरकूलर रोड़, महेश्वरी नगर,
कृष्णा बिहार (नई मण्डी), यश बिहार, चामुण्डा माता,
नियर कृष्णा नगर, गोरखधाम, राधिका बिहार ब्लॉक-A,
राधिका बिहार ब्लॉक-बी, राधिका बिहार कॉलोनी, राधा नगर फेज-3,
राधा नगर, शेरसिंह नगर (इन्द्रा नगर), बौद्ध बिहार,
सूर्या सिटी, एल.बी. शास्त्री नगर फेज-1, ओ.एम.जी. सिटी,
ब्रिगेडियर घासीराम नगर, सेवर कलां खसरा न. 1829,
कृष्णा वाटिका-2, मारूती नन्दन वाटिका फेज-1, कैनाल कॉलौनी,
शास्त्री नगर खसरा न. 1110-1111, विमल कुन्ज कॉलौनी,
बृज नगर फेज-7, जगन्नाथ पुरी फेज-4, सुभाष नगर फेज-10,
आनन्द नगर, रन्जीत नगर एफसीआई गोदाम, हर्ष बिहार फेज-1,
मोहन बिहार, बृज बिहार फेज-2, सुजान वाटिका,
जगन्नाथ पुरी फेज-5, सुभाष नगर फेज-11, सुभाष नगर फेज-12,
हरीकुन्ज फेज-2, बृज नगर नोर्थ जोन-2, तिलक नगर फेज-8,
जसवन्त नगर फेज-10, आनन्द नगर फेज-4, जयन्ती नगर,
जसवंत नगर हीरादास का नगला, पुष्पवाटिका कॉलौनी फेज-2,
कृष्ण वाटिका, बापू नगर ईदगाह कॉलौनी फेज-2,
बापू नगर ईदगाह कॉलौनी फेज-3, विश्व सूर्य नगर-A/B/C/D/E,
विजय नगर (सारस चौराहा), रघुनाथ पुरी ब्लॉक-बी, प्रीती बिहार,
रघुनाथपुरी, प्रिन्स नगर फेज-3, हरीकुन्ज फेज-3, कमल विला,
हरीकुन्ज फेज-1, पदम बिहार फेज-2, रूद्र नगर,
गोविन्द निवास (कृष्णा नगर), प्रिन्स नगर कॉलोनी फेज-3,
राजेन्द्र सूरी नगर, गणेश नगर फेज-1, गणेश नगर फेज-2,
गणेश नगर फेज-3, गणेश नगर फेज-4, देव बिहार,
कृष्णा बिहार (जाटौली घना)
```

---

## 15. IMPLEMENTATION STATUS & REMAINING WORK

> Last updated: 2026-05-11 (rev 2 — public dashboard modernization)

### ✅ Completed

#### Infrastructure
| Task | Details |
|------|---------|
| Git repository | `bda-lmis` at github.com/kdn8gbqph2-jpg/bda-lmis |
| Branch structure | `main` (stable baseline), `develop` (active work) |
| Docker Compose | 5 services: PostgreSQL+PostGIS 14/3.3, Redis 7, Django backend, Celery worker, Vite frontend |
| `backend/Dockerfile` | Python 3.11-slim + GDAL/GEOS/PROJ for GeoDjango |
| `frontend/Dockerfile` | Node 20 Alpine + Vite dev server with `--host` flag |
| `.env.example` | All environment variables templated |
| `.dockerignore` | Excludes `venv/` and `node_modules/` from build context |
| `config/settings.py` | PostGIS DB, DRF + JWT (simplejwt), CORS, Redis cache, Celery, Asia/Kolkata TZ, local FileSystemStorage |
| `config/celery.py` + `__init__.py` | Celery app wired with `autodiscover_tasks` |
| `config/urls.py` | Auth endpoints + all app routes under `/api/` |

#### Backend apps — fully implemented
| App | Files | What's done |
|-----|-------|-------------|
| `users` | `managers.py`, `models.py`, `permissions.py`, `serializers.py`, `views.py`, `urls.py`, `admin.py` | `CustomUser` (email login, role/emp_id), `ColonyAssignment`, RBAC permission classes, JWT login/logout/me/refresh, user CRUD + assign-colonies (admin only) |
| `colonies` | `models.py`, `serializers.py`, `filters.py`, `views.py`, `views_public.py`, `urls.py`, `admin.py` | `Colony` (PostGIS MultiPolygon, chak_number, **colony_type** 5 choices, **layout_application_date**, **rejection_reason**, **remarks**, **map_pdf/svg/png** FileFields, **has_map** + **available_map_formats** properties, save() clears rejection_reason on type change), `Khasra` (PostGIS Polygon); **staff serializers**: ColonyListSerializer + ColonyDetailSerializer (with validation for rejected_layout); **public serializers**: PublicColonyListSerializer, PublicColonyDetailSerializer, PublicKhasraSerializer; filters: zone/status/colony_type/has_map; CRUD + `/stats/` + `/geojson/` + **`/map/<fmt>/`** (PDF/SVG/PNG download) endpoints; **public views** (AllowAny): `/api/public/colonies/`, `/api/public/colonies/{id}/`, `/api/public/colonies/{id}/map/<fmt>/`, `/api/public/colonies/geojson/`, `/api/public/colony-types/`; Redis caching; GISModelAdmin with full fieldsets |
| `plots` | `models.py`, `serializers.py`, `filters.py`, `views.py`, `urls.py`, `admin.py` | `Plot` (area_sqy + area_sqm auto-computed, PostGIS Polygon, 7 status values), `PlotKhasraMapping` junction, list/detail/write/GeoJSON serializers (status color in properties), CRUD + soft-delete + `/pattas/` + `/documents/` + `/history/` + `/geojson/` + `/bulk-import/` CSV endpoint, Redis caching on geojson, `GISModelAdmin` |
| `pattas` | `models.py`, `serializers.py`, `filters.py`, `views.py`, `urls.py`, `admin.py` | `Patta` (all Excel fields: patta_number VARCHAR, allottee_address, challan_number/date, lease_amount/duration, regulation_file_present BOOLEAN), `PlotPattaMapping` junction (ownership_share_pct, allottee_role), `PattaVersion` snapshot model, list/detail/write serializers, CRUD + soft-delete + `/versions/` + `/link-document/` + `/plots/` endpoints, auto-snapshot on every mutation |
| `documents` | `models.py`, `serializers.py`, `filters.py`, `views.py`, `urls.py`, `admin.py` | `Document` model (FileField → local filesystem via `MEDIA_ROOT`, dms_file_number BHR-format, links to plot + patta), upload serializer (validates MIME + 20 MB limit), list/detail serializers, CRUD + `/preview/` (FileResponse stream) + `/verify/` (superintendent+); hard-delete blocked (7-yr rule); `DocumentAdmin` with delete disabled |
| `gis` | `models.py`, `serializers.py`, `views.py`, `urls.py`, `admin.py`, `geo_utils.py` | `CustomLayer` (PostGIS GeometryCollection, style JSONB, metadata JSONB), `LayerFeature` (per-feature geometry + properties), `geo_utils.py` (shapefile ZIP parsing via fiona/shapely/pyproj, CRS reprojection to EPSG:4326, GeoJSON helpers), CRUD + shapefile/GeoJSON upload + `/geojson/` + `/validate/` endpoints; proxy GeoJSON views for colonies/khasras/plots; Redis caching |
| `dashboard` | `views.py`, `urls.py` | No models; aggregate views: `/stats/` (global KPIs), `/colony-progress/` (per-colony patta + regulation counts), `/zone-breakdown/` (zone-level aggregates); lazy imports for plots/pattas; Redis caching (5-10 min) |
| `audit` | `models.py`, `middleware.py`, `signals.py`, `serializers.py`, `views.py`, `urls.py`, `admin.py` | `AuditLog` model; `AuditMiddleware` with thread-local (user + IP + user-agent); `signals.py` — pre_save captures old DB state, post_save logs create/update, post_delete logs delete for Colony/Plot/Patta/Document; geometry/file fields excluded from JSON snapshots; admin-only `GET /api/audit-logs/` list view |

#### Backend apps — placeholder only
*(none — all apps have full implementations)*

#### Auth endpoints live (once Docker is up + migrations run)
```
POST /api/auth/login/    → {access, refresh, user{id,role,emp_id,...}}
POST /api/auth/refresh/
POST /api/auth/logout/   → blacklists refresh token
GET  /api/auth/me/       → current user profile
```

---

### 🔲 Remaining — Backend (in dependency order)

#### 1. ~~`audit` signals~~ ✅ DONE
#### 2. ~~Migrations & first run~~ ✅ DONE
All 48 migrations applied. Superuser: `admin@bda.gov.in` / emp_id `ADMIN001`.

#### 3. ~~Data import command~~ ✅ DONE
`colonies/management/commands/import_patta_ledger.py`
- `--file`, `--dry-run`, `--colony` flags
- Per-sheet: upserts Colony → Khasras → Plots → Pattas → PlotPattaMappings → Document stubs
- Handles compound khasra numbers (1450/1887), comma-separated khasra cells, alphanumeric plot numbers, "NO" in DMS column, blank allottee rows
- Idempotent (get_or_create throughout); wrapped in per-sheet atomic transactions

To run after copying the Excel file into the container:
```bash
docker compose cp "Patta Ledger Format.xlsx" backend:/app/
docker compose exec backend python manage.py import_patta_ledger --file /app/Patta\ Ledger\ Format.xlsx
# dry-run first:
docker compose exec backend python manage.py import_patta_ledger --file /app/... --dry-run
```

#### 4. Celery tasks  ← NEXT BACKEND ITEM
- [ ] `generate_report_file(report_type, params, user_id)` — async Excel/PDF export
- [ ] `parse_uploaded_shapefile(layer_id, file_path)` — background shapefile parsing

#### 5. Reports endpoints
- [ ] Patta ledger Excel export (`/api/reports/patta-ledger/`)
- [ ] Scanning status report (`/api/reports/scanning-status/`)
- [ ] Colony summary report (`/api/reports/colony-summary/`)

---

### ✅ Completed — Frontend (2026-05-11)

All core SPA pages and infrastructure are implemented and committed to `develop`:

#### Core (auth + staff)

| File | What's done |
|------|-------------|
| `src/api/client.js` | Axios instance, Bearer token attach, deduped silent JWT refresh on 401, `.data` unwrapper in response interceptor |
| `src/api/endpoints.js` | Full API surface: auth, colonies, khasras, plots, pattas, documents, dashboard, gis, users, auditLogs; **+ publicApi** (colony-types, colony list/detail/geojson, mapDownloadUrl) |
| `src/stores/useAuthStore.js` | Zustand + persist; setAuth/setTokens/logout/isAdmin/isStaffOrAbove |
| `src/lib/plotStatus.js` | PLOT_STATUS + PATTA_STATUS maps; getPlotStatus/getPattaStatus helpers |
| `src/components/ui/*` | Button, Badge, Card, Input/Select, Modal, Table, Spinner |
| `src/hooks/useDebounce.js` | Standard debounce hook |
| `src/components/layout/Sidebar.jsx` | Role-aware NavLink nav; admin section gated by isAdmin(); **BDA shield logo** at top |
| `src/components/layout/Topbar.jsx` | Breadcrumbs from route, live clock (en-IN locale) |
| `src/components/layout/MainLayout.jsx` | Sidebar + Topbar + `<Outlet />` |
| `src/App.jsx` | **`createBrowserRouter`** (React Router v7 data router API); RequireAuth/RequireGuest/RequireAdmin guards; lazy-loaded pages; public routes at `/public/*` outside auth |
| `src/pages/LoginPage.jsx` | Email/password form; dark gradient bg; **BDA shield logo** centered above heading; show/hide password toggle |
| `src/pages/DashboardPage.jsx` | 8 KPI StatCards + ColonyProgress table + ZoneBreakdown list |
| `src/pages/ColoniesPage.jsx` | Searchable/paginated table + ColonyDetailModal (stats + khasra chips) |
| `src/pages/PlotsPage.jsx` | Filtered/paginated table (colony + status dropdowns + plot search) |
| `src/pages/PattaLedgerPage.jsx` | Paginated table with colony filter + search; navigate-to-detail |
| `src/pages/PattaDetailPage.jsx` | Full patta detail: allottee, financials, linked plots, version history |
| `src/pages/DocumentsPage.jsx` | Filtered table with preview (window.open) + verify action |
| `src/pages/admin/UsersPage.jsx` | User list + CreateUserModal (role select, emp_id, etc.) |
| `src/pages/admin/AuditLogsPage.jsx` | Log table filtered by entity type + action |
| `frontend/public/bda-logo.png` | Official BDA shield logo (15 KB PNG, sourced from BDA branding files) |
| `frontend/index.html` | Favicon → `/bda-logo.png`; tab title: "BDA LMIS — Bharatpur Development Authority" |

#### Public portal (modernized 2026-05-11)

Government-grade dashboard built with reusable components, framer-motion, and Recharts.

| File | What's done |
|------|-------------|
| `src/components/public/categories.js` | **Single source of truth** for the 5 colony types — labels (EN + Hindi), description, lucide icon, Tailwind classes (accent / tint / badge / text / border) |
| `src/components/public/TopNavbar.jsx` | Sticky white bar with backdrop blur; mobile menu trigger; breadcrumb (desktop); central search input ("Search colonies, schemes, layouts…"); notification bell; Staff Login chip |
| `src/components/public/DashboardHeader.jsx` | Compact greeting block — title, English subtitle, Hindi subtitle, blue location chip; motion fade-in |
| `src/components/public/StatsCard.jsx` | Compact horizontal KPI — icon box + value + label; 6 color variants (blue/emerald/amber/red/orange/slate); skeleton on `loading`; framer-motion stagger |
| `src/components/public/CategoryCard.jsx` | Colony-type card — colored top accent strip, tinted icon box, count badge, EN+Hindi title, 2-line description, "View Colonies →" CTA; hover lift via `whileHover` |
| `src/components/public/QuickActions.jsx` | 5-up grid of action shortcuts — GIS Map, Auction Plots (Soon), Public Notices (Soon), Download Layouts, Land Bank (Soon); disabled-state styling |
| `src/components/public/MapPreview.jsx` | Mappls-ready stub — gridded gradient canvas with pulsing colored markers; layer toggle panel (Colonies / Khasras / Utility / Roads); "Coming soon" badge |
| `src/components/public/AnalyticsSection.jsx` | Recharts donut (Colony Distribution) + bar chart (Approval Status); shared brand-color palette; empty-state when no data |
| `src/components/layout/PublicLayout.jsx` | **Rewritten** — sidebar + TopNavbar + scrollable `<Outlet />`. Sidebar: BDA logo, 3 sections (Overview / Colony Categories / Browse), active nav items get **colored left-border indicator** (animated via `layoutId`), per-category color theming, mobile drawer with spring slide-in |
| `src/pages/public/PublicDashboardPage.jsx` | **Rewritten** — composition of all 7 components above; `max-w-[1400px]`; vertical flow: header → stats(6) → quick actions → categories(3-col grid) → map preview → analytics → disclaimer |
| `src/pages/public/PublicColoniesPage.jsx` | Filterable/paginated list (colony_type + zone + search); map-available badge; URL params synced to filters |
| `src/pages/public/PublicColonyDetailPage.jsx` | Colony detail: timeline, rejection reason alert, remarks info, map download buttons (PDF/SVG/PNG), khasra table |

#### New runtime dependencies

```
framer-motion  — page/card entry animations, active-nav layout transitions
recharts       — analytics donut + bar charts on public dashboard
```

#### Public portal design system

- **Color palette:** `blue-600` (primary), `emerald-500` (success), `amber-500` (warning), `red-500` (danger). Each colony type owns one palette consistently across sidebar, card, badge, donut slice, and bar segment.
- **Typography:** `text-xl/2xl` page title, `text-base` section heads, `text-xs` muted captions, Hindi sub-labels at `text-[10–11px] text-slate-400`.
- **Spacing:** consistent gap-2.5 / gap-3 / gap-4 cadence; compact cards (`p-4`, not `p-6`); section spacing `mb-6`.
- **Motion:** subtle fade + slide (0.25–0.35s); staggered card entry (0.04–0.05s delays); spring transitions for sidebar drawer and active-nav border.
- **Responsiveness:** sidebar collapses to drawer below `lg`; stats grid `2 → 3 → 6` cols; category grid `1 → 2 → 3` cols per spec.

### ⚠️ Known Issue — createBrowserRouter migration note

React Router v7 (`^7.15`) changed pathless layout route behavior. The `<BrowserRouter>` + `<Routes>` JSX API had a bug where pathless wrapper routes (e.g. `<Route element={<RequireAuth />}>`) would intercept ALL paths including `/public`, triggering the auth redirect. **Fixed** by switching to `createBrowserRouter` with explicit route objects — public routes in their own branch with `path: '/public'` parent, completely separate from auth guards.

### 🔲 Remaining — Frontend

- [ ] **MapPage** — Mapbox GL + MapMyIndia raster tiles + GeoJSON plot/colony overlays + LayerControlPanel (toggle layers) + UploadLayerModal
- [ ] **DocumentsPage enhancements** — drag-drop upload zone, PDF/image preview in modal (currently opens in new tab)
- [ ] **ReportsPage** — Report card grid + GenerateReportModal (once backend Celery tasks are ready)
- [ ] **PlotDetailModal** — full inline plot detail with linked pattas, documents, upload form (currently PlotsPage only shows table)

---

### Environment Setup Checklist (local dev)

```
[ ] Copy .env.example → .env and fill in DB_PASSWORD, SECRET_KEY
[ ] docker compose up --build          (first run: ~10 min)
[ ] docker compose exec backend python manage.py makemigrations
[ ] docker compose exec backend python manage.py migrate
[ ] docker compose exec backend python manage.py createsuperuser
[ ] Verify: http://localhost:8000/admin   (Django admin)
[ ] Verify: http://localhost:8000/api/auth/login/  (POST with email+password)
[ ] Verify: http://localhost:5173          (React dev server)
[ ] Obtain MapMyIndia API key from mappls.com and add to .env
```

---

### Key Technical Rules (read at start of every session)

1. **`missing_cases` app is OUT OF SCOPE** — no model, no endpoints, no Celery task
2. **Auction tracking is OUT OF SCOPE**
3. **Area unit**: Excel stores in वर्गगज (sq yards). Store `area_sqy` (raw) + `area_sqm` (= sqy × 0.836127) in DB. Display both in UI
4. **Patta number**: plain integer from Excel (e.g. `3498`). Store as `VARCHAR`, no `BDA/YYYY/XXXX` formatting
5. **React 19 + TanStack Query v5**: use `isPending` (not `isLoading`); `useMutation` callback shape changed — check v5 docs
6. **Tailwind v4**: uses `@import "tailwindcss"` in CSS — no `tailwind.config.js`
7. **Zustand** is installed for state — do not use React Context for global state
8. **PostGIS**: all geometry stored in EPSG:4326 (WGS 84). Bharatpur centre: `[77.4933, 27.2152]`
9. **React Router v7**: use `createBrowserRouter` + `RouterProvider` (data router API). Do NOT use `<BrowserRouter>` + `<Routes>` — pathless wrapper routes break in v7.15
10. **Public API**: `/api/public/*` uses `AllowAny` permission — no token needed. Use `publicApi` from `src/api/endpoints.js` for public page calls
11. **Colony type**: `colony_type` field on Colony has 5 choices (bda_scheme, private_approved, suo_moto, pending_layout, rejected_layout). `rejection_reason` is required + validated when type = `rejected_layout`. Model `save()` auto-clears rejection_reason when type changes away from `rejected_layout`
12. **Map files**: Colony layout maps stored as `FileField` in `colony_maps/{pdf|svg|png}/`. Access via `GET /api/colonies/{id}/map/<fmt>/` (auth) or `GET /api/public/colonies/{id}/map/<fmt>/` (public). Use `publicApi.mapDownloadUrl(id, fmt)` to get the URL string for `<a href>`

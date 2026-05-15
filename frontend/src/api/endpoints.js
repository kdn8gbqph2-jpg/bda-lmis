import client from './client'

// ── Auth ──────────────────────────────────────────────────────────────────────
export const auth = {
  login:          (data) => client.post('/auth/login/', data),
  refresh:        (data) => client.post('/auth/refresh/', data),
  logout:         (data) => client.post('/auth/logout/', data),
  me:             ()     => client.get('/auth/me/'),
  captcha:        ()     => client.get('/auth/captcha/'),
  changePassword: (data) => client.post('/auth/change-password/', data),
}

// ── Colonies ──────────────────────────────────────────────────────────────────
export const colonies = {
  list:    (params) => client.get('/colonies/', { params }),
  detail:  (id)     => client.get(`/colonies/${id}/`),
  stats:   (id)     => client.get(`/colonies/${id}/stats/`),
  geojson: (id)     => client.get(`/colonies/${id}/geojson/`),
  geojsonAll: (params) => client.get('/colonies/geojson/', { params }),
  create:  (data, config) => client.post('/colonies/', data, config),
  update:  (id, data, config) => client.put(`/colonies/${id}/`, data, config),
  destroy: (id)     => client.delete(`/colonies/${id}/`),
  // Wraps the import_patta_ledger management command. Sends one .xlsx,
  // server picks the sheet matching the colony name and bulk-imports
  // plots + pattas + DMS document links.
  importLedger: (id, form) => client.post(`/colonies/${id}/import-ledger/`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
}

// ── Khasras ───────────────────────────────────────────────────────────────────
export const khasras = {
  list:   (params) => client.get('/khasras/', { params }),
  detail: (id)     => client.get(`/khasras/${id}/`),
  plots:  (id)     => client.get(`/khasras/${id}/plots/`),
}

// ── Plots ─────────────────────────────────────────────────────────────────────
export const plots = {
  list:     (params) => client.get('/plots/', { params }),
  detail:   (id)     => client.get(`/plots/${id}/`),
  pattas:   (id)     => client.get(`/plots/${id}/pattas/`),
  documents:(id)     => client.get(`/plots/${id}/documents/`),
  history:  (id)     => client.get(`/plots/${id}/history/`),
  geojson:  (params) => client.get('/plots/geojson/', { params }),
  create:   (data)   => client.post('/plots/', data),
  update:   (id, d)  => client.put(`/plots/${id}/`, d),
  destroy:  (id)     => client.delete(`/plots/${id}/`),
  bulkImport: (form) => client.post('/plots/bulk-import/', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  bulkImportXlsx: (form) => client.post('/plots/bulk-import-xlsx/', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  template: () => client.get('/plots/template/', { responseType: 'blob' }),
}

// ── Pattas ────────────────────────────────────────────────────────────────────
export const pattas = {
  list:         (params) => client.get('/pattas/', { params }),
  detail:       (id)     => client.get(`/pattas/${id}/`),
  plotsCovered: (id)     => client.get(`/pattas/${id}/plots/`),
  linkDocument: (id, data) => client.post(`/pattas/${id}/link-document/`, data),
  create:       (data)   => client.post('/pattas/', data),
  update:       (id, d)  => client.put(`/pattas/${id}/`, d),
  destroy:      (id)     => client.delete(`/pattas/${id}/`),
  exportExcel:  (params) => client.get('/pattas/export/', {
    params, responseType: 'blob',
    // Axios response interceptor unwraps .data, but for blob we still get the Blob
  }),
}

// ── Documents ─────────────────────────────────────────────────────────────────
export const documents = {
  list:    (params) => client.get('/documents/', { params }),
  detail:  (id)     => client.get(`/documents/${id}/`),
  preview: (id)     => `/api/documents/${id}/preview/`,  // used as <img src> or window.open
  verify:  (id)     => client.post(`/documents/${id}/verify/`),
  upload:  (form)   => client.post('/documents/', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
export const dashboard = {
  stats:          () => client.get('/dashboard/stats/'),
  colonyProgress: () => client.get('/dashboard/colony-progress/'),
  zoneBreakdown:  () => client.get('/dashboard/zone-breakdown/'),
  charts:         () => client.get('/dashboard/charts/'),
}

// ── GIS ───────────────────────────────────────────────────────────────────────
export const gis = {
  coloniesGeojson: ()       => client.get('/gis/colonies/geojson/'),
  khasrasGeojson:  (params) => client.get('/gis/khasras/geojson/', { params }),
  plotsGeojson:    (params) => client.get('/gis/plots/geojson/', { params }),
  layers:          ()       => client.get('/gis/custom-layers/'),
  layerGeojson:    (id)     => client.get(`/gis/custom-layers/${id}/geojson/`),
  uploadLayer:     (form)   => client.post('/gis/custom-layers/', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  deleteLayer:     (id)     => client.delete(`/gis/custom-layers/${id}/`),

  // ── Imported basemap tile sources ──
  basemaps:        ()       => client.get('/gis/basemaps/'),
  createBasemap:   (data)   => client.post('/gis/basemaps/', data),
  deleteBasemap:   (id)     => client.delete(`/gis/basemaps/${id}/`),
}

// ── Users (admin) ─────────────────────────────────────────────────────────────
export const users = {
  list:           (params) => client.get('/users/', { params }),
  detail:         (id)     => client.get(`/users/${id}/`),
  create:         (data)   => client.post('/users/', data),
  update:         (id, d)  => client.put(`/users/${id}/`, d),
  destroy:        (id)     => client.delete(`/users/${id}/`),
  assignColonies: (id, d)  => client.post(`/users/${id}/assign-colonies/`, d),
  /** Liveness check used by the Edit User modal's SSO ID / User ID field. */
  checkEmpId:     (value, exclude) => client.get('/users/check-emp-id/', {
    params: { value, ...(exclude ? { exclude } : {}) },
  }),
}

// ── Audit logs (admin) ────────────────────────────────────────────────────────
export const auditLogs = {
  list: (params) => client.get('/audit-logs/', { params }),
}

// ── Approvals (ChangeRequest queue) ──────────────────────────────────────────
// Pending changes submitted by staff. Admin/Superintendent approve or
// reject; bell badge on the topbar reads from /count/.
export const approvals = {
  list:    (params) => client.get('/approvals/', { params }),
  count:   ()       => client.get('/approvals/count/'),
  detail:  (id)     => client.get(`/approvals/${id}/`),
  approve: (id, notes = '') => client.post(`/approvals/${id}/approve/`, { notes }),
  reject:  (id, notes = '') => client.post(`/approvals/${id}/reject/`, { notes }),
  /** Submitter clears their own rejected CR from the bell. */
  dismiss: (id)     => client.post(`/approvals/${id}/dismiss/`),
}

// ── Transliterate (English → Hindi) ──────────────────────────────────────────
// Backend proxies Google Input Tools and caches in Redis for 24h.
export const transliterate = {
  hi: (token) => client.get('/transliterate/', { params: { q: token } }),
}

// ── DMS file viewer ──────────────────────────────────────────────────────────
// Backend streams the PDF; the helper fetches with auth and opens it in a
// new tab via a blob URL so the JWT never leaves the Authorization header.
export const dms = {
  fetchPdf: (dmsNumber, type = 'ns') =>
    client.get(`/dms/file/${encodeURIComponent(dmsNumber)}/`, {
      params: { type },
      responseType: 'blob',
    }),
  async openInTab(dmsNumber, type = 'ns') {
    const blob = await this.fetchPdf(dmsNumber, type)
    const url  = URL.createObjectURL(blob)
    // Open in a new tab. Browser will show built-in PDF viewer.
    window.open(url, '_blank', 'noopener,noreferrer')
    // Revoke after a beat so the new tab has time to load.
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  },
}

// ── Public (no auth required) ─────────────────────────────────────────────────
// Uses the same Axios instance but the server permits AllowAny for these URLs.
export const publicApi = {
  colonyTypes:  ()         => client.get('/public/colony-types/'),
  colonyList:   (params)   => client.get('/public/colonies/', { params }),
  colonyDetail: (id)       => client.get(`/public/colonies/${id}/`),
  colonyGeojson:(params)   => client.get('/public/colonies/geojson/', { params }),
  /** Returns a direct URL string to use for <a href> / window.open map downloads */
  mapDownloadUrl: (id, fmt) => `/api/public/colonies/${id}/map/${fmt}/`,
  /** Same file, served with Content-Disposition: inline — use as src for
   *  <iframe> / <img> previews so browsers render it in-place. */
  mapInlineUrl:   (id, fmt) => `/api/public/colonies/${id}/map/${fmt}/?disposition=inline`,
}

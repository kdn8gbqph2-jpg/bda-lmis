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
  versions:     (id)     => client.get(`/pattas/${id}/versions/`),
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
}

// ── Users (admin) ─────────────────────────────────────────────────────────────
export const users = {
  list:           (params) => client.get('/users/', { params }),
  detail:         (id)     => client.get(`/users/${id}/`),
  create:         (data)   => client.post('/users/', data),
  update:         (id, d)  => client.put(`/users/${id}/`, d),
  destroy:        (id)     => client.delete(`/users/${id}/`),
  assignColonies: (id, d)  => client.post(`/users/${id}/assign-colonies/`, d),
}

// ── Audit logs (admin) ────────────────────────────────────────────────────────
export const auditLogs = {
  list: (params) => client.get('/audit-logs/', { params }),
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
}

/**
 * Single source of truth for human-readable field names across the
 * Patta / Colony / Plot models. Used by:
 *
 *   · ApprovalsBell      — bell-dropdown diff view
 *   · EditHistory        — audit-log timeline
 *   · PendingBanner      — yellow "edit pending" banner on detail pages
 *
 * Keep raw column names on the left, presentation copy on the right.
 * Add to the union here when a new field needs labelling rather than
 * sprinkling lookup tables across components.
 */

export const FIELD_LABELS = {
  // ── Patta ──────────────────────────────────────────────────────────────────
  patta_number:           'Patta Number',
  allottee_name:          'Allottee Name',
  allottee_address:       'Allottee Address',
  allottee_father_husband:'Allottee Father/Husband',
  issue_date:             'Issue Date',
  amendment_date:         'Amendment Date',
  challan_number:         'Challan Number',
  challan_date:           'Challan Date',
  lease_amount:           'Lease Amount',
  lease_duration:         'Lease Duration',
  regulation_file_present:'Regulation File Present',
  status:                 'Status',
  remarks:                'Remarks',
  rejection_reason:       'Rejection Reason',
  dms_file_number:        'DMS File Number',
  document_id:            'DMS Document',
  superseded_by_id:       'Superseded By',
  updated_by_id:          'Updated By',
  colony:                 'Colony',
  colony_id:              'Colony',

  // ── Colony ─────────────────────────────────────────────────────────────────
  name:                   'Name',
  colony_type:            'Type',
  zone:                   'Zone',
  revenue_village:        'Revenue Village',
  chak_number:            'Chak Number',
  dlc_file_number:        'DLC File Number',
  notified_area_bigha:    'Notified Area (Bigha)',
  conversion_date:        'Conversion Date',
  layout_approval_date:   'Layout Approval Date',
  total_plots_per_layout: 'Total Plots (Layout)',
  khasras_input:          'Khasras',

  // ── Plot ───────────────────────────────────────────────────────────────────
  plot_number:            'Plot Number',
  type:                   'Type',
  area_sqy:               'Area (Sq.Yd)',
  primary_khasra:         'Primary Khasra',
  primary_khasra_id:      'Primary Khasra',
}

/** Lookup with raw column name fallback so the UI never blanks out. */
export function fieldLabel(key) {
  return FIELD_LABELS[key] || key
}

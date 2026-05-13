import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { Search, ChevronRight, Pencil, FileText, Download, X, Plus } from 'lucide-react'
import { colonies as coloniesApi } from '@/api/endpoints'
import { Card } from '@/components/ui/Card'
import { Input, Select } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Table, Pagination } from '@/components/ui/Table'
import { Button } from '@/components/ui/Button'
import { ColonyEditModal } from '@/components/admin/ColonyEditModal'
import { AddColonyModal } from '@/components/admin/AddColonyModal'
import { useAuthStore } from '@/stores/useAuthStore'

// ── Filter choices (kept in sync with backend ZONE_CHOICES + COLONY_TYPE_CHOICES) ─

const FLAG_CHOICES = [
  { value: '',                 label: 'All flags'              },
  { value: 'bda_scheme',       label: 'BDA Scheme'             },
  { value: 'private_approved', label: 'BDA Approved'           },
  { value: 'suo_moto',         label: 'SUO-Moto'               },
  { value: 'pending_layout',   label: 'Pending Layout Approval'},
  { value: 'rejected_layout',  label: 'Rejected Layout'        },
]

const ZONE_CHOICES = [
  { value: '',     label: 'All zones' },
  { value: 'East', label: 'East'      },
  { value: 'West', label: 'West'      },
]

const PAGE_SIZE = 20

// ── Shared category-flag palette (matches public dashboard + edit modal) ─────

const FLAG_STYLE = {
  bda_scheme:       'bg-blue-50    text-blue-700    border-blue-200',
  private_approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  suo_moto:         'bg-amber-50   text-amber-700   border-amber-200',
  pending_layout:   'bg-orange-50  text-orange-700  border-orange-200',
  rejected_layout:  'bg-red-50     text-red-700     border-red-200',
}

const PILL_PALETTE = [
  { bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200'    },
  { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  { bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200'   },
  { bg: 'bg-purple-50',  text: 'text-purple-700',  border: 'border-purple-200'  },
  { bg: 'bg-rose-50',    text: 'text-rose-700',    border: 'border-rose-200'    },
  { bg: 'bg-sky-50',     text: 'text-sky-700',     border: 'border-sky-200'     },
  { bg: 'bg-orange-50',  text: 'text-orange-700',  border: 'border-orange-200'  },
  { bg: 'bg-teal-50',    text: 'text-teal-700',    border: 'border-teal-200'    },
]

function pillColor(khasraNumber) {
  let h = 0
  for (const c of String(khasraNumber)) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return PILL_PALETTE[h % PILL_PALETTE.length]
}

// ── Table ────────────────────────────────────────────────────────────────────

const COLUMNS = [
  { key: 'name',  label: 'Colony Name' },
  {
    key: 'colony_type',
    label: 'Flag',
    render: (row) => (
      <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full border ${FLAG_STYLE[row.colony_type] ?? 'bg-slate-50 text-slate-700 border-slate-200'}`}>
        {row.colony_type_label ?? '—'}
      </span>
    ),
  },
  { key: 'zone', label: 'Zone' },
  {
    key: 'layout_approval_date',
    label: 'Approval Date',
    cellClass: 'text-xs text-slate-500',
    render: (row) => row.layout_approval_date || '—',
  },
  { key: 'total_plots', label: 'Plots', cellClass: 'tabular-nums' },
  {
    key: 'actions',
    label: '',
    render: (row) => (
      <Button variant="ghost" size="sm" onClick={() => row.__onDetail(row)}>
        <ChevronRight className="w-4 h-4" />
      </Button>
    ),
  },
]

// ── Detail Modal ─────────────────────────────────────────────────────────────

function ColonyDetailModal({ colony, onClose }) {
  const isAdmin = useAuthStore((s) => s.isAdmin)()
  const [editing, setEditing] = useState(false)

  // Full detail — needed for all the spec fields (file slots, khasras list,
  // computed counts). Fetch unconditionally so non-admins also see the data.
  const full = useQuery({
    queryKey: ['colony', colony?.id, 'detail'],
    queryFn: () => coloniesApi.detail(colony.id),
    enabled: !!colony,
  })

  const d = full.data ?? {}
  const khasraList = d.khasras ?? []

  return (
    <>
      {isAdmin && full.data && (
        <ColonyEditModal
          colony={full.data}
          open={editing}
          onClose={() => setEditing(false)}
        />
      )}

      <Modal
        open={!!colony && !editing}
        onClose={onClose}
        title={d.name || colony?.name || 'Colony Detail'}
        size="lg"
        footer={
          isAdmin && (
            <Button variant="primary" onClick={() => setEditing(true)} disabled={!full.data}>
              <Pencil className="w-4 h-4" /> Edit Colony
            </Button>
          )
        }
      >
        {full.isPending ? (
          <p className="text-center text-slate-400 py-8">Loading…</p>
        ) : (
          <div className="space-y-6">

            {/* Flag + dates + village */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Field label="Colony Flag">
                <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full border ${FLAG_STYLE[d.colony_type] ?? 'bg-slate-50 text-slate-700 border-slate-200'}`}>
                  {d.colony_type_label || '—'}
                </span>
              </Field>
              <Field label="Revenue Village"         value={d.revenue_village} />
              <Field label="Layout Application Date" value={d.layout_application_date} />
              <Field label="Layout Approval Date"    value={d.layout_approval_date} />
            </div>

            {/* Plot counts */}
            <div>
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                Plot Counts <span className="text-slate-400 normal-case font-normal">· auto-computed</span>
              </h3>
              <div className="grid grid-cols-3 gap-3">
                <Stat label="Total Plots"        value={d.total_plots} />
                <Stat label="Available Plots"    value={d.available_plots} />
                <Stat label="Patta Issued Count" value={d.patta_issued_count} />
              </div>
            </div>

            {/* Khasras */}
            <div>
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                Khasra List ({khasraList.length})
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {khasraList.length === 0 && (
                  <span className="text-xs text-slate-400">No khasras recorded.</span>
                )}
                {khasraList.map((k) => {
                  const c = pillColor(k.number)
                  return (
                    <span
                      key={k.id}
                      className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${c.bg} ${c.text} ${c.border}`}
                    >
                      {k.number}
                    </span>
                  )
                })}
              </div>
            </div>

            {/* Layout file (unified — first available across pdf/jpeg/png) */}
            <div>
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                Attached Layout <span className="text-slate-400 normal-case font-normal">· any of .pdf / .jpeg / .png</span>
              </h3>
              <FileLink
                label={
                  d.map_pdf  ? 'Layout (PDF)'
                  : d.map_jpeg ? 'Layout (JPEG)'
                  : d.map_png ? 'Layout (PNG)'
                  : 'Layout'
                }
                url={d.map_pdf || d.map_jpeg || d.map_png || null}
              />
            </div>

            {/* Shape / KML */}
            <div>
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                Shape / KML File
              </h3>
              <FileLink label="Boundary" url={d.boundary_file} />
            </div>

          </div>
        )}
      </Modal>
    </>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function Field({ label, value, children }) {
  return (
    <div>
      <p className="text-xs text-slate-400">{label}</p>
      <div className="text-sm font-medium text-slate-800 mt-0.5">
        {children ?? (value || '—')}
      </div>
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-center">
      <div className="text-2xl font-semibold text-slate-900 tabular-nums leading-tight">
        {value ?? '—'}
      </div>
      <div className="text-[11px] text-slate-500 mt-0.5">{label}</div>
    </div>
  )
}

function FileLink({ label, url }) {
  if (!url) {
    return (
      <div className="border border-dashed border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-400 flex items-center gap-2">
        <FileText className="w-3.5 h-3.5" />
        {label} — not uploaded
      </div>
    )
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-2 border border-slate-200 hover:border-blue-300 hover:bg-blue-50 rounded-lg px-3 py-2 text-sm text-slate-700 transition"
    >
      <FileText className="w-3.5 h-3.5 text-blue-600" />
      <span className="flex-1 truncate">{label}</span>
      <Download className="w-3.5 h-3.5 text-slate-400" />
    </a>
  )
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function ColoniesPage() {
  const isAdmin = useAuthStore((s) => s.isAdmin)()
  const [filters, setFilters] = useState({
    search:          '',
    colony_type:     '',
    zone:            '',
    khasra:          '',
    revenue_village: '',
  })
  const [page, setPage]         = useState(1)
  const [selected, setSelected] = useState(null)
  const [addOpen, setAddOpen]   = useState(false)

  // URL-driven filters that aren't in the regular filter bar — currently
  // just `layout_approved=1` from the Dashboard "Approved Layouts" KPI.
  // Kept out of the `filters` state so the user can clear it via the
  // dedicated chip below rather than appearing as a select.
  const [searchParams, setSearchParams] = useSearchParams()
  const layoutApproved = searchParams.get('layout_approved') === '1'

  const setFilter = (key) => (e) => {
    setFilters((f) => ({ ...f, [key]: e.target.value }))
    setPage(1)
  }

  const clearLayoutApproved = () => {
    const next = new URLSearchParams(searchParams)
    next.delete('layout_approved')
    setSearchParams(next, { replace: true })
    setPage(1)
  }

  const hasAny = Object.values(filters).some(Boolean) || layoutApproved

  const q = useQuery({
    queryKey: ['colonies', page, filters, layoutApproved],
    queryFn: () => coloniesApi.list({
      page,
      page_size: PAGE_SIZE,
      // omit empty strings — backend filters treat presence as "filter applied"
      ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)),
      ...(layoutApproved ? { layout_approved: 'true' } : {}),
    }),
    placeholderData: (prev) => prev,
  })

  const rows = (q.data?.results ?? []).map((r) => ({ ...r, __onDetail: setSelected }))

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <Card padding>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[14rem]">
            <Input
              label="Search"
              placeholder="Colony name…"
              prefix={<Search className="w-3.5 h-3.5" />}
              value={filters.search}
              onChange={setFilter('search')}
            />
          </div>
          <div className="w-44">
            <Select label="Flag" value={filters.colony_type} onChange={setFilter('colony_type')}>
              {FLAG_CHOICES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </Select>
          </div>
          <div className="w-32">
            <Select label="Zone" value={filters.zone} onChange={setFilter('zone')}>
              {ZONE_CHOICES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </Select>
          </div>
          <div className="w-36">
            <Input
              label="Khasra No."
              placeholder="e.g. 1448"
              value={filters.khasra}
              onChange={setFilter('khasra')}
            />
          </div>
          <div className="w-44">
            <Input
              label="Revenue Village"
              placeholder="ग्राम का नाम"
              value={filters.revenue_village}
              onChange={setFilter('revenue_village')}
            />
          </div>
          {hasAny && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setFilters({ search: '', colony_type: '', zone: '', khasra: '', revenue_village: '' })
                clearLayoutApproved()
                setPage(1)
              }}
            >
              <X className="w-3.5 h-3.5" /> Clear
            </Button>
          )}
          {layoutApproved && (
            <span
              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium
                         bg-amber-50 text-amber-800 border border-amber-200 rounded-full"
              title="Filter applied from the dashboard 'Approved Layouts' card"
            >
              Approved layouts only
              <button
                type="button"
                onClick={clearLayoutApproved}
                className="ml-1 hover:text-amber-900"
                aria-label="Remove approved-layouts filter"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {isAdmin && (
            <Button onClick={() => setAddOpen(true)} className="ml-auto">
              <Plus className="w-4 h-4" /> Add Colony
            </Button>
          )}
        </div>
      </Card>

      <AddColonyModal open={addOpen} onClose={() => setAddOpen(false)} />

      <Card padding={false}>
        <Table
          columns={COLUMNS}
          data={rows}
          loading={q.isPending}
          emptyMessage="No colonies found."
        />
      </Card>

      <Pagination
        page={page}
        totalPages={Math.ceil((q.data?.count || 0) / PAGE_SIZE)}
        count={q.data?.count}
        pageSize={PAGE_SIZE}
        onPage={setPage}
      />

      <ColonyDetailModal colony={selected} onClose={() => setSelected(null)} />
    </div>
  )
}

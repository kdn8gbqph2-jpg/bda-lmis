import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, Plus, Pencil } from 'lucide-react'
import { plots as plotsApi, colonies as coloniesApi } from '@/api/endpoints'
import { Card } from '@/components/ui/Card'
import { Input, Select } from '@/components/ui/Input'
import { Table, Pagination } from '@/components/ui/Table'
import { Combobox } from '@/components/ui/Combobox'
import { Button } from '@/components/ui/Button'
import { PlotStatusBadge } from '@/components/ui/Badge'
import { AddPlotModal } from '@/components/admin/AddPlotModal'
import { PlotEditModal } from '@/components/admin/PlotEditModal'
import { useAuthStore } from '@/stores/useAuthStore'

const PAGE_SIZE = 25

const STATUSES = [
  { value: '',                   label: 'All Statuses' },
  { value: 'available',          label: 'Available' },
  { value: 'allotted_lottery',   label: 'Allotted (Lottery)' },
  { value: 'allotted_seniority', label: 'Allotted (Seniority)' },
  { value: 'ews',                label: 'EWS' },
  { value: 'patta_ok',           label: 'Patta OK' },
  { value: 'patta_missing',      label: 'Patta Missing' },
  { value: 'cancelled',          label: 'Cancelled' },
]

export default function PlotsPage() {
  const isStaff = useAuthStore((s) => s.isStaffOrAbove)()
  const [search,   setSearch]   = useState('')
  const [status,   setStatus]   = useState('')
  const [colonyId, setColonyId] = useState('')
  const [page,     setPage]     = useState(1)
  const [addOpen,  setAddOpen]  = useState(false)
  const [editing,  setEditing]  = useState(null)   // plot row being edited

  const plots = useQuery({
    queryKey: ['plots', page, search, status, colonyId],
    queryFn: () => plotsApi.list({ page, page_size: PAGE_SIZE, search, status, colony: colonyId }),
    placeholderData: (prev) => prev,
  })

  const coloniesQ = useQuery({
    queryKey: ['colonies-select'],
    queryFn: () => coloniesApi.list({ page_size: 200 }),
    staleTime: 5 * 60 * 1000,
  })
  const colonyOptions = coloniesQ.data?.results ?? []

  const reset = () => setPage(1)

  // ── Columns — render names not ids; clickable Edit at the end ──────────
  const COLUMNS = [
    { key: 'plot_number',  label: 'Plot No.' },
    { key: 'colony_name',  label: 'Colony', render: (r) => r.colony_name ?? '—' },
    {
      key: 'allottee_names',
      label: 'Allottee',
      render: (r) => {
        const names = r.allottee_names ?? []
        if (names.length === 0) return <span className="text-slate-300">—</span>
        if (names.length === 1) return names[0]
        return (
          <div className="leading-tight">
            <div>{names[0]}</div>
            <div className="text-xs text-slate-400">+{names.length - 1} more</div>
          </div>
        )
      },
    },
    { key: 'area_sqy',  label: 'Area (SqY)', cellClass: 'tabular-nums', render: (r) => r.area_sqy ?? '—' },
    { key: 'type',      label: 'Type' },
    {
      key: 'status',
      label: 'Status',
      render: (r) => <PlotStatusBadge status={r.status} />,
    },
    {
      key: 'khasra_numbers',
      label: 'Khasra(s)',
      render: (r) => (r.khasra_numbers || []).join(', ') || '—',
    },
    {
      key: 'edit',
      label: '',
      render: (r) =>
        isStaff ? (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setEditing(r) }}
            className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:text-blue-900"
            title="Edit plot"
          >
            <Pencil className="w-3.5 h-3.5" /> Edit
          </button>
        ) : null,
    },
  ]

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-64">
          <Input
            placeholder="Search plot number…"
            prefix={<Search className="w-3.5 h-3.5" />}
            value={search}
            onChange={(e) => { setSearch(e.target.value); reset() }}
          />
        </div>

        <div className="w-64">
          <Combobox
            value={colonyId}
            onChange={(v) => { setColonyId(v); reset() }}
            options={colonyOptions.map((c) => ({ value: c.id, label: c.name }))}
            placeholder="All Colonies"
            clearLabel="All Colonies"
          />
        </div>

        <div className="w-52">
          <Select
            value={status}
            onChange={(e) => { setStatus(e.target.value); reset() }}
          >
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </Select>
        </div>

        <span className="text-sm text-slate-500 ml-auto">
          {plots.data?.count ?? '…'} plots
        </span>
        {isStaff && (
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="w-4 h-4" /> Add Plot
          </Button>
        )}
      </div>

      <AddPlotModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        defaultColonyId={colonyId}
      />
      <PlotEditModal
        plot={editing}
        open={!!editing}
        onClose={() => setEditing(null)}
      />

      {/* Table */}
      <Card padding={false}>
        <Table
          columns={COLUMNS}
          data={plots.data?.results ?? []}
          loading={plots.isPending}
          emptyMessage="No plots found."
        />
      </Card>

      <Pagination
        page={page}
        totalPages={Math.ceil((plots.data?.count || 0) / PAGE_SIZE)}
        count={plots.data?.count}
        pageSize={PAGE_SIZE}
        onPage={setPage}
      />
    </div>
  )
}

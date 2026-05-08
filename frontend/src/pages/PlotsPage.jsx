import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { plots as plotsApi, colonies as coloniesApi } from '@/api/endpoints'
import { Card } from '@/components/ui/Card'
import { Input, Select } from '@/components/ui/Input'
import { Table, Pagination } from '@/components/ui/Table'
import { PlotStatusBadge } from '@/components/ui/Badge'

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

const COLUMNS = [
  { key: 'plot_number',  label: 'Plot No.' },
  { key: 'colony_name',  label: 'Colony', render: (r) => r.colony_detail?.name ?? r.colony },
  { key: 'area_sqy',    label: 'Area (SqY)', cellClass: 'tabular-nums' },
  { key: 'area_sqm',    label: 'Area (SqM)', cellClass: 'tabular-nums' },
  { key: 'plot_type',   label: 'Type' },
  {
    key: 'status',
    label: 'Status',
    render: (r) => <PlotStatusBadge status={r.status} />,
  },
  { key: 'khasra_numbers', label: 'Khasra(s)', render: (r) => (r.khasra_numbers || []).join(', ') || '—' },
]

export default function PlotsPage() {
  const [search,   setSearch]   = useState('')
  const [status,   setStatus]   = useState('')
  const [colonyId, setColonyId] = useState('')
  const [page,     setPage]     = useState(1)

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

  const reset = () => { setPage(1) }

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

        <div className="w-52">
          <Select
            value={colonyId}
            onChange={(e) => { setColonyId(e.target.value); reset() }}
          >
            <option value="">All Colonies</option>
            {colonyOptions.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
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
      </div>

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

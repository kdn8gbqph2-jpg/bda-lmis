import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Search, ChevronRight } from 'lucide-react'
import { pattas as pattasApi, colonies as coloniesApi } from '@/api/endpoints'
import { Card } from '@/components/ui/Card'
import { Input, Select } from '@/components/ui/Input'
import { Table, Pagination } from '@/components/ui/Table'
import { Button } from '@/components/ui/Button'

const PAGE_SIZE = 25

const COLUMNS = [
  { key: 'patta_number',   label: 'Patta No.' },
  { key: 'allottee_name',  label: 'Allottee' },
  { key: 'colony_name',    label: 'Colony', render: (r) => r.colony_name || r.plots?.[0]?.colony_detail?.name || '—' },
  { key: 'plot_numbers',   label: 'Plot(s)', render: (r) => (r.plot_numbers || []).join(', ') || '—' },
  {
    key: 'challan_date',
    label: 'Challan Date',
    cellClass: 'tabular-nums text-xs',
    render: (r) => r.challan_date || '—',
  },
  {
    key: 'lease_amount',
    label: 'Lease Amount',
    cellClass: 'tabular-nums',
    render: (r) => r.lease_amount != null
      ? Number(r.lease_amount).toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })
      : '—',
  },
  {
    key: 'actions',
    label: '',
    render: (r) => (
      <Button variant="ghost" size="sm" onClick={() => r.__onNavigate(r.id)}>
        <ChevronRight className="w-4 h-4" />
      </Button>
    ),
  },
]

export default function PattaLedgerPage() {
  const navigate = useNavigate()
  const [search,   setSearch]   = useState('')
  const [colonyId, setColonyId] = useState('')
  const [page,     setPage]     = useState(1)

  const pattas = useQuery({
    queryKey: ['pattas', page, search, colonyId],
    queryFn: () => pattasApi.list({ page, page_size: PAGE_SIZE, search, colony: colonyId }),
    placeholderData: (prev) => prev,
  })

  const coloniesQ = useQuery({
    queryKey: ['colonies-select'],
    queryFn: () => coloniesApi.list({ page_size: 200 }),
    staleTime: 5 * 60 * 1000,
  })
  const colonyOptions = coloniesQ.data?.results ?? []

  const rows = (pattas.data?.results ?? []).map((r) => ({
    ...r,
    __onNavigate: (id) => navigate(`/patta-ledger/${id}`),
  }))

  const reset = () => setPage(1)

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-72">
          <Input
            placeholder="Search patta no. or allottee…"
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
        <span className="text-sm text-slate-500 ml-auto">
          {pattas.data?.count ?? '…'} pattas
        </span>
      </div>

      <Card padding={false}>
        <Table
          columns={COLUMNS}
          data={rows}
          loading={pattas.isPending}
          emptyMessage="No patta records found."
        />
      </Card>

      <Pagination
        page={page}
        totalPages={Math.ceil((pattas.data?.count || 0) / PAGE_SIZE)}
        count={pattas.data?.count}
        pageSize={PAGE_SIZE}
        onPage={setPage}
      />
    </div>
  )
}

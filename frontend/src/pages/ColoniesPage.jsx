import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, MapPin, ChevronRight } from 'lucide-react'
import { colonies as coloniesApi } from '@/api/endpoints'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Table, Pagination } from '@/components/ui/Table'
import { Button } from '@/components/ui/Button'
import { khasras as khasrasApi } from '@/api/endpoints'

const PAGE_SIZE = 20

const COLUMNS = [
  { key: 'name',           label: 'Colony Name' },
  { key: 'colony_code',    label: 'Code' },
  { key: 'zone',           label: 'Zone' },
  { key: 'scheme_type',    label: 'Scheme' },
  { key: 'total_area_sqy', label: 'Area (SqY)', cellClass: 'tabular-nums' },
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

function ColonyDetailModal({ colony, onClose }) {
  const detail = useQuery({
    queryKey: ['colony', colony?.id, 'stats'],
    queryFn: () => coloniesApi.stats(colony.id),
    enabled: !!colony,
  })
  const khasras = useQuery({
    queryKey: ['colony', colony?.id, 'khasras'],
    queryFn: () => khasrasApi.list({ colony: colony.id, page_size: 200 }),
    enabled: !!colony,
  })

  const s = detail.data || {}
  const kList = khasras.data?.results ?? khasras.data ?? []

  return (
    <Modal open={!!colony} onClose={onClose} title={colony?.name || 'Colony Detail'} size="lg">
      {detail.isPending ? (
        <p className="text-center text-slate-400 py-8">Loading…</p>
      ) : (
        <div className="space-y-5">
          {/* Meta */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {[
              ['Colony Code', colony?.colony_code],
              ['Zone', colony?.zone],
              ['Scheme Type', colony?.scheme_type],
              ['Notification No.', colony?.notification_number || '—'],
              ['Notification Date', colony?.notification_date || '—'],
              ['Total Area', colony?.total_area_sqy ? `${colony.total_area_sqy} SqY` : '—'],
            ].map(([label, val]) => (
              <div key={label}>
                <p className="text-xs text-slate-400">{label}</p>
                <p className="text-sm font-medium text-slate-800 mt-0.5">{val || '—'}</p>
              </div>
            ))}
          </div>

          {/* Plot stats */}
          <div className="bg-slate-50 rounded-xl p-4 grid grid-cols-3 gap-4">
            {[
              ['Total Plots', s.total_plots],
              ['Patta OK', s.patta_ok],
              ['Patta Missing', s.patta_missing],
            ].map(([label, val]) => (
              <div key={label} className="text-center">
                <p className="text-2xl font-semibold text-slate-900">{val ?? '—'}</p>
                <p className="text-xs text-slate-500 mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* Khasras */}
          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-2">
              Khasra Numbers ({kList.length})
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {kList.map((k) => (
                <span
                  key={k.id}
                  className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs font-medium"
                >
                  {k.khasra_number}
                  {k.area_sqy ? ` · ${k.area_sqy} SqY` : ''}
                </span>
              ))}
              {!khasras.isPending && kList.length === 0 && (
                <span className="text-xs text-slate-400">No khasras recorded.</span>
              )}
            </div>
          </div>
        </div>
      )}
    </Modal>
  )
}

export default function ColoniesPage() {
  const [search, setSearch]   = useState('')
  const [page, setPage]       = useState(1)
  const [selected, setSelected] = useState(null)

  const q = useQuery({
    queryKey: ['colonies', page, search],
    queryFn: () => coloniesApi.list({ page, page_size: PAGE_SIZE, search }),
    placeholderData: (prev) => prev,
  })

  const rows = (q.data?.results ?? []).map((r) => ({
    ...r,
    __onDetail: setSelected,
  }))

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex items-center gap-3">
        <div className="w-72">
          <Input
            placeholder="Search colony name or code…"
            prefix={<Search className="w-3.5 h-3.5" />}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          />
        </div>
        <div className="flex items-center gap-1.5 text-sm text-slate-500 ml-auto">
          <MapPin className="w-4 h-4" />
          <span>{q.data?.count ?? '…'} colonies</span>
        </div>
      </div>

      {/* Table */}
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

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { auditLogs as auditApi } from '@/api/endpoints'
import { Card } from '@/components/ui/Card'
import { Input, Select } from '@/components/ui/Input'
import { Table, Pagination } from '@/components/ui/Table'

const PAGE_SIZE = 30

const ACTIONS = [
  { value: '',        label: 'All Actions' },
  { value: 'create',  label: 'Create' },
  { value: 'update',  label: 'Update' },
  { value: 'delete',  label: 'Delete' },
]

const ENTITY_TYPES = [
  { value: '',         label: 'All Entities' },
  { value: 'Colony',   label: 'Colony' },
  { value: 'Plot',     label: 'Plot' },
  { value: 'Patta',    label: 'Patta' },
  { value: 'Document', label: 'Document' },
]

const ACTION_COLORS = {
  create: 'bg-green-50 text-green-700',
  update: 'bg-blue-50 text-blue-700',
  delete: 'bg-red-50 text-red-700',
}

const COLUMNS = [
  {
    key: 'action',
    label: 'Action',
    render: (r) => (
      <span className={`text-xs font-semibold uppercase px-2 py-0.5 rounded ${ACTION_COLORS[r.action] || 'bg-slate-100 text-slate-600'}`}>
        {r.action}
      </span>
    ),
  },
  {
    key: 'entity',
    label: 'Entity',
    render: (r) => {
      const snap  = r.new_values ?? r.old_values ?? {}
      const ident = snap.name ?? snap.patta_number ?? snap.plot_number ?? snap.original_filename ?? null
      return (
        <div className="leading-tight min-w-0">
          <div className="text-sm capitalize text-slate-800">{r.entity_type}</div>
          <div className="text-xs text-slate-500 truncate max-w-[18rem]">
            {ident ?? `#${r.entity_id}`}
          </div>
        </div>
      )
    },
  },
  {
    key: 'user',
    label: 'User',
    render: (r) => (
      r.user_name || r.user_email
        ? (
          <div className="leading-tight">
            <div className="text-sm text-slate-800">{r.user_name || r.user_email}</div>
            {r.user_email && r.user_name && (
              <div className="text-xs text-slate-400">{r.user_email}</div>
            )}
          </div>
        )
        : <span className="text-xs text-slate-400">System</span>
    ),
  },
  {
    key: 'ip_address',
    label: 'IP',
    cellClass: 'text-xs text-slate-400 tabular-nums',
    render: (r) => r.ip_address || '—',
  },
  {
    key: 'timestamp',
    label: 'Time',
    cellClass: 'text-xs text-slate-400 tabular-nums',
    render: (r) => r.timestamp
      ? new Date(r.timestamp).toLocaleString('en-IN')
      : '—',
  },
]

export default function AuditLogsPage() {
  const [search,     setSearch]     = useState('')
  const [action,     setAction]     = useState('')
  const [entityType, setEntityType] = useState('')
  const [page,       setPage]       = useState(1)

  const logs = useQuery({
    queryKey: ['audit-logs', page, search, action, entityType],
    queryFn: () => auditApi.list({
      page, page_size: PAGE_SIZE,
      action, entity_type: entityType,
    }),
    placeholderData: (prev) => prev,
  })

  const reset = () => setPage(1)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-44">
          <Select value={entityType} onChange={(e) => { setEntityType(e.target.value); reset() }}>
            {ENTITY_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </Select>
        </div>
        <div className="w-36">
          <Select value={action} onChange={(e) => { setAction(e.target.value); reset() }}>
            {ACTIONS.map((a) => (
              <option key={a.value} value={a.value}>{a.label}</option>
            ))}
          </Select>
        </div>
        <span className="text-sm text-slate-500 ml-auto">
          {logs.data?.count ?? '…'} log entries
        </span>
      </div>

      <Card padding={false}>
        <Table
          columns={COLUMNS}
          data={logs.data?.results ?? []}
          loading={logs.isPending}
          emptyMessage="No audit log entries."
        />
      </Card>

      <Pagination
        page={page}
        totalPages={Math.ceil((logs.data?.count || 0) / PAGE_SIZE)}
        count={logs.data?.count}
        pageSize={PAGE_SIZE}
        onPage={setPage}
      />
    </div>
  )
}

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, Eye, CheckCircle, UploadCloud } from 'lucide-react'
import { documents as docsApi, colonies as coloniesApi } from '@/api/endpoints'
import { Card } from '@/components/ui/Card'
import { Input, Select } from '@/components/ui/Input'
import { Table, Pagination } from '@/components/ui/Table'
import { Button } from '@/components/ui/Button'
import { Combobox } from '@/components/ui/Combobox'
import { useAuthStore } from '@/stores/useAuthStore'

const PAGE_SIZE = 25

const DOC_TYPES = [
  { value: '',           label: 'All Types' },
  { value: 'patta',      label: 'Patta' },
  { value: 'lease_deed', label: 'Lease Deed' },
  { value: 'map',        label: 'Map' },
  { value: 'other',      label: 'Other' },
]

export default function DocumentsPage() {
  const qc = useQueryClient()
  const isStaffOrAbove = useAuthStore((s) => s.isStaffOrAbove)
  const [search,   setSearch]   = useState('')
  const [docType,  setDocType]  = useState('')
  const [colonyId, setColonyId] = useState('')
  const [page,     setPage]     = useState(1)

  const docs = useQuery({
    queryKey: ['documents', page, search, docType, colonyId],
    queryFn: () => docsApi.list({ page, page_size: PAGE_SIZE, search, document_type: docType, colony: colonyId }),
    placeholderData: (prev) => prev,
  })

  const coloniesQ = useQuery({
    queryKey: ['colonies-select'],
    queryFn: () => coloniesApi.list({ page_size: 200 }),
    staleTime: 5 * 60 * 1000,
  })
  const colonyOptions = coloniesQ.data?.results ?? []

  const verify = useMutation({
    mutationFn: (id) => docsApi.verify(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['documents'] }),
  })

  const COLUMNS = [
    { key: 'title',          label: 'Title' },
    { key: 'document_type',  label: 'Type' },
    { key: 'dms_file_number',label: 'DMS File No.' },
    {
      key: 'patta_number',
      label: 'Patta',
      render: (r) => r.patta_number || '—',
    },
    {
      key: 'verified_at',
      label: 'Verified',
      render: (r) => r.verified_at
        ? <span className="flex items-center gap-1 text-green-600 text-xs"><CheckCircle className="w-3.5 h-3.5" /> Verified</span>
        : <span className="text-xs text-slate-400">Pending</span>,
    },
    {
      key: 'actions',
      label: '',
      render: (r) => (
        <div className="flex items-center gap-2">
          {r.file_url && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.open(r.file_url, '_blank')}
            >
              <Eye className="w-3.5 h-3.5" />
            </Button>
          )}
          {isStaffOrAbove() && !r.verified_at && (
            <Button
              variant="ghost"
              size="sm"
              loading={verify.isPending && verify.variables === r.id}
              onClick={() => verify.mutate(r.id)}
            >
              <CheckCircle className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      ),
    },
  ]

  const reset = () => setPage(1)

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-64">
          <Input
            placeholder="Search title or DMS number…"
            prefix={<Search className="w-3.5 h-3.5" />}
            value={search}
            onChange={(e) => { setSearch(e.target.value); reset() }}
          />
        </div>
        <div className="w-44">
          <Select value={docType} onChange={(e) => { setDocType(e.target.value); reset() }}>
            {DOC_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </Select>
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
        <span className="text-sm text-slate-500 ml-auto">
          {docs.data?.count ?? '…'} documents
        </span>
      </div>

      <Card padding={false}>
        <Table
          columns={COLUMNS}
          data={docs.data?.results ?? []}
          loading={docs.isPending}
          emptyMessage="No documents found."
        />
      </Card>

      <Pagination
        page={page}
        totalPages={Math.ceil((docs.data?.count || 0) / PAGE_SIZE)}
        count={docs.data?.count}
        pageSize={PAGE_SIZE}
        onPage={setPage}
      />
    </div>
  )
}

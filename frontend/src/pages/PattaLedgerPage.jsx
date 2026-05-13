import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Search, Download, Plus, CheckCircle, XCircle, FileText, ExternalLink } from 'lucide-react'
import { pattas as pattasApi, colonies as coloniesApi, dms as dmsApi } from '@/api/endpoints'
import { PattaStatusBadge } from '@/components/ui/Badge'
import { Pagination } from '@/components/ui/Table'
import { AddPattaModal } from '@/components/admin/AddPattaModal'
import { useAuthStore } from '@/stores/useAuthStore'

const PAGE_SIZE = 25

const STATUS_TABS = [
  { key: '',          label: 'All'           },
  { key: 'issued',    label: 'Issued'        },
  { key: 'missing',   label: 'File Missing'  },
  { key: 'amended',   label: 'Amended'       },
  { key: 'cancelled', label: 'Cancelled'     },
]

export default function PattaLedgerPage() {
  const navigate     = useNavigate()
  const isStaff      = useAuthStore((s) => s.isStaffOrAbove)()
  const [search,    setSearch]    = useState('')
  const [colonyId,  setColonyId]  = useState('')
  const [status,    setStatus]    = useState('')
  const [regFilter, setRegFilter] = useState('')
  const [page,      setPage]      = useState(1)
  const [addOpen,   setAddOpen]   = useState(false)

  const reset = () => setPage(1)

  // Export current filtered view as Excel — same filters as the list query
  const exportMut = useMutation({
    mutationFn: () => pattasApi.exportExcel({
      search:                  search    || undefined,
      colony:                  colonyId  || undefined,
      status:                  status    || undefined,
      regulation_file_present: regFilter || undefined,
    }),
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `patta_ledger_${new Date().toISOString().slice(0, 10)}.xlsx`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    },
  })

  const pattasQ = useQuery({
    queryKey: ['pattas', page, search, colonyId, status, regFilter],
    queryFn: () => pattasApi.list({
      page,
      page_size: PAGE_SIZE,
      search:                   search    || undefined,
      colony:                   colonyId  || undefined,
      status:                   status    || undefined,
      regulation_file_present:  regFilter || undefined,
    }),
    placeholderData: (prev) => prev,
  })

  const coloniesQ = useQuery({
    queryKey: ['colonies-select'],
    queryFn:  () => coloniesApi.list({ page_size: 200 }),
    staleTime: 5 * 60 * 1000,
  })
  const colonyOptions = coloniesQ.data?.results ?? []

  const rows  = pattasQ.data?.results ?? []
  const total = pattasQ.data?.count   ?? 0

  return (
    <div className="space-y-4">

      {/* ── Status tabs ── */}
      <div className="flex gap-2 flex-wrap">
        {STATUS_TABS.map((tab) => {
          const isActive = status === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => { setStatus(tab.key); reset() }}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                isActive
                  ? tab.key === ''       ? 'bg-slate-800 text-white'
                    : tab.key === 'missing' ? 'border border-red-200 bg-red-50 text-red-700'
                    : 'bg-slate-800 text-white'
                  : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {tab.label}
              {tab.key === '' && isActive && (
                <span className="ml-1 bg-white/20 px-1.5 py-0.5 rounded-full">{total}</span>
              )}
            </button>
          )
        })}
      </div>

      {/* ── Filter bar ── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-3 flex items-center gap-3 flex-wrap">
        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
          <input
            type="text"
            placeholder="Search allottee name or patta no..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); reset() }}
            className="pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm w-64
                       focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Colony */}
        <select
          value={colonyId}
          onChange={(e) => { setColonyId(e.target.value); reset() }}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-600
                     focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Colonies</option>
          {colonyOptions.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        {/* Regulation file */}
        <select
          value={regFilter}
          onChange={(e) => { setRegFilter(e.target.value); reset() }}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-600
                     focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Regulation File — Any</option>
          <option value="true">Present (हाँ)</option>
          <option value="false">Missing (नही)</option>
        </select>

        <span className="ml-auto text-xs text-slate-400">
          Showing{' '}
          <span className="font-medium text-slate-600">{total.toLocaleString('en-IN')}</span>{' '}
          records
        </span>

        <button
          onClick={() => exportMut.mutate()}
          disabled={exportMut.isPending || total === 0}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 border border-slate-200
                     rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <Download className="w-4 h-4" />
          {exportMut.isPending ? 'Exporting…' : 'Export Excel'}
        </button>
        {isStaff && (
          <button
            onClick={() => setAddOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-700 text-white rounded-lg hover:bg-blue-800 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Patta
          </button>
        )}
      </div>

      <AddPattaModal open={addOpen} onClose={() => setAddOpen(false)} />

      {/* ── Table ── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-10">क्र.</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Patta No.</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Allottee Name</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Colony</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Plot(s)</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Area (Sq.Yd)</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Issue Date</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Challan No.</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Reg. File</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">DMS File</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody>
            {pattasQ.isPending && (
              <tr>
                <td colSpan={11} className="px-4 py-10 text-center text-sm text-slate-400">
                  Loading…
                </td>
              </tr>
            )}
            {rows.map((r, i) => (
              <tr
                key={r.id}
                className={`border-b border-slate-100 last:border-b-0 cursor-pointer transition-colors
                            ${i % 2 === 1 ? 'bg-slate-100' : 'bg-white'}
                            hover:bg-blue-100/70`}
                onClick={() => navigate(`/patta-ledger/${r.id}`)}
              >
                <td className="px-4 py-2.5 text-slate-400 text-xs tabular-nums">
                  {(page - 1) * PAGE_SIZE + i + 1}
                </td>
                <td className="px-4 py-2.5 font-mono font-bold text-blue-700">
                  {r.patta_number}
                </td>
                <td className="px-4 py-2.5">
                  <div className="font-medium text-slate-800">{r.allottee_name}</div>
                </td>
                <td className="px-4 py-2.5 text-slate-600 text-xs">
                  {r.colony_name || '—'}
                </td>
                <td className="px-4 py-2.5 font-mono text-xs text-slate-700">
                  {(r.plot_numbers || []).join(', ') || '—'}
                </td>
                <td className="px-4 py-2.5 text-right text-slate-700 tabular-nums">
                  {r.area_sqy != null ? Number(r.area_sqy).toLocaleString('en-IN') : '—'}
                </td>
                <td className="px-4 py-2.5 text-slate-600 text-xs tabular-nums">
                  {r.issue_date || '—'}
                </td>
                <td className="px-4 py-2.5 text-slate-600 text-xs">
                  {r.challan_number || '—'}
                </td>
                <td className="px-4 py-2.5 text-center">
                  {r.regulation_file_present === true
                    ? <CheckCircle className="w-4 h-4 text-green-500 mx-auto" />
                    : r.regulation_file_present === false
                    ? <XCircle    className="w-4 h-4 text-red-400 mx-auto"   />
                    : <span className="text-slate-300">—</span>
                  }
                </td>
                <td
                  className="px-4 py-2.5 text-xs"
                  onClick={(e) => e.stopPropagation()}
                  title={r.dms_file_path || ''}
                >
                  <DmsFileCell
                    number={r.dms_file_number}
                    hasNs={r.dms_has_ns}
                    hasCs={r.dms_has_cs}
                  />
                </td>
                <td className="px-4 py-2.5">
                  <PattaStatusBadge status={r.status || 'issued'} />
                </td>
              </tr>
            ))}
            {!pattasQ.isPending && rows.length === 0 && (
              <tr>
                <td colSpan={11} className="px-4 py-10 text-center text-sm text-slate-400">
                  No patta records found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination
        page={page}
        totalPages={Math.ceil(total / PAGE_SIZE)}
        count={total}
        pageSize={PAGE_SIZE}
        onPage={setPage}
      />
    </div>
  )
}

/**
 * DMS File cell: shows the BHR number and, if scans are available, a
 * clickable "View" badge per PDF type. Clicking fetches the PDF through
 * the backend proxy (auth via JWT in header) and opens it in a new tab.
 *
 * No scan in the DMS index → just the number.
 * No number at all (patta never linked to a Document) → em-dash.
 */
function DmsFileCell({ number, hasNs, hasCs }) {
  if (!number) return <span className="text-slate-300">—</span>

  const open = async (type) => {
    try {
      await dmsApi.openInTab(number, type)
    } catch (err) {
      const status = err?.response?.status
      // err.response.data is a Blob here because responseType: 'blob' —
      // try to read it as text so the alert is useful.
      let detail = err?.message || 'Failed to open file.'
      if (err?.response?.data instanceof Blob) {
        try { detail = JSON.parse(await err.response.data.text()).detail || detail }
        catch { /* keep generic detail */ }
      }
      alert(`DMS (${status || 'network'}): ${detail}`)
    }
  }

  return (
    <div className="flex items-center gap-1.5">
      <span className="font-mono font-semibold text-slate-700">{number}</span>
      {hasNs && (
        <button
          type="button"
          onClick={() => open('ns')}
          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded
                     border border-blue-200 bg-blue-50 text-blue-700 text-[10px]
                     font-medium hover:bg-blue-100"
          title="Notesheet Side — open the noting scan in a new tab"
        >
          <FileText className="w-3 h-3" /> NS
        </button>
      )}
      {hasCs && (
        <button
          type="button"
          onClick={() => open('cs')}
          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded
                     border border-emerald-200 bg-emerald-50 text-emerald-700 text-[10px]
                     font-medium hover:bg-emerald-100"
          title="Correspondence Side — open the correspondence scan in a new tab"
        >
          <FileText className="w-3 h-3" /> CS
        </button>
      )}
    </div>
  )
}

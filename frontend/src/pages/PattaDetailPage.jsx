import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, FileText, CheckCircle, Clock, Pencil, ExternalLink } from 'lucide-react'
import { pattas as pattasApi, dms as dmsApi } from '@/api/endpoints'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { PlotStatusBadge } from '@/components/ui/Badge'
import { PattaEditModal } from '@/components/admin/PattaEditModal'
import { useAuthStore } from '@/stores/useAuthStore'

/**
 * DMS file card shown on the Patta detail page.
 *
 * Renders the BHR number, the synced filesystem path (for reference)
 * and one button per available PDF type (NS / CS). Buttons fetch the
 * PDF through the LMIS backend proxy (auth via JWT) and open it in a
 * new tab using a transient blob URL.
 */
function PattaDmsCard({ number, path, hasNs, hasCs }) {
  const open = async (type) => {
    try {
      await dmsApi.openInTab(number, type)
    } catch (err) {
      let detail = err?.message || 'Failed to open file.'
      if (err?.response?.data instanceof Blob) {
        try { detail = JSON.parse(await err.response.data.text()).detail || detail }
        catch { /* keep generic */ }
      }
      alert(`DMS (${err?.response?.status || 'network'}): ${detail}`)
    }
  }

  return (
    <Card>
      <div className="flex items-baseline justify-between mb-2">
        <h2 className="text-sm font-semibold text-slate-700">DMS File</h2>
        {path && (
          <button
            type="button"
            onClick={() => navigator.clipboard?.writeText(path).catch(() => {})}
            className="text-xs font-medium text-slate-500 hover:text-slate-800"
            title="Copy path to clipboard"
          >
            Copy path
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-2">
        <span className="text-sm font-mono font-semibold text-slate-800">
          {number || '—'}
        </span>
        {hasNs && (
          <button
            type="button"
            onClick={() => open('ns')}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md
                       border border-blue-200 bg-blue-50 text-blue-700 text-xs
                       font-medium hover:bg-blue-100"
            title="Notesheet Side — open the noting scan in a new tab"
          >
            <FileText className="w-3.5 h-3.5" />
            NS · Notesheet Side <ExternalLink className="w-3 h-3 opacity-70" />
          </button>
        )}
        {hasCs && (
          <button
            type="button"
            onClick={() => open('cs')}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md
                       border border-emerald-200 bg-emerald-50 text-emerald-700 text-xs
                       font-medium hover:bg-emerald-100"
            title="Correspondence Side — open the correspondence scan in a new tab"
          >
            <FileText className="w-3.5 h-3.5" />
            CS · Correspondence Side <ExternalLink className="w-3 h-3 opacity-70" />
          </button>
        )}
        {!hasNs && !hasCs && number && (
          <span className="text-xs text-slate-400">No scan yet in DMS.</span>
        )}
      </div>

      <span className="text-xs font-mono text-slate-500 break-all">
        {path || (
          <span className="text-slate-400 font-sans not-italic">
            Path not yet synced from DMS server.
          </span>
        )}
      </span>
    </Card>
  )
}

function Field({ label, value }) {
  return (
    <div>
      <p className="text-xs text-slate-400 mb-0.5">{label}</p>
      <p className="text-sm font-medium text-slate-800">{value || '—'}</p>
    </div>
  )
}

export default function PattaDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isAdmin  = useAuthStore((s) => s.isAdmin)()
  const [editing, setEditing] = useState(false)

  const { data: patta, isPending, isError } = useQuery({
    queryKey: ['patta', id],
    queryFn: () => pattasApi.detail(id),
  })

  const versions = useQuery({
    queryKey: ['patta', id, 'versions'],
    queryFn: () => pattasApi.versions(id),
    enabled: !!id,
  })

  if (isPending) return <p className="text-center py-16 text-slate-400">Loading patta record…</p>
  if (isError)   return <p className="text-center py-16 text-red-500">Failed to load patta record.</p>

  const vList = versions.data?.results ?? versions.data ?? []

  return (
    <div className="max-w-4xl space-y-5">
      {isAdmin && (
        <PattaEditModal
          patta={patta}
          open={editing}
          onClose={() => setEditing(false)}
        />
      )}

      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>
        {isAdmin && (
          <Button variant="primary" size="sm" onClick={() => setEditing(true)}>
            <Pencil className="w-4 h-4" /> Edit Patta
          </Button>
        )}
      </div>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">
            Patta #{patta.patta_number}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">{patta.allottee_name}</p>
        </div>
        {patta.regulation_file_present === true && (
          <span className="flex items-center gap-1.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
            <FileText className="w-3.5 h-3.5" /> Regulation File Present
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Allottee Details */}
        <Card>
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Allottee Details</h2>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Full Name"        value={patta.allottee_name} />
            <Field label="Father / Husband" value={patta.allottee_father_husband} />
            <Field label="Address"          value={patta.allottee_address} />
            <Field label="Patta Number"     value={patta.patta_number} />
          </div>
        </Card>

        {/* Financial Details */}
        <Card>
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Financial Details</h2>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Challan Number" value={patta.challan_number} />
            <Field label="Challan Date"   value={patta.challan_date} />
            <Field label="Lease Amount"   value={patta.lease_amount != null
              ? Number(patta.lease_amount).toLocaleString('en-IN', { style: 'currency', currency: 'INR' })
              : null}
            />
            <Field label="Lease Duration" value={patta.lease_duration ? `${patta.lease_duration} years` : null} />
          </div>
        </Card>
      </div>

      {/* DMS File Reference — sourced from the dms_sync mirror, refreshed nightly. */}
      {(patta.dms_file_number || patta.dms_file_path) && (
        <PattaDmsCard
          number={patta.dms_file_number}
          path={patta.dms_file_path}
          hasNs={patta.dms_has_ns}
          hasCs={patta.dms_has_cs}
        />
      )}

      {/* Linked Plots */}
      {patta.plots?.length > 0 && (
        <Card>
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Linked Plots</h2>
          <div className="flex flex-wrap gap-2">
            {patta.plots.map((pm) => (
              <div key={pm.id} className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                <span className="text-sm font-medium text-slate-800">
                  {pm.plot_detail?.plot_number ?? pm.plot}
                </span>
                <PlotStatusBadge status={pm.plot_detail?.status} />
                {pm.ownership_share_pct && (
                  <span className="text-xs text-slate-500">{pm.ownership_share_pct}%</span>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Remarks */}
      {patta.remarks && (
        <Card>
          <h2 className="text-sm font-semibold text-slate-700 mb-2">Remarks</h2>
          <p className="text-sm text-slate-600 whitespace-pre-wrap">{patta.remarks}</p>
        </Card>
      )}

      {/* Version history */}
      <Card>
        <h2 className="text-sm font-semibold text-slate-700 mb-3">
          Version History ({vList.length})
        </h2>
        {versions.isPending && <p className="text-sm text-slate-400">Loading…</p>}
        <div className="space-y-2">
          {vList.map((v) => (
            <div key={v.id} className="flex items-start gap-3 text-sm">
              <div className="mt-0.5 text-slate-400">
                {v.version_number === 1 ? (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                ) : (
                  <Clock className="w-4 h-4" />
                )}
              </div>
              <div>
                <span className="font-medium text-slate-700">v{v.version_number}</span>
                <span className="text-slate-400 ml-2 text-xs">
                  {v.changed_by_name && `by ${v.changed_by_name} · `}
                  {new Date(v.created_at).toLocaleString('en-IN')}
                </span>
                {v.change_summary && (
                  <p className="text-xs text-slate-500 mt-0.5">{v.change_summary}</p>
                )}
              </div>
            </div>
          ))}
          {!versions.isPending && vList.length === 0 && (
            <p className="text-sm text-slate-400">No version history.</p>
          )}
        </div>
      </Card>
    </div>
  )
}

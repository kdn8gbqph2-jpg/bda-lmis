import { useQuery } from '@tanstack/react-query'
import { MapPin, Grid3x3, FileText, FolderOpen, AlertTriangle } from 'lucide-react'
import { dashboard } from '@/api/endpoints'
import { StatCard, Card } from '@/components/ui/Card'

function ProgressBar({ value, max, color = 'bg-blue-500' }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-slate-100 rounded-full h-1.5 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-slate-500 tabular-nums w-8 text-right">{pct}%</span>
    </div>
  )
}

function ColonyRow({ colony }) {
  return (
    <div className="py-3 border-b border-slate-100 last:border-0">
      <div className="flex items-start justify-between mb-1.5">
        <div>
          <p className="text-sm font-medium text-slate-800">{colony.colony_name}</p>
          <p className="text-xs text-slate-400">{colony.zone} · {colony.total_plots} plots</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-500">
            <span className="text-green-600 font-medium">{colony.patta_ok}</span>
            {' / '}
            {colony.total_plots} patta ok
          </p>
          {colony.regulation_file_present > 0 && (
            <p className="text-xs text-amber-600">{colony.regulation_file_present} reg files</p>
          )}
        </div>
      </div>
      <ProgressBar
        value={colony.patta_ok}
        max={colony.total_plots}
        color="bg-emerald-500"
      />
    </div>
  )
}

export default function DashboardPage() {
  const stats = useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: () => dashboard.stats(),
  })
  const colonies = useQuery({
    queryKey: ['dashboard', 'colony-progress'],
    queryFn: () => dashboard.colonyProgress(),
  })
  const zones = useQuery({
    queryKey: ['dashboard', 'zone-breakdown'],
    queryFn: () => dashboard.zoneBreakdown(),
  })

  const s = stats.data || {}
  const colonyList = colonies.data?.results ?? colonies.data ?? []
  const zoneList   = zones.data?.results ?? zones.data ?? []

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Colonies"
          value={s.total_colonies}
          icon={MapPin}
          color="blue"
        />
        <StatCard
          label="Total Plots"
          value={s.total_plots?.toLocaleString('en-IN')}
          icon={Grid3x3}
          color="violet"
        />
        <StatCard
          label="Patta Issued"
          value={s.patta_ok?.toLocaleString('en-IN')}
          sub={`${s.patta_ok && s.total_plots ? Math.round((s.patta_ok / s.total_plots) * 100) : 0}% coverage`}
          icon={FileText}
          color="green"
        />
        <StatCard
          label="Missing Pattas"
          value={s.patta_missing?.toLocaleString('en-IN')}
          icon={AlertTriangle}
          color="red"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Colony progress */}
        <Card className="lg:col-span-2" padding={false}>
          <div className="px-5 py-4 border-b border-slate-200">
            <h2 className="text-sm font-semibold text-slate-800">Colony Progress</h2>
            <p className="text-xs text-slate-400 mt-0.5">Patta issuance by colony</p>
          </div>
          <div className="px-5 divide-y divide-slate-100 max-h-[420px] overflow-y-auto">
            {colonies.isPending && (
              <p className="py-8 text-center text-sm text-slate-400">Loading…</p>
            )}
            {colonyList.map((c) => (
              <ColonyRow key={c.colony_id} colony={c} />
            ))}
            {!colonies.isPending && colonyList.length === 0 && (
              <p className="py-8 text-center text-sm text-slate-400">No colony data.</p>
            )}
          </div>
        </Card>

        {/* Zone breakdown */}
        <Card padding={false}>
          <div className="px-5 py-4 border-b border-slate-200">
            <h2 className="text-sm font-semibold text-slate-800">Zone Breakdown</h2>
            <p className="text-xs text-slate-400 mt-0.5">Plots per zone</p>
          </div>
          <div className="px-5 py-3 space-y-3">
            {zones.isPending && (
              <p className="py-6 text-center text-sm text-slate-400">Loading…</p>
            )}
            {zoneList.map((z) => (
              <div key={z.zone}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-700 font-medium">{z.zone || 'Unclassified'}</span>
                  <span className="text-slate-500">{z.total_plots?.toLocaleString('en-IN')}</span>
                </div>
                <ProgressBar
                  value={z.total_plots}
                  max={s.total_plots || 1}
                  color="bg-blue-400"
                />
              </div>
            ))}
            {!zones.isPending && zoneList.length === 0 && (
              <p className="py-6 text-center text-sm text-slate-400">No zone data.</p>
            )}
          </div>
        </Card>
      </div>

      {/* Additional KPIs row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Documents"
          value={s.total_documents?.toLocaleString('en-IN')}
          icon={FolderOpen}
          color="amber"
        />
        <StatCard
          label="Verified Documents"
          value={s.verified_documents?.toLocaleString('en-IN')}
          sub={`${s.total_documents ? Math.round(((s.verified_documents || 0) / s.total_documents) * 100) : 0}% verified`}
          icon={FolderOpen}
          color="green"
        />
        <StatCard
          label="Available Plots"
          value={s.available_plots?.toLocaleString('en-IN')}
          icon={Grid3x3}
          color="slate"
        />
        <StatCard
          label="Regulation Files"
          value={s.regulation_files?.toLocaleString('en-IN')}
          icon={FileText}
          color="violet"
        />
      </div>
    </div>
  )
}

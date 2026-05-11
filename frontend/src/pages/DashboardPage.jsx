import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Grid3x3, FileText, FolderOpen, CheckCircle } from 'lucide-react'
import { dashboard, auditLogs } from '@/api/endpoints'

// ── KPI Card ──────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, icon: Icon, iconBg, iconColor, barColor, barPct }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-slate-500 text-xs font-medium uppercase tracking-wider">{label}</p>
          <p className="text-3xl font-bold text-slate-800 mt-1">{value ?? '—'}</p>
          {sub && <p className={`text-xs mt-1 font-medium ${sub.startsWith('↑') ? 'text-green-600' : sub.startsWith('↓') || sub.includes('missing') ? 'text-red-500' : 'text-slate-400'}`}>{sub}</p>}
        </div>
        {Icon && (
          <div className={`w-10 h-10 ${iconBg} rounded-xl flex items-center justify-center shrink-0`}>
            <Icon className={`w-5 h-5 ${iconColor}`} />
          </div>
        )}
      </div>
      <div className="mt-3 pt-3 border-t border-slate-100">
        <div className="w-full bg-slate-100 rounded-full h-1.5">
          <div className={`${barColor} h-1.5 rounded-full transition-all`} style={{ width: `${Math.min(barPct ?? 100, 100)}%` }} />
        </div>
      </div>
    </div>
  )
}

// ── Colony bar row ─────────────────────────────────────────────────────────────
function barColor(pct) {
  if (pct >= 75) return 'bg-green-500'
  if (pct >= 50) return 'bg-amber-500'
  if (pct >= 25) return 'bg-orange-500'
  return 'bg-red-500'
}

function ColonyBar({ colony }) {
  const pct = colony.total_plots > 0
    ? Math.round((colony.patta_ok / colony.total_plots) * 100)
    : 0
  return (
    <div className="flex items-center gap-3">
      <div className="w-44 text-xs text-slate-600 text-right truncate" title={colony.colony_name}>
        {colony.colony_name}
      </div>
      <div className="flex-1 bg-slate-100 rounded-full h-5 relative overflow-hidden">
        <div className={`${barColor(pct)} h-5 rounded-full`} style={{ width: `${pct}%` }} />
        <span className="absolute right-2 top-0.5 text-xs font-medium text-slate-700 mix-blend-multiply">
          {pct}%
        </span>
      </div>
      <div className="w-14 text-xs text-slate-400 text-right shrink-0">
        {colony.total_plots} plots
      </div>
    </div>
  )
}

// ── Plot Status Donut ──────────────────────────────────────────────────────────
function Donut({ stats }) {
  const total = stats.total_plots || 0
  if (!total) {
    return (
      <div className="flex justify-center mb-4">
        <div className="w-[140px] h-[140px] bg-slate-100 rounded-full flex items-center justify-center">
          <span className="text-xs text-slate-400">No data</span>
        </div>
      </div>
    )
  }

  const issued    = stats.pattas_issued    || 0
  const missing   = stats.pattas_missing   || 0
  const cancelled = stats.pattas_cancelled || 0
  const available = Math.max(0, total - issued - missing - cancelled)

  const R = 50, cx = 70, cy = 70, sw = 22
  const circ = 2 * Math.PI * R

  const segs = [
    [issued,    '#16a34a'],
    [available, '#0891b2'],
    [missing,   '#dc2626'],
    [cancelled, '#9ca3af'],
  ]

  let cumDash = 0
  const circles = segs.map(([val, color], i) => {
    const dash   = (val / total) * circ
    const offset = -cumDash
    cumDash += dash
    return (
      <circle
        key={i} cx={cx} cy={cy} r={R} fill="none"
        stroke={color} strokeWidth={sw}
        strokeDasharray={`${dash} ${circ}`}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${cx} ${cy})`}
      />
    )
  })

  return (
    <div className="flex justify-center mb-4">
      <svg width="140" height="140" viewBox="0 0 140 140">
        {circles}
        <text x="70" y="65" textAnchor="middle"
          style={{ fontSize: '18px', fontWeight: 700, fill: '#1e293b' }}>
          {total.toLocaleString('en-IN')}
        </text>
        <text x="70" y="82" textAnchor="middle"
          style={{ fontSize: '9px', fill: '#94a3b8' }}>
          total plots
        </text>
      </svg>
    </div>
  )
}

// ── Recent Activity row ───────────────────────────────────────────────────────
const ACTION_STYLE = {
  create: { bg: 'bg-green-100',  text: 'text-green-700',  label: 'Created'  },
  update: { bg: 'bg-blue-100',   text: 'text-blue-700',   label: 'Updated'  },
  delete: { bg: 'bg-red-100',    text: 'text-red-700',    label: 'Deleted'  },
}

function timeAgo(ts) {
  const diff = Date.now() - new Date(ts).getTime()
  if (diff < 60_000)    return 'just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} hr ago`
  return new Date(ts).toLocaleDateString('en-IN')
}

function ActivityRow({ log }) {
  const style = ACTION_STYLE[log.action] || { bg: 'bg-slate-100', text: 'text-slate-600', label: log.action }
  return (
    <div className="py-2.5 flex items-start gap-3">
      <div className={`w-7 h-7 ${style.bg} rounded-full flex items-center justify-center shrink-0 mt-0.5`}>
        <span className={`text-xs font-bold ${style.text}`}>
          {log.action?.[0]?.toUpperCase()}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-700">
          <span className="font-medium capitalize">{style.label}</span>{' '}
          <span className="capitalize">{log.entity_type}</span>{' '}
          <span className="font-medium text-slate-600">#{log.entity_id}</span>
        </p>
        <p className="text-xs text-slate-400 mt-0.5">
          {log.user_email || 'System'} · {timeAgo(log.timestamp)}
        </p>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const statsQ    = useQuery({ queryKey: ['dashboard', 'stats'],           queryFn: dashboard.stats })
  const coloniesQ = useQuery({ queryKey: ['dashboard', 'colony-progress'], queryFn: dashboard.colonyProgress })
  const zonesQ    = useQuery({ queryKey: ['dashboard', 'zone-breakdown'],  queryFn: dashboard.zoneBreakdown })
  const activityQ = useQuery({
    queryKey: ['dashboard', 'activity'],
    queryFn: () => auditLogs.list({ page_size: 5, ordering: '-timestamp' }),
    staleTime: 30_000,
  })

  const s          = statsQ.data || {}
  const colonyList = coloniesQ.data?.results ?? coloniesQ.data ?? []
  const zoneList   = zonesQ.data?.results   ?? zonesQ.data   ?? []
  const actList    = activityQ.data?.results ?? activityQ.data ?? []

  const pattaCoverage = s.total_plots > 0
    ? Math.round(((s.pattas_issued || 0) / s.total_plots) * 100)
    : 0
  const docCoverage = s.total_plots > 0
    ? Math.round(((s.total_documents || 0) / s.total_plots) * 100)
    : 0
  const missingPct = s.total_plots > 0
    ? Math.round(((s.pattas_missing || 0) / s.total_plots) * 100)
    : 0

  return (
    <div className="space-y-6">

      {/* Alert banner — only when there are missing files */}
      {s.pattas_missing > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-3 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
          <p className="text-red-700 text-sm">
            <span className="font-semibold">{s.pattas_missing.toLocaleString('en-IN')} pattas</span>
            {' '}have missing regulation files.{' '}
            <a href="/patta-ledger" className="underline font-medium hover:text-red-800">
              View patta ledger →
            </a>
          </p>
        </div>
      )}

      {/* ── KPI row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Total Plots"
          value={s.total_plots?.toLocaleString('en-IN')}
          icon={Grid3x3} iconBg="bg-blue-50" iconColor="text-blue-600"
          barColor="bg-blue-500" barPct={100}
        />
        <KpiCard
          label="Pattas Issued"
          value={s.pattas_issued?.toLocaleString('en-IN')}
          sub={`↑ ${pattaCoverage}% of total plots`}
          icon={CheckCircle} iconBg="bg-green-50" iconColor="text-green-600"
          barColor="bg-green-500" barPct={pattaCoverage}
        />
        <KpiCard
          label="Regulation File Missing"
          value={s.pattas_missing?.toLocaleString('en-IN')}
          sub={`Across ${s.total_colonies || 0} colon${s.total_colonies === 1 ? 'y' : 'ies'}`}
          icon={AlertTriangle} iconBg="bg-red-50" iconColor="text-red-500"
          barColor="bg-red-500" barPct={missingPct}
        />
        <KpiCard
          label="Documents Scanned"
          value={s.total_documents?.toLocaleString('en-IN')}
          sub={`${docCoverage}% scanned`}
          icon={FolderOpen} iconBg="bg-amber-50" iconColor="text-amber-600"
          barColor="bg-amber-500" barPct={docCoverage}
        />
      </div>

      {/* ── Colony progress + Donut ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Colony Scanning Progress (2/3) */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-slate-800 text-sm">Colony Scanning Progress</h3>
              <p className="text-slate-400 text-xs">Documents scanned vs total pattas issued</p>
            </div>
          </div>

          <div className="space-y-2.5">
            {coloniesQ.isPending && (
              <p className="text-center text-sm text-slate-400 py-6">Loading…</p>
            )}
            {colonyList.map((c) => <ColonyBar key={c.colony_id ?? c.id} colony={c} />)}
            {!coloniesQ.isPending && colonyList.length === 0 && (
              <p className="text-center text-sm text-slate-400 py-6">No colony data available.</p>
            )}
          </div>

          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-4 text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-green-500 rounded-sm inline-block"/>≥75%
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-amber-500 rounded-sm inline-block"/>50–74%
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-orange-500 rounded-sm inline-block"/>25–49%
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-red-500 rounded-sm inline-block"/>&lt;25%
            </span>
          </div>
        </div>

        {/* Plot Status Donut (1/3) */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h3 className="font-semibold text-slate-800 text-sm mb-1">Plot Status</h3>
          <p className="text-slate-400 text-xs mb-4">Distribution across all colonies</p>

          <Donut stats={s} />

          <div className="space-y-2">
            {[
              ['bg-green-600', 'Patta Issued',  s.pattas_issued],
              ['bg-cyan-600',  'Available',      Math.max(0, (s.total_plots||0) - (s.pattas_issued||0) - (s.pattas_missing||0) - (s.pattas_cancelled||0))],
              ['bg-red-600',   'File Missing',  s.pattas_missing],
              ['bg-gray-400',  'Cancelled',     s.pattas_cancelled],
            ].map(([bg, label, val = 0]) => (
              <div key={label} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5">
                  <span className={`w-2.5 h-2.5 ${bg} rounded-sm`}/>
                  {label}
                </span>
                <span className="font-semibold text-slate-700">
                  {Number(val).toLocaleString('en-IN')}{' '}
                  <span className="text-slate-400 font-normal">
                    ({s.total_plots > 0 ? Math.round((val / s.total_plots) * 100) : 0}%)
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Zone breakdown + Recent Activity ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Zone Breakdown (1/3) */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h3 className="font-semibold text-slate-800 text-sm mb-4">Zone Breakdown</h3>
          <div className="space-y-3">
            {zonesQ.isPending && (
              <p className="text-center text-sm text-slate-400">Loading…</p>
            )}
            {zoneList.map((z) => {
              const pct = s.total_plots > 0
                ? Math.round((z.total_plots / s.total_plots) * 100)
                : 0
              return (
                <div key={z.zone}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-600 font-medium">{z.zone || 'Unclassified'}</span>
                    <span className="text-slate-500">{z.total_plots?.toLocaleString('en-IN')} plots</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2">
                    <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
            {!zonesQ.isPending && zoneList.length === 0 && (
              <p className="text-center text-sm text-slate-400 py-4">No zone data.</p>
            )}
          </div>
        </div>

        {/* Recent Activity (2/3) */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-800 text-sm">Recent Activity</h3>
            <a href="/admin/audit-logs" className="text-blue-600 text-xs font-medium hover:underline">
              View audit log →
            </a>
          </div>
          <div className="divide-y divide-slate-100">
            {activityQ.isPending && (
              <p className="text-center text-sm text-slate-400 py-6">Loading…</p>
            )}
            {actList.map((log) => <ActivityRow key={log.id} log={log} />)}
            {!activityQ.isPending && actList.length === 0 && (
              <p className="text-center text-sm text-slate-400 py-6">No recent activity.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

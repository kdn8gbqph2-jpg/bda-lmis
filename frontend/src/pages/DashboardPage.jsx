/**
 * DashboardPage — high-level overview for authenticated staff.
 *
 * Shows exactly:
 *   1. Total Colonies   (KPI)
 *   2. Total Plots      (KPI)
 *   3. Total Pattas     (KPI)
 *   4. Approved Layouts (KPI)
 *   5. Zone-wise Breakdown
 *   6. Recent Activity Logs
 */

import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  Building2, Grid3x3, FileText, CheckCircle2,
  Plus, Pencil, Trash2, ArrowRight, MapPin, Activity,
} from 'lucide-react'

import { dashboard, auditLogs } from '@/api/endpoints'

// ── Helpers ──────────────────────────────────────────────────────────────────

const num = (v) => (v == null ? '—' : Number(v).toLocaleString('en-IN'))

function timeAgo(ts) {
  if (!ts) return ''
  const diff = Date.now() - new Date(ts).getTime()
  if (diff < 60_000)     return 'just now'
  if (diff < 3_600_000)  return `${Math.floor(diff / 60_000)} min ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} hr ago`
  return new Date(ts).toLocaleDateString('en-IN')
}

// ── KPI Card ─────────────────────────────────────────────────────────────────

const KPI_THEMES = {
  blue:    { tile: 'from-blue-50    via-white to-white', icon: 'bg-blue-100    text-blue-700',    accent: 'bg-blue-500'    },
  indigo:  { tile: 'from-indigo-50  via-white to-white', icon: 'bg-indigo-100  text-indigo-700',  accent: 'bg-indigo-500'  },
  emerald: { tile: 'from-emerald-50 via-white to-white', icon: 'bg-emerald-100 text-emerald-700', accent: 'bg-emerald-500' },
  amber:   { tile: 'from-amber-50   via-white to-white', icon: 'bg-amber-100   text-amber-700',   accent: 'bg-amber-500'   },
}

function KpiCard({ label, value, icon: Icon, theme = 'blue', sub }) {
  const t = KPI_THEMES[theme] ?? KPI_THEMES.blue
  return (
    <div className={`relative bg-gradient-to-br ${t.tile} rounded-2xl border border-slate-200 shadow-sm overflow-hidden`}>
      <span className={`absolute inset-x-0 top-0 h-1 ${t.accent}`} />
      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">
            {label}
          </p>
          <span className={`w-9 h-9 rounded-xl ${t.icon} flex items-center justify-center`}>
            <Icon className="w-4.5 h-4.5" style={{ width: 18, height: 18 }} strokeWidth={2.25} />
          </span>
        </div>
        <p className="text-3xl font-bold text-slate-900 tabular-nums leading-tight">
          {value}
        </p>
        {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
      </div>
    </div>
  )
}

// ── Zone Breakdown ───────────────────────────────────────────────────────────

const ZONE_COLOR = {
  East: { bar: 'bg-blue-500',    bg: 'bg-blue-50',    text: 'text-blue-700'    },
  West: { bar: 'bg-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-700' },
}

function ZoneCard({ zone, colonies, plots, total, totalColonies }) {
  const colonyPct = totalColonies ? Math.round((colonies / totalColonies) * 100) : 0
  const c = ZONE_COLOR[zone] ?? { bar: 'bg-slate-400', bg: 'bg-slate-100', text: 'text-slate-700' }
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${c.bar}`} />
          <span className="text-sm font-semibold text-slate-800">{zone}</span>
        </div>
        <span className="text-xs text-slate-400 tabular-nums">{colonyPct}%</span>
      </div>
      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
        <div className={`h-full ${c.bar} rounded-full transition-all`} style={{ width: `${colonyPct}%` }} />
      </div>
      <div className="flex items-center gap-3 text-xs text-slate-500">
        <span><span className="font-semibold text-slate-700 tabular-nums">{num(colonies)}</span> colonies</span>
        <span>·</span>
        <span><span className="font-semibold text-slate-700 tabular-nums">{num(plots)}</span> plots</span>
      </div>
    </div>
  )
}

// ── Activity Row ─────────────────────────────────────────────────────────────

const ACTION_META = {
  create: { icon: Plus,    bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Created' },
  update: { icon: Pencil,  bg: 'bg-blue-100',    text: 'text-blue-700',    label: 'Updated' },
  delete: { icon: Trash2,  bg: 'bg-red-100',     text: 'text-red-700',     label: 'Deleted' },
}

function ActivityRow({ log }) {
  const meta = ACTION_META[log.action] ?? { icon: Activity, bg: 'bg-slate-100', text: 'text-slate-600', label: log.action }
  const Icon = meta.icon
  return (
    <div className="flex items-start gap-3 py-2.5">
      <span className={`w-7 h-7 rounded-full ${meta.bg} flex items-center justify-center flex-shrink-0`}>
        <Icon className={`w-3.5 h-3.5 ${meta.text}`} strokeWidth={2.25} />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-800 truncate">
          <span className="font-semibold">{meta.label}</span>{' '}
          <span className="capitalize text-slate-600">{log.entity_type}</span>{' '}
          <span className="text-slate-400">#{log.entity_id}</span>
        </p>
        <p className="text-[11px] text-slate-400 mt-0.5 truncate">
          {log.user_name || log.user_email || 'System'} · {timeAgo(log.timestamp)}
        </p>
      </div>
    </div>
  )
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const statsQ = useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: dashboard.stats,
    staleTime: 60_000,
  })
  const zonesQ = useQuery({
    queryKey: ['dashboard', 'zone-breakdown'],
    queryFn: dashboard.zoneBreakdown,
    staleTime: 60_000,
  })
  const activityQ = useQuery({
    queryKey: ['dashboard', 'activity'],
    queryFn: () => auditLogs.list({ page_size: 8, ordering: '-timestamp' }),
    staleTime: 30_000,
  })

  const s         = statsQ.data || {}
  const zoneList  = zonesQ.data?.results ?? zonesQ.data ?? []
  const actList   = activityQ.data?.results ?? activityQ.data ?? []

  const totalColonies = s.total_colonies ?? 0
  const approvedPct   = totalColonies
    ? Math.round(((s.approved_layouts || 0) / totalColonies) * 100)
    : null

  return (
    <div className="space-y-6">

      {/* ── KPI row ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Total Colonies"
          value={num(s.total_colonies)}
          icon={Building2}
          theme="blue"
        />
        <KpiCard
          label="Total Plots"
          value={num(s.total_plots)}
          icon={Grid3x3}
          theme="indigo"
        />
        <KpiCard
          label="Total Pattas"
          value={num(s.total_pattas)}
          icon={FileText}
          theme="emerald"
          sub={s.pattas_issued != null ? `${num(s.pattas_issued)} issued` : null}
        />
        <KpiCard
          label="Approved Layouts"
          value={num(s.approved_layouts)}
          icon={CheckCircle2}
          theme="amber"
          sub={approvedPct != null ? `${approvedPct}% of colonies` : null}
        />
      </div>

      {/* ── Zone breakdown + Recent activity ────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Zone-wise Breakdown */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <MapPin className="w-4 h-4 text-slate-500" />
            <h3 className="text-sm font-semibold text-slate-800">Zone-wise Breakdown</h3>
          </div>

          {zonesQ.isPending ? (
            <p className="text-center text-sm text-slate-400 py-6">Loading…</p>
          ) : zoneList.length === 0 ? (
            <p className="text-center text-sm text-slate-400 py-6">No zone data.</p>
          ) : (
            <div className="space-y-5">
              {zoneList.map((z) => (
                <ZoneCard
                  key={z.zone || 'unclassified'}
                  zone={z.zone || 'Unclassified'}
                  colonies={z.colony_count}
                  plots={(z.total_residential_plots || 0) + (z.total_commercial_plots || 0)}
                  totalColonies={totalColonies}
                />
              ))}
            </div>
          )}
        </div>

        {/* Recent Activity (2/3) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-slate-500" />
              <h3 className="text-sm font-semibold text-slate-800">Recent Activity</h3>
            </div>
            <Link
              to="/admin/audit-logs"
              className="text-xs font-medium text-blue-700 hover:text-blue-900 flex items-center gap-1 group"
            >
              View full audit log
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>

          {activityQ.isPending ? (
            <p className="text-center text-sm text-slate-400 py-6">Loading…</p>
          ) : actList.length === 0 ? (
            <p className="text-center text-sm text-slate-400 py-6">No recent activity yet.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {actList.map((log) => <ActivityRow key={log.id} log={log} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

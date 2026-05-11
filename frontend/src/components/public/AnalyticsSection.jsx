/**
 * AnalyticsSection — colony distribution donut + approval status bar chart.
 *
 * Props:
 *   counts   { colony_type: number, ... } — same shape as PublicDashboardPage
 *   loading  bool — show skeletons while data is loading
 */

import { motion } from 'framer-motion'
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis,
  Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts'
import { PieChart as PieIcon, BarChart3 } from 'lucide-react'

// Brand colors that match the category-card palette
const DONUT_COLORS = {
  bda_scheme:       '#3b82f6',   // blue-500
  private_approved: '#10b981',   // emerald-500
  suo_moto:         '#f59e0b',   // amber-500
  pending_layout:   '#f97316',   // orange-500
  rejected_layout:  '#ef4444',   // red-500
}

const LABELS = {
  bda_scheme:       'BDA Schemes',
  private_approved: 'Private Approved',
  suo_moto:         'SUO-Moto',
  pending_layout:   'Pending',
  rejected_layout:  'Rejected',
}

function ChartCard({ title, sub, icon: Icon, children, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
      className="bg-white border border-slate-200 rounded-xl overflow-hidden"
    >
      <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-slate-50 flex items-center justify-center">
          <Icon className="w-4 h-4 text-slate-600" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
          <p className="text-[10px] text-slate-400">{sub}</p>
        </div>
      </div>
      <div className="p-3">{children}</div>
    </motion.div>
  )
}

export function AnalyticsSection({ counts, loading }) {
  // Build chart data only when counts are loaded
  const data = counts
    ? Object.entries(counts).map(([k, v]) => ({
        key:   k,
        name:  LABELS[k] ?? k,
        value: v,
        color: DONUT_COLORS[k] ?? '#64748b',
      }))
    : []

  const totalCount = data.reduce((sum, d) => sum + d.value, 0)
  const hasData    = totalCount > 0

  return (
    <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">

      {/* ── Donut: distribution ─────────────────────────────────────────── */}
      <ChartCard
        title="Colony Distribution"
        sub="Breakdown by category"
        icon={PieIcon}
        delay={0}
      >
        {loading ? (
          <div className="h-56 flex items-center justify-center">
            <div className="w-32 h-32 rounded-full bg-slate-100 animate-pulse" />
          </div>
        ) : !hasData ? (
          <EmptyState />
        ) : (
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  innerRadius={45}
                  outerRadius={75}
                  paddingAngle={2}
                  dataKey="value"
                  nameKey="name"
                  stroke="#fff"
                  strokeWidth={2}
                >
                  {data.map((d) => (
                    <Cell key={d.key} fill={d.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
                <Legend
                  verticalAlign="bottom"
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: 11, color: '#64748b' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </ChartCard>

      {/* ── Bar: approval status ───────────────────────────────────────── */}
      <ChartCard
        title="Approval Status"
        sub="Colonies per category"
        icon={BarChart3}
        delay={0.08}
      >
        {loading ? (
          <div className="h-56 flex items-end gap-3 px-4 pb-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex-1 bg-slate-100 animate-pulse rounded-t"
                   style={{ height: `${30 + i * 12}%` }} />
            ))}
          </div>
        ) : !hasData ? (
          <EmptyState />
        ) : (
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  axisLine={{ stroke: '#e2e8f0' }}
                  tickLine={false}
                  interval={0}
                  angle={-15}
                  textAnchor="end"
                  height={50}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: '#f1f5f9' }} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {data.map((d) => (
                    <Cell key={d.key} fill={d.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </ChartCard>
    </section>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const tooltipStyle = {
  fontSize: 11,
  border: '1px solid #e2e8f0',
  borderRadius: 8,
  padding: '4px 8px',
  boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
}

function EmptyState() {
  return (
    <div className="h-56 flex flex-col items-center justify-center text-slate-400">
      <BarChart3 className="w-8 h-8 mb-2 opacity-40" />
      <p className="text-xs">No colony data yet</p>
      <p className="text-[10px] text-slate-300 mt-0.5">Charts will appear once colonies are imported</p>
    </div>
  )
}

/**
 * ChartsSection — amCharts 5 visuals for the dashboard.
 *
 * Renders two side-by-side charts powered by GET /api/dashboard/charts/:
 *   - Colony Type Distribution (donut)
 *   - Pattas Issued by Year     (column)
 *
 * Charts are recreated whenever the source data changes; the cleanup
 * in useEffect's return disposes the amCharts Root so we don't leak
 * canvases on route changes.
 */

import { useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { PieChart, BarChart3 } from 'lucide-react'

import * as am5         from '@amcharts/amcharts5'
import * as am5percent  from '@amcharts/amcharts5/percent'
import * as am5xy       from '@amcharts/amcharts5/xy'
import am5themes_Animated from '@amcharts/amcharts5/themes/Animated'

import { dashboard } from '@/api/endpoints'

// ── Colour palette per colony_type (matches the rest of the app) ─────────────

const TYPE_COLOURS = {
  bda_scheme:       0x3b82f6,  // blue-500
  private_approved: 0x10b981,  // emerald-500
  suo_moto:         0xf59e0b,  // amber-500
  pending_layout:   0xf97316,  // orange-500
  rejected_layout:  0xef4444,  // red-500
}

// ── Component ────────────────────────────────────────────────────────────────

export function ChartsSection() {
  const { data, isPending } = useQuery({
    queryKey: ['dashboard', 'charts'],
    queryFn:  dashboard.charts,
    staleTime: 60_000,
  })

  return (
    <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <ChartCard
        title="Colony Type Distribution"
        icon={PieChart}
      >
        <DonutChart
          id="chart-colony-types"
          data={data?.colony_type_distribution ?? []}
          loading={isPending}
        />
      </ChartCard>

      <ChartCard
        title="Pattas Issued by Year"
        icon={BarChart3}
      >
        <YearlyColumnChart
          id="chart-pattas-year"
          data={data?.pattas_by_year ?? []}
          loading={isPending}
        />
      </ChartCard>
    </section>
  )
}

// ── Shared shell ─────────────────────────────────────────────────────────────

function ChartCard({ title, icon: Icon, children }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4 text-slate-500" />
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      </div>
      {children}
    </div>
  )
}

// ── Donut: colony types ──────────────────────────────────────────────────────

function DonutChart({ id, data, loading }) {
  const ref = useRef(null)

  useEffect(() => {
    if (!ref.current || loading) return
    if (!data.length || data.every((d) => !d.count)) return

    const root = am5.Root.new(ref.current)
    root.setThemes([am5themes_Animated.new(root)])

    const chart = root.container.children.push(
      am5percent.PieChart.new(root, {
        layout: root.verticalLayout,
        innerRadius: am5.percent(55),
      })
    )

    const series = chart.series.push(
      am5percent.PieSeries.new(root, {
        valueField:    'count',
        categoryField: 'label',
        legendLabelText:      '{category}',
        legendValueText:      '{value}',
      })
    )
    series.slices.template.setAll({
      strokeWidth: 2,
      stroke:      am5.color(0xffffff),
    })
    series.labels.template.set('visible', false)
    series.ticks.template.set('visible', false)
    series.slices.template.adapters.add('fill', (_fill, target) => {
      const ctx = target.dataItem?.dataContext
      return am5.color(TYPE_COLOURS[ctx?.value] ?? 0x64748b)
    })

    series.data.setAll(data)

    // Wrap the legend onto multiple lines when the card is narrow.
    // root.gridLayout flows items left-to-right then breaks to the
    // next row, which is what we want for 5 colony types in a small
    // donut card — the horizontalLayout we had was clipping at the
    // right edge.
    const legend = chart.children.push(
      am5.Legend.new(root, {
        centerX:    am5.percent(50),
        x:          am5.percent(50),
        marginTop:  12,
        layout:     root.gridLayout,
        useDefaultMarker: true,
      })
    )
    legend.markers.template.setAll({ width: 10, height: 10 })
    legend.markerRectangles.template.setAll({ cornerRadiusTL: 2, cornerRadiusTR: 2, cornerRadiusBL: 2, cornerRadiusBR: 2 })
    legend.labels.template.setAll({ fontSize: 12, fill: am5.color(0x334155) })
    legend.valueLabels.template.setAll({ fontSize: 12, fill: am5.color(0x64748b) })
    // Cap label width so a long category doesn't push neighbours off
    // the card. Long labels truncate with ellipsis on amCharts side.
    legend.labels.template.setAll({ maxWidth: 130, oversizedBehavior: 'truncate' })

    legend.data.setAll(series.dataItems)

    series.appear(800, 100)
    return () => root.dispose()
  }, [data, loading])

  return <ChartCanvas innerRef={ref} loading={loading} empty={!data.some((d) => d.count)} height={320} />
}

// ── Column: pattas by year ───────────────────────────────────────────────────

function YearlyColumnChart({ id, data, loading }) {
  const ref = useRef(null)

  useEffect(() => {
    if (!ref.current || loading) return
    if (!data.length) return

    const root = am5.Root.new(ref.current)
    root.setThemes([am5themes_Animated.new(root)])

    const chart = root.container.children.push(
      am5xy.XYChart.new(root, {
        panX: false, panY: false, wheelX: 'none', wheelY: 'none',
        paddingLeft: 0, paddingRight: 4,
      })
    )

    const xRenderer = am5xy.AxisRendererX.new(root, { minGridDistance: 30 })
    xRenderer.labels.template.setAll({ fontSize: 11, fill: am5.color(0x64748b) })
    xRenderer.grid.template.set('visible', false)

    const xAxis = chart.xAxes.push(
      am5xy.CategoryAxis.new(root, {
        categoryField: 'year',
        renderer:      xRenderer,
      })
    )

    const yRenderer = am5xy.AxisRendererY.new(root, {})
    yRenderer.labels.template.setAll({ fontSize: 11, fill: am5.color(0x94a3b8) })
    yRenderer.grid.template.setAll({ stroke: am5.color(0xe2e8f0), strokeDasharray: [2, 2] })

    const yAxis = chart.yAxes.push(
      am5xy.ValueAxis.new(root, { renderer: yRenderer, min: 0 })
    )

    const series = chart.series.push(
      am5xy.ColumnSeries.new(root, {
        xAxis, yAxis,
        valueYField:   'count',
        categoryXField:'year',
        tooltip: am5.Tooltip.new(root, {
          labelText: '{categoryX}: [bold]{valueY}[/]',
        }),
      })
    )
    series.columns.template.setAll({
      cornerRadiusTL: 4,
      cornerRadiusTR: 4,
      strokeOpacity:  0,
      fillOpacity:    0.9,
      fill:           am5.color(0x3b82f6),
      width:          am5.percent(70),
    })

    xAxis.data.setAll(data)
    series.data.setAll(data)

    chart.set('cursor', am5xy.XYCursor.new(root, { behavior: 'none' }))
    series.appear(800)
    chart.appear(1000, 100)
    return () => root.dispose()
  }, [data, loading])

  return <ChartCanvas innerRef={ref} loading={loading} empty={!data.length} />
}

// ── Common canvas wrapper (handles loading + empty states) ───────────────────

function ChartCanvas({ innerRef, loading, empty, height = 280 }) {
  return (
    <div className="relative">
      <div ref={innerRef} style={{ width: '100%', height }} />
      {(loading || empty) && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-400 pointer-events-none">
          {loading ? 'Loading chart…' : 'No data yet'}
        </div>
      )}
    </div>
  )
}

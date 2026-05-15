/**
 * PublicColonyDetailPage — unauthenticated colony detail view.
 *
 * Shows colony metadata, khasra list, and map download buttons (PDF/SVG/PNG).
 * No staff-only fields (DLC file number, updated_by, etc.) are shown.
 */

import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  MapPin, Calendar, Download, Maximize2,
  ChevronLeft, AlertTriangle, Info, Image as ImageIcon, FileText as PdfIcon,
} from 'lucide-react'
import { publicApi } from '@/api/endpoints'

// ── Constants ──────────────────────────────────────────────────────────────────

const COLONY_TYPE_COLORS = {
  bda_scheme:       'bg-blue-100 text-blue-800 border-blue-200',
  private_approved: 'bg-green-100 text-green-800 border-green-200',
  suo_moto:         'bg-amber-100 text-amber-800 border-amber-200',
  pending_layout:   'bg-orange-100 text-orange-800 border-orange-200',
  rejected_layout:  'bg-red-100 text-red-800 border-red-200',
}

// Deterministic pill palette for khasra numbers — same hash-based scheme used
// across the admin colony / patta edit modals so a given khasra is always the
// same colour wherever it shows up.
const PILL_PALETTE = [
  { bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200'    },
  { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  { bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200'   },
  { bg: 'bg-purple-50',  text: 'text-purple-700',  border: 'border-purple-200'  },
  { bg: 'bg-rose-50',    text: 'text-rose-700',    border: 'border-rose-200'    },
  { bg: 'bg-sky-50',     text: 'text-sky-700',     border: 'border-sky-200'     },
  { bg: 'bg-orange-50',  text: 'text-orange-700',  border: 'border-orange-200'  },
  { bg: 'bg-teal-50',    text: 'text-teal-700',    border: 'border-teal-200'    },
]

function pillColor(token) {
  let h = 0
  for (const c of String(token)) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return PILL_PALETTE[h % PILL_PALETTE.length]
}

const MAP_FORMAT_META = {
  pdf:  { label: 'PDF',  desc: 'Layout Plan (PDF)',    icon: '📄' },
  jpeg: { label: 'JPEG', desc: 'Map Image (JPEG)',     icon: '🖼️' },
  png:  { label: 'PNG',  desc: 'Map Image (PNG)',      icon: '🖼️' },
  svg:  { label: 'SVG',  desc: 'Vector Map (SVG)',     icon: '🗺️' },
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function PublicColonyDetailPage() {
  const { id } = useParams()

  const { data: colony, isLoading, isError } = useQuery({
    queryKey: ['public-colony', id],
    queryFn:  () => publicApi.colonyDetail(id),
    staleTime: 5 * 60 * 1000,
  })

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
        <div className="space-y-4 animate-pulse">
          <div className="h-7 bg-slate-200 rounded w-1/3" />
          <div className="h-5 bg-slate-200 rounded w-1/2" />
          <div className="h-40 bg-slate-200 rounded-xl" />
          <div className="h-40 bg-slate-200 rounded-xl" />
        </div>
      </div>
    )
  }

  if (isError || !colony) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16 text-center text-slate-500">
        Colony not found or could not be loaded.
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-5">

      {/* ── Breadcrumb ──────────────────────────────────────────────────── */}
      <nav className="text-sm text-slate-500 mb-5 flex items-center gap-1.5">
        <Link to="/public" className="hover:text-blue-700 transition">Colony Dashboard</Link>
        <span>›</span>
        <Link
          to={`/public/colonies?colony_type=${colony.colony_type}`}
          className="hover:text-blue-700 transition"
        >
          {colony.colony_type_label}
        </Link>
        <span>›</span>
        <span className="text-slate-700 font-medium truncate">{colony.name}</span>
      </nav>

      {/* ── Header card ─────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 mb-1">{colony.name}</h1>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium border ${
                COLONY_TYPE_COLORS[colony.colony_type] ?? 'bg-slate-100 text-slate-700 border-slate-200'
              }`}>
                {colony.colony_type_label}
              </span>
              {colony.zone && (
                <span className="flex items-center gap-1 text-xs text-slate-500">
                  <MapPin className="w-3.5 h-3.5" /> {colony.zone} Zone
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ── Summary grid ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-100">
          <div>
            <div className="text-xs text-slate-400 mb-0.5 flex items-center gap-1">
              <Calendar className="w-3 h-3" /> Approval Date
            </div>
            <div className="text-sm font-medium text-slate-700">
              {colony.layout_approval_date ?? '—'}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-400 mb-0.5 flex items-center gap-1">
              <MapPin className="w-3 h-3" /> Revenue Village
            </div>
            <div className="text-sm font-medium text-slate-700">
              {colony.revenue_village || '—'}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-400 mb-0.5 flex items-center gap-1">
              <MapPin className="w-3 h-3" /> Zone
            </div>
            <div className="text-sm font-medium text-slate-700">
              {colony.zone ? `${colony.zone} Zone` : '—'}
            </div>
          </div>
        </div>
      </div>

      {/* ── Rejection reason (rejected_layout only) ──────────────────── */}
      {colony.colony_type === 'rejected_layout' && colony.rejection_reason && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 mb-5 flex gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold text-red-800 text-sm mb-1">Rejection Reason</div>
            <p className="text-red-700 text-sm leading-relaxed">{colony.rejection_reason}</p>
          </div>
        </div>
      )}

      {/* ── Remarks ─────────────────────────────────────────────────────── */}
      {colony.remarks && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 mb-5 flex gap-3">
          <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold text-blue-800 text-sm mb-1">Remarks</div>
            <p className="text-blue-700 text-sm leading-relaxed">{colony.remarks}</p>
          </div>
        </div>
      )}

      {/* ── Layout Preview (renders the actual map inline) ────────────── */}
      <LayoutPreview colony={colony} />

      {/* ── Khasra list (colored pills) ─────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm mt-5">
        <h2 className="font-semibold text-slate-700 text-sm mb-3">
          Khasra Numbers ({colony.khasras?.length ?? 0})
        </h2>

        {colony.khasras?.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {colony.khasras.map((k, i) => {
              const c = pillColor(k.number)
              return (
                <span
                  key={i}
                  className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${c.bg} ${c.text} ${c.border}`}
                  title={k.total_bigha != null ? `${Number(k.total_bigha).toFixed(2)} Bigha` : 'Area not recorded'}
                >
                  {k.number}
                </span>
              )
            })}
          </div>
        ) : (
          <p className="text-sm text-slate-400 py-3 text-center">
            No khasra records linked.
          </p>
        )}
      </div>

      {/* ── Back link ───────────────────────────────────────────────────── */}
      <div className="mt-8">
        <Link
          to={`/public/colonies?colony_type=${colony.colony_type}`}
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-blue-700 transition"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to {colony.colony_type_label}
        </Link>
      </div>
    </div>
  )
}

// ── LayoutPreview ──────────────────────────────────────────────────────────
//
// Renders the colony's layout inline. Prefers image formats (jpeg / png /
// svg) because the browser can show them at full quality without
// downloading; falls back to a PDF iframe for colonies that only have a
// PDF. The user picks any other available format via the format pills,
// and "Download" preserves the original save-to-disk behaviour for every
// available format.

const FORMAT_PREFERENCE = ['jpeg', 'png', 'svg', 'pdf']

function LayoutPreview({ colony }) {
  const formats = (colony.available_map_formats || []).filter((f) =>
    FORMAT_PREFERENCE.includes(f),
  )
  // Pick the best format to render by default
  const initial  = FORMAT_PREFERENCE.find((f) => formats.includes(f)) || null
  const [active, setActive] = useState(initial)

  if (formats.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <h2 className="font-semibold text-slate-700 text-sm mb-2 flex items-center gap-2">
          <Download className="w-4 h-4" /> Layout Maps
        </h2>
        <p className="text-sm text-slate-400 py-3 text-center">
          No map files uploaded yet.
        </p>
      </div>
    )
  }

  const inlineUrl   = publicApi.mapInlineUrl(colony.id, active)
  const downloadUrl = publicApi.mapDownloadUrl(colony.id, active)
  const isPdf       = active === 'pdf'

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-b border-slate-100">
        <h2 className="font-semibold text-slate-700 text-sm flex items-center gap-2">
          {isPdf ? <PdfIcon className="w-4 h-4" /> : <ImageIcon className="w-4 h-4" />}
          Layout Plan
        </h2>
        <div className="flex items-center gap-1.5">
          {/* Format selector pills */}
          {formats.length > 1 && formats.map((fmt) => {
            const meta = MAP_FORMAT_META[fmt] || { label: fmt.toUpperCase() }
            return (
              <button
                key={fmt}
                type="button"
                onClick={() => setActive(fmt)}
                className={`text-[11px] font-semibold px-2 py-0.5 rounded border transition
                            ${active === fmt
                              ? 'bg-blue-50 text-blue-700 border-blue-300'
                              : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
              >
                {meta.label}
              </button>
            )
          })}
          <a
            href={inlineUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5
                       rounded border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-800"
            title="Open in new tab"
          >
            <Maximize2 className="w-3 h-3" /> Open
          </a>
          <a
            href={downloadUrl}
            className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5
                       rounded border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-800"
            title="Download original file"
          >
            <Download className="w-3 h-3" /> Download
          </a>
        </div>
      </div>

      <div className="bg-slate-50">
        {isPdf ? (
          <iframe
            key={inlineUrl}
            src={`${inlineUrl}#view=FitH`}
            title={`${colony.name} — layout PDF`}
            className="w-full h-[640px] border-0"
          />
        ) : (
          <img
            key={inlineUrl}
            src={inlineUrl}
            alt={`${colony.name} — layout ${active.toUpperCase()}`}
            className="w-full h-auto max-h-[640px] object-contain bg-white"
          />
        )}
      </div>
    </div>
  )
}

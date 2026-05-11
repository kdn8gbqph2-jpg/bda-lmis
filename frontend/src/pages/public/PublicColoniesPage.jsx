/**
 * PublicColoniesPage — filterable list of colonies, grouped by colony_type.
 *
 * Reads ?colony_type=... and ?search=... from the URL so that links from
 * the dashboard pre-filter the list.
 */

import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Search, ChevronLeft, ChevronRight,
  MapPin, Calendar, FileText, Download,
} from 'lucide-react'
import { publicApi } from '@/api/endpoints'

// ── Constants ──────────────────────────────────────────────────────────────────

const COLONY_TYPE_LABELS = {
  bda_scheme:       'BDA Scheme',
  private_approved: 'Private Approved',
  suo_moto:         'SUO-Moto Case',
  pending_layout:   'Pending Layout',
  rejected_layout:  'Rejected Layout',
}

const COLONY_TYPE_COLORS = {
  bda_scheme:       'bg-blue-100 text-blue-800',
  private_approved: 'bg-green-100 text-green-800',
  suo_moto:         'bg-amber-100 text-amber-800',
  pending_layout:   'bg-orange-100 text-orange-800',
  rejected_layout:  'bg-red-100 text-red-800',
}

const ZONES = ['North', 'South', 'East', 'West', 'Central', 'North-East', 'South-East', 'South-West']

const PAGE_SIZE = 20

// ── Component ──────────────────────────────────────────────────────────────────

export default function PublicColoniesPage() {
  const [searchParams, setSearchParams] = useSearchParams()

  const [search,     setSearch]     = useState(searchParams.get('search') ?? '')
  const [colonyType, setColonyType] = useState(searchParams.get('colony_type') ?? '')
  const [zone,       setZone]       = useState(searchParams.get('zone') ?? '')
  const [page,       setPage]       = useState(1)

  // Keep URL in sync with filters
  useEffect(() => {
    const p = {}
    if (search)     p.search      = search
    if (colonyType) p.colony_type = colonyType
    if (zone)       p.zone        = zone
    setSearchParams(p, { replace: true })
    setPage(1)
  }, [search, colonyType, zone])   // eslint-disable-line react-hooks/exhaustive-deps

  const { data, isLoading, isError } = useQuery({
    queryKey: ['public-colonies', search, colonyType, zone, page],
    queryFn:  () => publicApi.colonyList({
      search:      search || undefined,
      colony_type: colonyType || undefined,
      zone:        zone || undefined,
      page,
      page_size:   PAGE_SIZE,
    }),
    keepPreviousData: true,
    staleTime: 2 * 60 * 1000,
  })

  const colonies  = data?.results ?? []
  const totalCount = data?.count ?? 0
  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  const pageTitle = colonyType
    ? COLONY_TYPE_LABELS[colonyType] ?? 'Colonies'
    : 'All Colonies'

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-5">

      {/* ── Breadcrumb ──────────────────────────────────────────────────── */}
      <nav className="text-sm text-slate-500 mb-5 flex items-center gap-1.5">
        <Link to="/public" className="hover:text-blue-700 transition">Colony Dashboard</Link>
        <span>›</span>
        <span className="text-slate-700 font-medium">{pageTitle}</span>
      </nav>

      {/* ── Title + count ────────────────────────────────────────────────── */}
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{pageTitle}</h1>
          {colonyType && (
            <p className="text-sm text-slate-500 mt-0.5">
              {/* Hindi sub-label */}
              {{
                bda_scheme:       'बीडीए योजनाएँ',
                private_approved: 'निजी अनुमोदित कॉलोनियाँ',
                suo_moto:         'स्वतः संज्ञान कॉलोनी प्रकरण',
                pending_layout:   'लंबित कॉलोनी लेआउट',
                rejected_layout:  'अस्वीकृत कॉलोनी लेआउट',
              }[colonyType]}
            </p>
          )}
        </div>
        {!isLoading && (
          <span className="text-sm text-slate-500">
            {totalCount} {totalCount === 1 ? 'colony' : 'colonies'}
          </span>
        )}
      </div>

      {/* ── Filter bar ──────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6 flex flex-wrap gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search colony name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm
                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Colony type filter */}
        <select
          value={colonyType}
          onChange={(e) => setColonyType(e.target.value)}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-700
                     focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          <option value="">All Types</option>
          {Object.entries(COLONY_TYPE_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>

        {/* Zone filter */}
        <select
          value={zone}
          onChange={(e) => setZone(e.target.value)}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-700
                     focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          <option value="">All Zones</option>
          {ZONES.map((z) => <option key={z} value={z}>{z}</option>)}
        </select>

        {(search || colonyType || zone) && (
          <button
            onClick={() => { setSearch(''); setColonyType(''); setZone('') }}
            className="px-3 py-2 text-sm text-slate-500 hover:text-slate-700 border border-slate-200
                       rounded-lg hover:bg-slate-50 transition"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* ── Colony list ─────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-24 bg-slate-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : isError ? (
        <div className="text-center py-16 text-red-600">
          Failed to load colonies. Please try again later.
        </div>
      ) : colonies.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <Search className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No colonies found</p>
          <p className="text-sm mt-1">Try adjusting your search or filters.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {colonies.map((colony) => (
            <Link
              key={colony.id}
              to={`/public/colonies/${colony.id}`}
              className="block bg-white rounded-xl border border-slate-200 p-5
                         hover:border-blue-300 hover:shadow-sm transition group"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  {/* Name + type badge */}
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <h3 className="font-semibold text-slate-800 group-hover:text-blue-700 transition truncate">
                      {colony.name}
                    </h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${
                      COLONY_TYPE_COLORS[colony.colony_type] ?? 'bg-slate-100 text-slate-700'
                    }`}>
                      {colony.colony_type_label}
                    </span>
                  </div>

                  {/* Meta row */}
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-slate-500">
                    {colony.zone && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" /> {colony.zone} Zone
                      </span>
                    )}
                    {colony.layout_approval_date && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" /> Approved: {colony.layout_approval_date}
                      </span>
                    )}
                    {colony.layout_application_date && !colony.layout_approval_date && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" /> Applied: {colony.layout_application_date}
                      </span>
                    )}
                    {colony.total_plots > 0 && (
                      <span className="flex items-center gap-1">
                        <FileText className="w-3.5 h-3.5" /> {colony.total_plots} plots
                      </span>
                    )}
                  </div>
                </div>

                {/* Map badge */}
                {colony.has_map && (
                  <div className="flex-shrink-0 flex items-center gap-1 text-xs text-blue-700
                                  bg-blue-50 border border-blue-200 px-2.5 py-1.5 rounded-lg">
                    <Download className="w-3.5 h-3.5" />
                    Map available
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* ── Pagination ──────────────────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-200">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="flex items-center gap-1 px-3 py-1.5 text-sm border border-slate-200
                       rounded-lg disabled:opacity-40 hover:bg-slate-50 transition"
          >
            <ChevronLeft className="w-4 h-4" /> Previous
          </button>

          <span className="text-sm text-slate-500">
            Page {page} of {totalPages}
          </span>

          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="flex items-center gap-1 px-3 py-1.5 text-sm border border-slate-200
                       rounded-lg disabled:opacity-40 hover:bg-slate-50 transition"
          >
            Next <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  )
}

/**
 * PublicDashboardPage — unauthenticated landing page.
 *
 * Displays the 5 colony category cards, each linking to a filtered list.
 * Also shows a search bar that jumps to the "all" list with a query.
 */

import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Search, ArrowRight, Building2, CheckCircle2, AlertCircle, Clock, XCircle } from 'lucide-react'
import { publicApi } from '@/api/endpoints'

// ── Category metadata ──────────────────────────────────────────────────────────

const CATEGORIES = [
  {
    value:       'bda_scheme',
    label:       'BDA Schemes',
    labelHi:     'बीडीए योजनाएँ',
    description: 'Residential and commercial colonies developed directly by the Bharatpur Development Authority.',
    icon:        Building2,
    color:       'blue',
    bg:          'bg-blue-50',
    border:      'border-blue-200',
    iconBg:      'bg-blue-100',
    iconColor:   'text-blue-700',
    badge:       'bg-blue-100 text-blue-800',
    hover:       'hover:border-blue-400 hover:bg-blue-50',
  },
  {
    value:       'private_approved',
    label:       'Private Approved Colonies',
    labelHi:     'निजी अनुमोदित कॉलोनियाँ',
    description: 'Privately developed colonies that have received formal layout approval from BDA.',
    icon:        CheckCircle2,
    color:       'green',
    bg:          'bg-green-50',
    border:      'border-green-200',
    iconBg:      'bg-green-100',
    iconColor:   'text-green-700',
    badge:       'bg-green-100 text-green-800',
    hover:       'hover:border-green-400 hover:bg-green-50',
  },
  {
    value:       'suo_moto',
    label:       'SUO-Moto Colony Cases',
    labelHi:     'स्वतः संज्ञान कॉलोनी प्रकरण',
    description: 'Colonies taken up suo-moto by BDA under the Rajasthan Urban Development Authority Act.',
    icon:        AlertCircle,
    color:       'amber',
    bg:          'bg-amber-50',
    border:      'border-amber-200',
    iconBg:      'bg-amber-100',
    iconColor:   'text-amber-700',
    badge:       'bg-amber-100 text-amber-800',
    hover:       'hover:border-amber-400 hover:bg-amber-50',
  },
  {
    value:       'pending_layout',
    label:       'Pending Colony Layouts',
    labelHi:     'लंबित कॉलोनी लेआउट',
    description: 'Layout plans submitted for approval that are currently under review or pending decision.',
    icon:        Clock,
    color:       'orange',
    bg:          'bg-orange-50',
    border:      'border-orange-200',
    iconBg:      'bg-orange-100',
    iconColor:   'text-orange-700',
    badge:       'bg-orange-100 text-orange-800',
    hover:       'hover:border-orange-400 hover:bg-orange-50',
  },
  {
    value:       'rejected_layout',
    label:       'Rejected Colony Layouts',
    labelHi:     'अस्वीकृत कॉलोनी लेआउट',
    description: 'Layout plans that have been formally rejected by BDA. Rejection reasons are available.',
    icon:        XCircle,
    color:       'red',
    bg:          'bg-red-50',
    border:      'border-red-200',
    iconBg:      'bg-red-100',
    iconColor:   'text-red-700',
    badge:       'bg-red-100 text-red-800',
    hover:       'hover:border-red-400 hover:bg-red-50',
  },
]

// ── Component ──────────────────────────────────────────────────────────────────

export default function PublicDashboardPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')

  // Fetch a summary count per colony_type
  const { data: countData } = useQuery({
    queryKey: ['public-colony-counts'],
    queryFn: async () => {
      // Fetch all pages collapsed into counts by type
      const results = {}
      await Promise.all(
        CATEGORIES.map(async (cat) => {
          const res = await publicApi.colonyList({ colony_type: cat.value, page_size: 1 })
          results[cat.value] = res.count ?? 0
        })
      )
      return results
    },
    staleTime: 5 * 60 * 1000,
  })

  const handleSearch = (e) => {
    e.preventDefault()
    if (search.trim()) {
      navigate(`/public/colonies?search=${encodeURIComponent(search.trim())}`)
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold text-slate-800 mb-2">
          Colony Information Dashboard
        </h1>
        <p className="text-slate-500 text-base mb-1">
          Bharatpur Development Authority — Public Land Management Records
        </p>
        <p className="text-slate-400 text-sm">
          भरतपुर विकास प्राधिकरण — सार्वजनिक भूमि प्रबंधन अभिलेख
        </p>
      </div>

      {/* ── Search bar ───────────────────────────────────────────────────── */}
      <form onSubmit={handleSearch} className="max-w-lg mx-auto mb-10">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search colony name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg text-sm
                         focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2.5 bg-blue-700 text-white text-sm font-medium rounded-lg
                       hover:bg-blue-800 transition"
          >
            Search
          </button>
        </div>
      </form>

      {/* ── Category cards ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {CATEGORIES.map((cat) => {
          const Icon  = cat.icon
          const count = countData?.[cat.value]

          return (
            <Link
              key={cat.value}
              to={`/public/colonies?colony_type=${cat.value}`}
              className={`group block rounded-xl border-2 ${cat.border} bg-white p-6
                          transition ${cat.hover} shadow-sm hover:shadow-md`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`w-12 h-12 ${cat.iconBg} rounded-xl flex items-center justify-center`}>
                  <Icon className={`w-6 h-6 ${cat.iconColor}`} />
                </div>
                {count !== undefined && (
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${cat.badge}`}>
                    {count} {count === 1 ? 'colony' : 'colonies'}
                  </span>
                )}
              </div>

              <h2 className="font-bold text-slate-800 text-base mb-0.5 group-hover:text-blue-800 transition">
                {cat.label}
              </h2>
              <p className="text-xs text-slate-500 mb-3">{cat.labelHi}</p>
              <p className="text-sm text-slate-600 leading-relaxed mb-4">
                {cat.description}
              </p>

              <div className={`flex items-center gap-1 text-sm font-medium ${cat.iconColor} group-hover:gap-2 transition-all`}>
                View colonies
                <ArrowRight className="w-4 h-4" />
              </div>
            </Link>
          )
        })}

        {/* "All Colonies" card */}
        <Link
          to="/public/colonies"
          className="group block rounded-xl border-2 border-slate-200 bg-white p-6
                     transition hover:border-slate-400 hover:bg-slate-50 shadow-sm hover:shadow-md"
        >
          <div className="flex items-start justify-between mb-4">
            <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
            </div>
          </div>
          <h2 className="font-bold text-slate-800 text-base mb-0.5 group-hover:text-slate-900 transition">
            All Colonies
          </h2>
          <p className="text-xs text-slate-500 mb-3">सभी कॉलोनियाँ</p>
          <p className="text-sm text-slate-600 leading-relaxed mb-4">
            Browse the complete list of all registered colonies across all categories and zones.
          </p>
          <div className="flex items-center gap-1 text-sm font-medium text-slate-600 group-hover:gap-2 transition-all">
            View all
            <ArrowRight className="w-4 h-4" />
          </div>
        </Link>
      </div>

      {/* ── Info banner ──────────────────────────────────────────────────── */}
      <div className="mt-10 bg-blue-50 border border-blue-200 rounded-xl px-6 py-4 text-sm text-blue-800 flex gap-3">
        <svg className="w-5 h-5 flex-shrink-0 mt-0.5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p>
          This is a public information portal. Colony layout maps are available for download where uploaded.
          For official patta records and plot allocations, please visit the BDA office or contact the Land Management department.
        </p>
      </div>
    </div>
  )
}

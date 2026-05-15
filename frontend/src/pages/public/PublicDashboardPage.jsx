/**
 * PublicDashboardPage — modernised landing page for the public portal.
 *
 * Layout (top-to-bottom):
 *   1. Hero band — title, subhead, two CTAs, trust pills, GIS-style
 *      abstract SVG decoration on the right.
 *   2. Category grid — five colony-type cards with animated counts,
 *      colored accent bar, descriptor text, and a hover-lift.
 *   3. Insight strip — three side-by-side panels:
 *        · Recently Updated Layouts  (pulled live from /public/colonies/)
 *        · Public Notifications      (static placeholder for now)
 *        · Popular Searches          (deep-links into the filter bar)
 *   4. GIS Capabilities band — light info card describing the GIS
 *      layers available on the portal (no data needed).
 *
 * Visual language: very light slate-50 page, soft blue accents, no
 * heavy gradients, no glass, no oversized animation. Movement is limited
 * to staggered fade-up on mount and 200ms hover elevations.
 */

import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowRight, MapPinned, ShieldCheck, BadgeCheck, Eye, Activity,
  Bell, Search, Clock, ChevronRight, MapPin,
} from 'lucide-react'

import { publicApi } from '@/api/endpoints'
import { CATEGORIES } from '@/components/public/categories'
import { useCountUp } from '@/hooks/useCountUp'
import { Backdrop } from '@/components/ui/Backdrop'

// ── Static content ────────────────────────────────────────────────────────────

const TRUST_INDICATORS = [
  { icon: MapPinned,   label: 'GIS Enabled'            },
  { icon: BadgeCheck,  label: 'Verified Records'       },
  { icon: Eye,         label: 'Public Transparency'    },
  { icon: Activity,    label: 'Real-time Updates'      },
]

const POPULAR_SEARCHES = [
  { label: 'Approved BDA Schemes',      q: { colony_type: 'bda_scheme'       } },
  { label: 'Khasra wise list',          q: {}                                  },
  { label: 'Rejected Layouts',          q: { colony_type: 'rejected_layout'  } },
  { label: 'Layouts under Review',      q: { colony_type: 'pending_layout'   } },
  { label: 'Regularized Colonies',      q: { colony_type: 'suo_moto'         } },
]

// Notification feed is a static placeholder until we wire a real source.
// Kept here so the component layout reflects the final shape.
const NOTIFICATIONS = [
  {
    title: 'New layout approval workflow live',
    body:  'Approval timeline is now visible on every colony detail page.',
    when:  'Today',
  },
  {
    title: 'Khasra-wise rejection reasons published',
    body:  '100 rejected layouts now have public-facing reason text.',
    when:  '2 days ago',
  },
  {
    title: 'Map downloads available',
    body:  'PDF / JPEG / PNG layout maps available per colony.',
    when:  '1 week ago',
  },
]

// Motion presets — restrained, government-portal-appropriate timings.
const fadeUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] },
}
const staggerParent = {
  initial: {},
  animate: { transition: { staggerChildren: 0.06 } },
}

// Color helpers per category — short hex codes for the accent rail.
const ACCENT = {
  blue:    'before:bg-blue-500',
  emerald: 'before:bg-emerald-500',
  orange:  'before:bg-orange-500',
  amber:   'before:bg-amber-500',
  red:     'before:bg-red-500',
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PublicDashboardPage() {

  // Aggregate counts per category — one query, five small page_size=1 hits.
  const { data: counts, isLoading } = useQuery({
    queryKey: ['public-colony-counts'],
    queryFn: async () => {
      const out = {}
      await Promise.all(
        CATEGORIES.map(async (cat) => {
          const r = await publicApi.colonyList({ colony_type: cat.value, page_size: 1 })
          out[cat.value] = r.count ?? 0
        }),
      )
      out._total = Object.values(out).reduce((a, b) => a + b, 0)
      return out
    },
    staleTime: 5 * 60 * 1000,
  })

  // Recently updated colonies — feeds the insight strip.
  const { data: recent } = useQuery({
    queryKey: ['public-recent-colonies'],
    queryFn: () => publicApi.colonyList({ ordering: '-id', page_size: 5 }),
    staleTime: 5 * 60 * 1000,
  })

  const total       = counts?._total
  const animTotal   = useCountUp(total ?? 0)

  return (
    <div className="bg-slate-50">

      {/* ───────────── HERO + CATEGORY CARDS (single above-the-fold band) ─────────────
          The category cards used to live in their own section below the
          hero, which pushed them off-screen on a 768-tall viewport. Merge
          the two: compact hero copy on top, cards on the same backdrop
          band immediately below so the five categories are visible
          without scrolling.                                                          */}

      <section className="relative overflow-hidden border-b border-slate-200">
        <Backdrop />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">

          {/* Top band — heading + CTAs on the left, compact GIS-themed
              illustration on the right (lg+ only, decorative). */}
          <div className="grid lg:grid-cols-[1fr,260px] gap-4 lg:gap-8 items-center mb-5">
            <motion.div {...fadeUp} className="min-w-0">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full
                              bg-blue-700/5 border border-blue-700/15 text-blue-700
                              text-[11px] font-semibold uppercase tracking-[0.16em] mb-3">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-700" />
                Bharatpur Development Authority
              </div>

              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight
                             text-[#0F172A] leading-[1.15] mb-1.5">
                Land &amp; Scheme
                <span className="text-blue-700"> Information Portal</span>
              </h1>

              <p className="text-sm text-slate-500 leading-relaxed mb-3">
                Public access for approved layouts, khasra and plot information.
                <span className="block text-xs text-slate-400 mt-0.5">
                  भू-अभिलेख और कॉलोनी सूचना के लिए आधिकारिक सरकारी पोर्टल।
                </span>
              </p>

              <div className="flex flex-wrap items-center gap-2">
                <Link
                  to="/public/colonies"
                  className="group relative inline-flex items-center gap-2 px-4 py-2.5
                             bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold
                             rounded-lg shadow-[0_1px_2px_rgba(0,0,0,0.06),0_8px_24px_-12px_rgba(29,78,216,0.55)]
                             transition-all duration-200"
                >
                  Explore Colonies
                  <ArrowRight className="w-4 h-4 transition group-hover:translate-x-0.5" />
                </Link>
                <Link
                  to="/public/colonies?has_map=true"
                  className="inline-flex items-center gap-2 px-4 py-2.5
                             bg-white text-slate-700 hover:text-blue-800
                             text-sm font-semibold rounded-lg border border-slate-300
                             hover:border-blue-300 hover:bg-blue-50/40 transition"
                >
                  <MapPinned className="w-4 h-4 text-slate-500" />
                  GIS Maps
                </Link>
              </div>
            </motion.div>

            {/* Compact decorative illustration — hidden on small screens
                so it doesn't push the cards below the fold. */}
            <motion.div {...fadeUp} className="hidden lg:block">
              <HeroIllustration total={animTotal} loading={isLoading} />
            </motion.div>
          </div>

          {/* Section heading for the cards */}
          <div className="flex items-end justify-between mb-3">
            <div>
              <h2 className="text-sm sm:text-base font-semibold text-[#0F172A] tracking-tight">
                Browse by category
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Filter colonies by their layout-approval status.
                {total != null && (
                  <span className="ml-1 text-slate-400">· {animTotal} total</span>
                )}
              </p>
            </div>
            <Link
              to="/public/colonies"
              className="hidden sm:inline-flex items-center gap-1 text-xs font-medium
                         text-blue-700 hover:text-blue-900 transition"
            >
              View all
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Category cards — same five, just in the same band as the hero */}
          <motion.div
            {...staggerParent}
            initial="initial" animate="animate"
            className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3"
          >
            {CATEGORIES.map((cat) => (
              <motion.div key={cat.value} variants={fadeUp}>
                <CategoryCard cat={cat} count={counts?.[cat.value]} />
              </motion.div>
            ))}
          </motion.div>

          {/* Trust indicators — kept as a slim footer row inside the band */}
          <motion.div
            {...staggerParent}
            initial="initial" animate="animate"
            className="flex flex-wrap gap-x-5 gap-y-1 mt-5 pt-4 border-t border-slate-200/70"
          >
            {TRUST_INDICATORS.map(({ icon: Icon, label }) => (
              <motion.span
                key={label}
                variants={fadeUp}
                className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-500"
              >
                <Icon className="w-3 h-3 text-blue-700" strokeWidth={2.25} />
                {label}
              </motion.span>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ─────────────────────────── INSIGHT STRIP ─────────────────────────── */}

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 sm:pt-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

          {/* Recently updated layouts */}
          <Panel
            title="Recently Updated Layouts"
            icon={Clock}
            footer={
              <Link to="/public/colonies" className="text-xs font-medium text-blue-700 hover:text-blue-900">
                View all colonies →
              </Link>
            }
          >
            {(recent?.results ?? []).slice(0, 5).map((c) => (
              <Link
                key={c.id}
                to={`/public/colonies/${c.id}`}
                className="flex items-start gap-2 py-2 border-b border-slate-100 last:border-b-0
                           hover:bg-slate-50 -mx-2 px-2 rounded transition"
              >
                <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <div className="text-sm text-slate-800 truncate">{c.name}</div>
                  <div className="text-[11px] text-slate-400 truncate">
                    {c.colony_type_label || c.zone || '—'}
                  </div>
                </div>
              </Link>
            ))}
            {!recent && (
              <div className="text-xs text-slate-400 py-2">Loading…</div>
            )}
          </Panel>

          {/* Public notifications */}
          <Panel title="Public Notifications" icon={Bell}>
            {NOTIFICATIONS.map((n, i) => (
              <div key={i} className="py-2 border-b border-slate-100 last:border-b-0">
                <div className="flex items-baseline justify-between gap-2">
                  <div className="text-sm font-medium text-slate-800 truncate">
                    {n.title}
                  </div>
                  <div className="text-[10px] text-slate-400 whitespace-nowrap">{n.when}</div>
                </div>
                <div className="text-xs text-slate-500 mt-0.5 leading-snug">{n.body}</div>
              </div>
            ))}
          </Panel>

          {/* Popular searches */}
          <Panel title="Popular Searches" icon={Search}>
            <div className="flex flex-wrap gap-1.5">
              {POPULAR_SEARCHES.map((s) => {
                const qs = new URLSearchParams(s.q).toString()
                return (
                  <Link
                    key={s.label}
                    to={`/public/colonies${qs ? `?${qs}` : ''}`}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1
                               text-xs font-medium text-slate-700
                               bg-slate-50 hover:bg-blue-50 hover:text-blue-800
                               border border-slate-200 hover:border-blue-200
                               rounded-full transition"
                  >
                    {s.label}
                  </Link>
                )
              })}
            </div>
          </Panel>
        </div>
      </section>

      {/* GIS Capabilities section removed per portal copy refresh — the
          layers list duplicated info that was already conveyed by the
          map availability indicator on each colony row and added noise
          to the dashboard. */}

      <div className="pb-12 sm:pb-16" />

    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

/**
 * Category card — left accent rail, icon, title, descriptor, animated count.
 * Hover lifts the card 1px and tints the rail.
 */
function CategoryCard({ cat, count }) {
  const animCount = useCountUp(count ?? 0)
  const Icon = cat.icon
  const accent = ACCENT[cat.color] ?? 'before:bg-slate-400'

  return (
    <Link
      to={`/public/colonies?colony_type=${cat.value}`}
      className={`relative block bg-white rounded-xl border ${cat.border}
                  p-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]
                  transition-all duration-200
                  hover:shadow-[0_4px_16px_-6px_rgba(15,23,42,0.10)]
                  hover:-translate-y-0.5 overflow-hidden
                  before:absolute before:left-0 before:top-2 before:bottom-2
                  before:w-[3px] before:rounded-r-full ${accent}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className={`w-8 h-8 rounded-lg ${cat.tint} flex items-center justify-center flex-shrink-0`}>
          <Icon className={`w-4 h-4 ${cat.text}`} strokeWidth={2} />
        </div>
        <div className="flex items-baseline gap-1 ml-auto">
          <span className="text-xl font-bold text-[#0F172A] tabular-nums leading-none">
            {count == null ? '—' : animCount}
          </span>
        </div>
      </div>

      <h3 className="font-semibold text-slate-900 text-sm leading-snug mt-2.5">{cat.label}</h3>
      <p className="text-[11px] text-slate-500 leading-snug mt-0.5 line-clamp-2">
        {cat.description}
      </p>
    </Link>
  )
}

function Panel({ title, icon: Icon, children, footer }) {
  return (
    <motion.div
      {...fadeUp}
      className="rounded-xl bg-white border border-slate-200 p-5
                 shadow-[0_1px_2px_rgba(15,23,42,0.03)]"
    >
      <div className="flex items-center gap-2 mb-3">
        <span className="w-7 h-7 rounded-md bg-blue-50 text-blue-700
                         inline-flex items-center justify-center">
          <Icon className="w-3.5 h-3.5" strokeWidth={2.25} />
        </span>
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      </div>
      <div className="space-y-0">{children}</div>
      {footer && <div className="mt-3 pt-3 border-t border-slate-100">{footer}</div>}
    </motion.div>
  )
}

/**
 * HeroIllustration — abstract GIS-themed SVG for the hero column.
 * Coordinate-grid base + four hand-drawn parcel polygons + a compass-
 * style ring centred over the live colony total. Pure inline SVG, no
 * images. Sized to fit the 260px hero grid column.
 */
function HeroIllustration({ total, loading }) {
  return (
    <div className="relative aspect-[5/4] w-full max-w-[260px] ml-auto">
      <svg viewBox="0 0 520 416" className="absolute inset-0 w-full h-full">
        <defs>
          <linearGradient id="parcel-a" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%"  stopColor="#1D4ED8" stopOpacity="0.10" />
            <stop offset="100%" stopColor="#1D4ED8" stopOpacity="0.04" />
          </linearGradient>
          <linearGradient id="parcel-b" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%"  stopColor="#0EA5E9" stopOpacity="0.10" />
            <stop offset="100%" stopColor="#0EA5E9" stopOpacity="0.04" />
          </linearGradient>
          <linearGradient id="ring" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"  stopColor="#1D4ED8" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#1D4ED8" stopOpacity="0.2" />
          </linearGradient>
        </defs>

        {/* Coordinate grid */}
        <g stroke="#1D4ED8" strokeOpacity="0.08" strokeWidth="1">
          {Array.from({ length: 13 }).map((_, i) => (
            <line key={`v${i}`} x1={i * 40} y1="0" x2={i * 40} y2="416" />
          ))}
          {Array.from({ length: 11 }).map((_, i) => (
            <line key={`h${i}`} x1="0" y1={i * 40} x2="520" y2={i * 40} />
          ))}
        </g>

        {/* Abstract parcels (land polygons) */}
        <g>
          <polygon
            points="60,80 220,60 250,180 80,200"
            fill="url(#parcel-a)" stroke="#1D4ED8" strokeOpacity="0.35" strokeWidth="1.25"
          />
          <polygon
            points="280,40 440,90 420,210 270,180"
            fill="url(#parcel-b)" stroke="#0EA5E9" strokeOpacity="0.35" strokeWidth="1.25"
          />
          <polygon
            points="80,250 260,235 290,360 110,380"
            fill="url(#parcel-a)" stroke="#1D4ED8" strokeOpacity="0.35" strokeWidth="1.25"
          />
          <polygon
            points="320,240 470,250 460,370 310,360"
            fill="url(#parcel-b)" stroke="#0EA5E9" strokeOpacity="0.35" strokeWidth="1.25"
          />
        </g>

        {/* Center compass ring */}
        <g transform="translate(260 208)">
          <circle r="74" fill="white" stroke="url(#ring)" strokeWidth="1.5" />
          <circle r="60" fill="white" stroke="#1D4ED8" strokeOpacity="0.18" strokeDasharray="2 4" />
          <circle r="3"  fill="#1D4ED8" />
          {[0, 90, 180, 270].map((deg) => (
            <line
              key={deg} x1="0" y1="-74" x2="0" y2="-68"
              stroke="#1D4ED8" strokeOpacity="0.5" strokeWidth="2"
              transform={`rotate(${deg})`}
            />
          ))}
        </g>
      </svg>

      {/* Total count text — HTML on top of the SVG so the font stays crisp */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
        <div className="text-[9px] uppercase tracking-[0.18em] text-blue-700/70 font-semibold">
          Total
        </div>
        <div className="text-2xl font-bold text-[#0F172A] tabular-nums leading-tight mt-0.5">
          {loading ? '—' : total}
        </div>
        <div className="text-[9px] text-slate-500 mt-0.5">colonies</div>
      </div>
    </div>
  )
}

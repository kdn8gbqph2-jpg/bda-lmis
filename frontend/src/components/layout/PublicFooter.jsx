/**
 * PublicFooter — institutional footer for the public portal.
 *
 * Layout (three columns on lg+, stacked on mobile):
 *   ┌───────────────────────────┬───────────────┬───────────────┐
 *   │  Authority + portal       │  Portal links  │  Help / Contact│
 *   │  identity + tagline       │                │  + last sync   │
 *   └───────────────────────────┴───────────────┴───────────────┘
 *   ┌─────────────────────────────────────────────────────────────┐
 *   │  © year — Designed, Hosted & Maintained by IT Cell, BDA     │
 *   │                                          Follow us + version │
 *   └─────────────────────────────────────────────────────────────┘
 */

import { MapPinned, ShieldCheck, Mail, Clock } from 'lucide-react'
import { Link } from 'react-router-dom'
import pkg from '../../../package.json'

const SOCIALS = [
  {
    id:   'instagram',
    href: 'https://www.instagram.com/bdabharatpurofficial/',
    label: 'Instagram',
    bg:   'bg-gradient-to-br from-yellow-400 via-pink-500 to-purple-600',
    Icon: () => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
           strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
        <rect x="3" y="3" width="18" height="18" rx="5" ry="5"/>
        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
        <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
      </svg>
    ),
  },
  {
    id:   'facebook',
    href: 'https://www.facebook.com/bda.urban.rajasthan.gov.in/',
    label: 'Facebook',
    bg:   'bg-[#1877F2]',
    Icon: () => (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
        <path d="M22 12a10 10 0 1 0-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.51 1.49-3.89 3.78-3.89 1.1 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.78l-.45 2.89h-2.33v6.99A10 10 0 0 0 22 12z"/>
      </svg>
    ),
  },
  {
    id:   'x',
    href: 'https://x.com/Bdabharatpur',
    label: 'X (Twitter)',
    bg:   'bg-black',
    Icon: () => (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z"/>
      </svg>
    ),
  },
]

const APP_VERSION = `v${pkg.version}`
const YEAR        = new Date().getFullYear()

// Build date is set at module load — used for the "Last Synced" line so
// viewers can tell how stale the cached bundle is.
const BUILD_DATE = new Date().toLocaleDateString('en-IN', {
  day: '2-digit', month: 'short', year: 'numeric',
})

export function PublicFooter() {
  return (
    <footer className="mt-12 border-t border-slate-200 bg-white">

      {/* ── Substance row ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 grid gap-8
                      sm:grid-cols-2 lg:grid-cols-[1.4fr,1fr,1fr]">

        {/* Authority + portal identity */}
        <div>
          <div className="flex items-center gap-2.5">
            <img src="/bda-logo.png" alt="BDA" className="w-10 h-10 object-contain" />
            <div className="min-w-0">
              <div className="text-sm font-bold text-[#0F172A] leading-tight">
                Bharatpur Development Authority
              </div>
              <div className="text-[11px] text-blue-700 font-semibold uppercase tracking-wider mt-0.5">
                Land &amp; Scheme Information Portal
              </div>
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-500 leading-relaxed max-w-md">
            Official public-information portal of the Bharatpur Development
            Authority. Lookup colonies, layouts, khasras and patta records
            issued under BDA's jurisdiction.
            <span className="block mt-1 text-slate-400">
              बीडीए के अंतर्गत कॉलोनी, लेआउट, खसरा और पट्टा रिकॉर्ड का सार्वजनिक पोर्टल।
            </span>
          </p>
          <div className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-semibold
                          text-blue-700 bg-blue-50 border border-blue-100
                          px-2.5 py-1 rounded-full">
            <MapPinned className="w-3 h-3" strokeWidth={2.5} />
            GIS-Enabled Public Portal
          </div>
        </div>

        {/* Portal links */}
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-3">
            Portal
          </div>
          <ul className="space-y-1.5 text-sm text-slate-600">
            <li>
              <Link className="hover:text-blue-700 transition" to="/public">
                Dashboard
              </Link>
            </li>
            <li>
              <Link className="hover:text-blue-700 transition" to="/public/colonies">
                Browse Colonies
              </Link>
            </li>
            <li>
              <Link className="hover:text-blue-700 transition" to="/public/colonies?has_map=true">
                GIS Maps
              </Link>
            </li>
            <li>
              <Link className="hover:text-blue-700 transition" to="/login">
                Officer Login
              </Link>
            </li>
          </ul>
        </div>

        {/* Help / contact */}
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-3">
            Help &amp; Contact
          </div>
          <ul className="space-y-2 text-sm text-slate-600">
            <li className="flex items-center gap-2 text-xs">
              <Mail className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
              <a href="mailto:bdabharatpur@rajasthan.gov.in"
                 className="hover:text-blue-700 transition truncate">
                bdabharatpur@rajasthan.gov.in
              </a>
            </li>
            <li className="flex items-start gap-2 text-xs leading-snug text-slate-500">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0 mt-0.5" />
              <span>
                All records are sourced from BDA's office systems; this is a
                public-information mirror, not a transactional service.
              </span>
            </li>
            <li className="flex items-center gap-2 text-xs text-slate-500">
              <Clock className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
              <span>
                Last synced:{' '}
                <span className="font-medium text-slate-700">{BUILD_DATE}</span>
              </span>
            </li>
          </ul>
        </div>
      </div>

      {/* ── Thin legal band ── */}
      <div className="border-t border-slate-100 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3
                        flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="text-xs text-slate-500 leading-relaxed">
            <div>
              © {YEAR} Bharatpur Development Authority, Government of Rajasthan.
              All rights reserved.
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              Designed, Hosted &amp; Maintained by{' '}
              <span className="font-medium text-slate-600">
                IT Cell, Bharatpur Development Authority
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
            <span className="text-[11px] text-slate-500">Follow us</span>
            {SOCIALS.map(({ id, href, label, bg, Icon }) => (
              <a
                key={id}
                href={href}
                target="_blank"
                rel="noreferrer"
                aria-label={label}
                title={label}
                className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-white
                            shadow-sm hover:opacity-90 hover:scale-105 transition ${bg}`}
              >
                <Icon />
              </a>
            ))}
            <span className="text-slate-300">·</span>
            <span className="text-[11px] text-slate-400 tabular-nums">{APP_VERSION}</span>
          </div>
        </div>
      </div>
    </footer>
  )
}

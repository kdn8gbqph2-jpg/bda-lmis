/**
 * PublicFooter — sits at the bottom of every public portal page.
 *
 * Three brand-coloured social links, copyright with dynamic year, and a
 * small About + app-version line. Icons are inline SVGs so the brand
 * gradients/colours match the official marks without adding image
 * assets or pulling another icon set.
 */

import { Info } from 'lucide-react'
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

export function PublicFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white py-6 px-4 sm:px-6 text-center">
      {/* Socials */}
      <div className="flex items-center justify-center gap-3 mb-3">
        <span className="text-sm text-slate-500">Follow us on</span>
        {SOCIALS.map(({ id, href, label, bg, Icon }) => (
          <a
            key={id}
            href={href}
            target="_blank"
            rel="noreferrer"
            aria-label={label}
            title={label}
            className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-white shadow-sm
                        hover:opacity-90 hover:scale-105 transition ${bg}`}
          >
            <Icon />
          </a>
        ))}
      </div>

      {/* Copyright */}
      <p className="text-sm text-slate-600">
        © {new Date().getFullYear()} Bharatpur Development Authority. All rights reserved.
      </p>

      {/* About + version */}
      <p className="mt-1 text-xs text-slate-400 flex items-center justify-center gap-2">
        <a
          href="/public/about"
          className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800"
        >
          <Info className="w-3 h-3" />
          About
        </a>
        <span className="text-slate-300">·</span>
        <span className="tabular-nums">{APP_VERSION}</span>
      </p>
    </footer>
  )
}

/**
 * Combobox — searchable dropdown for picking one value from a list of
 * `{ value, label }` options. Replaces a native <select> when the list
 * is long enough that scrolling is annoying (≳ 30 entries).
 *
 * The search field supports English → Hindi transliteration (same
 * Google-Input-Tools-style flow as the edit modals' HindiInput) so
 * users can type "OMG" or "अजय" interchangeably to find a colony.
 * The हि/EN preference is shared with HindiInput via the same
 * localStorage key, so toggling it here also toggles it in the modals.
 *
 *   <Combobox
 *     value={colonyId}
 *     onChange={(id) => setColonyId(id)}
 *     options={[{ value: '1', label: 'अजय स्टेडियम...' }, ...]}
 *     placeholder="All Colonies"
 *   />
 *
 * Behaviour:
 *   - Click input → opens, lists everything.
 *   - Type → filters by case-insensitive substring on label. When the
 *     हि toggle is on, the active Latin token shows Hindi candidates
 *     in a popover; Space / Enter / 1-5 accepts.
 *   - Click option → selects, closes, clears search text.
 *   - Empty / clear button → resets value to '' (the "all" sentinel).
 *   - Click outside → closes without changing value.
 *   - Keyboard: ↑ / ↓ to navigate options (when no Hindi suggestion is
 *     active), Enter to pick, Esc to close.
 */

import { useEffect, useRef, useState } from 'react'
import { clsx } from 'clsx'
import { ChevronDown, X, Search } from 'lucide-react'
import {
  useTransliterate,
  HindiToggleButton,
  HindiSuggestionPopover,
  loadHindiEnabled,
  saveHindiEnabled,
} from './HindiInput'

// ── Matcher ────────────────────────────────────────────────────────────────
//
// Strips punctuation and lowercases so "ओ.एम.जी." matches "ओएमजी" and
// "OMG City" matches "omg-city". Tokenises the query by whitespace and
// requires every token to appear somewhere in the normalised label
// (AND semantics) so "एम जी" finds entries containing both. Ranks by
// the sum of each token's earliest position — labels whose first
// matched token starts close to the left come first.
const PUNCT_RX = /[.,\-_/()[\]{}'"!?:;|]/g

function normalize(s) {
  return (s || '')
    .toLowerCase()
    .replace(PUNCT_RX, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function score(label, query) {
  const nLabel  = normalize(label)
  const nQuery  = normalize(query)
  if (!nQuery) return 0
  const tokens  = nQuery.split(' ').filter(Boolean)
  let total = 0
  for (const t of tokens) {
    const idx = nLabel.indexOf(t)
    if (idx === -1) return -1
    total += idx
  }
  return total
}

function filterAndRank(options, query) {
  const scored = []
  for (const o of options) {
    const s = score(o.label, query)
    if (s >= 0) scored.push({ o, s })
  }
  scored.sort((a, b) => a.s - b.s)
  return scored.map((x) => x.o)
}

export function Combobox({
  value, onChange, options,
  placeholder = 'Select…',
  clearLabel  = 'Clear',
  className,
}) {
  const [open, setOpen]               = useState(false)
  const [query, setQuery]             = useState('')
  const [activeIdx, setActiveIdx]     = useState(0)
  const [hindiOn, setHindiOn]         = useState(loadHindiEnabled)
  const containerRef                  = useRef(null)
  const inputRef                      = useRef(null)
  const listRef                       = useRef(null)

  const selected = options.find((o) => String(o.value) === String(value)) || null

  const filtered = query ? filterAndRank(options, query) : options

  // Transliteration: feeds suggestions for the trailing Latin token in
  // the search text. The hook is wired with a synthetic onChange so we
  // can keep `query` as our state of record.
  const {
    suggestions, highlight, handleKeyDown: handleHindiKey,
    applyReplacement, refresh: refreshHindi, dismiss: dismissHindi,
  } = useTransliterate({
    value: query,
    onChange: (e) => setQuery(e.target.value),
    enabled: hindiOn,
    fieldRef: inputRef,
  })

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const onDoc = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false); setQuery(''); dismissHindi()
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open, dismissHindi])

  useEffect(() => { setActiveIdx(0) }, [query, open])

  useEffect(() => {
    if (!open || !listRef.current) return
    const el = listRef.current.children[activeIdx]
    el?.scrollIntoView({ block: 'nearest' })
  }, [activeIdx, open])

  const pick = (opt) => {
    onChange(opt ? opt.value : '')
    setOpen(false); setQuery(''); dismissHindi()
  }

  const onKey = (e) => {
    // If Hindi suggestions are showing, let the transliteration hook
    // own the navigation keys (↑/↓/Enter/Esc/Space/1-5). It calls
    // preventDefault when it consumes a key, so the option-list keys
    // below stay quiet in that case.
    const hadSuggestions = suggestions.length > 0
    handleHindiKey(e)
    if (e.defaultPrevented) return
    if (hadSuggestions) return

    if (e.key === 'ArrowDown') {
      e.preventDefault(); setOpen(true)
      setActiveIdx((i) => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (filtered[activeIdx]) pick(filtered[activeIdx])
    } else if (e.key === 'Escape') {
      setOpen(false); setQuery('')
    }
  }

  const toggleHindi = () => setHindiOn((v) => { saveHindiEnabled(!v); return !v })

  return (
    <div ref={containerRef} className={clsx('relative', className)}>
      {/* Trigger — looks like Input/Select, behaves like a searchbox once open */}
      <div
        className={clsx(
          'flex items-center gap-2 rounded-lg border border-slate-300 bg-white',
          'pl-3 pr-2 py-2 shadow-xs cursor-text',
          'focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500',
        )}
        onClick={() => { setOpen(true); inputRef.current?.focus() }}
      >
        <Search className="w-4 h-4 text-slate-400 flex-shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={open ? query : (selected?.label || '')}
          placeholder={selected ? selected.label : placeholder}
          onChange={(e) => { setOpen(true); setQuery(e.target.value) }}
          onFocus={() => setOpen(true)}
          onKeyUp={() => refreshHindi()}
          onClick={() => refreshHindi()}
          onKeyDown={onKey}
          onBlur={() => setTimeout(dismissHindi, 120)}
          className="flex-1 min-w-0 bg-transparent text-sm text-slate-900
                     placeholder:text-slate-500 focus:outline-none"
        />
        <HindiToggleButton
          enabled={hindiOn}
          onToggle={toggleHindi}
          className="flex-shrink-0"
        />
        {selected && !open && (
          <button
            type="button"
            onMouseDown={(e) => { e.stopPropagation(); onChange('') }}
            className="text-slate-400 hover:text-slate-700 flex-shrink-0"
            title="Clear"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
        <ChevronDown className={clsx('w-4 h-4 text-slate-400 transition-transform flex-shrink-0',
                                     open && 'rotate-180')} />
      </div>

      {/* Hindi suggestion popover — portal-mounted, positioned to the input */}
      {hindiOn && (
        <HindiSuggestionPopover
          suggestions={suggestions}
          highlight={highlight}
          anchorRef={inputRef}
          onPick={(i) => applyReplacement(suggestions[i])}
        />
      )}

      {/* Option dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white rounded-lg border border-slate-200
                        shadow-lg max-h-72 overflow-y-auto animate-[fadeIn_120ms_ease-out]">
          <button
            type="button"
            onClick={() => pick(null)}
            className={clsx(
              'w-full text-left px-3 py-2 text-sm border-b border-slate-100',
              'hover:bg-slate-50',
              !selected && 'bg-blue-50/50 text-blue-700 font-medium',
            )}
          >
            {clearLabel}
          </button>

          <div ref={listRef}>
            {filtered.length === 0 && (
              <div className="px-3 py-6 text-xs text-slate-400 text-center">
                No matches for &quot;{query}&quot;.
              </div>
            )}
            {filtered.map((opt, i) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => pick(opt)}
                onMouseEnter={() => setActiveIdx(i)}
                className={clsx(
                  'w-full text-left px-3 py-2 text-sm',
                  String(opt.value) === String(value)
                    ? 'bg-blue-50 text-blue-800 font-medium'
                    : i === activeIdx
                      ? 'bg-slate-100 text-slate-900'
                      : 'text-slate-700 hover:bg-slate-50',
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

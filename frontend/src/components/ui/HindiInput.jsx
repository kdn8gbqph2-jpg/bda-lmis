/*
 * HindiInput / HindiTextarea — drop-in replacements for <Input> / <textarea>
 * that add inline English → Hindi transliteration via the backend proxy
 * (Google Input Tools).
 *
 * UX (matches Google Input Tools' web widget):
 *   ─ Type Latin letters; the trailing word is the "active token".
 *   ─ A small popover lists up to 5 Hindi candidates ranked by Google.
 *   ─ Space auto-accepts the top candidate and inserts a space after it.
 *   ─ 1–5 numeric keys pick a specific candidate.
 *   ─ ↑/↓ to highlight, Enter to accept the highlighted candidate.
 *   ─ Esc dismisses the popover; user can keep typing Latin (the field
 *     keeps the raw English token in that case).
 *   ─ A हि/EN pill at the field's top-right toggles the feature; the
 *     preference is persisted per-user in localStorage so the choice
 *     follows them across pages.
 *
 * The component is controlled — parents pass `value` + `onChange(e)` and
 * everything else (label, error, prefix, suffix) is forwarded to the
 * underlying <Input> exactly like before. Wiring into an existing form
 * is a one-line import swap.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { clsx } from 'clsx'
import { transliterate as translitApi } from '@/api/endpoints'

const LS_KEY = 'bda.translit.hi.enabled'
const DEBOUNCE_MS = 120
const MIN_TOKEN_LEN = 1
const TOKEN_REGEX = /[A-Za-z]+$/

function loadEnabled() {
  try {
    const raw = localStorage.getItem(LS_KEY)
    return raw === null ? true : raw === '1'
  } catch { return true }
}
function saveEnabled(v) {
  try { localStorage.setItem(LS_KEY, v ? '1' : '0') } catch { /* ignore */ }
}

/**
 * Returns the Latin token at the end of `text[0..caret]` along with its
 * start offset, or null if the caret is not at the end of a Latin run.
 */
function tokenAtCaret(text, caret) {
  const left = text.slice(0, caret)
  const match = left.match(TOKEN_REGEX)
  if (!match) return null
  return { token: match[0], start: caret - match[0].length, end: caret }
}

/** Shared logic for both the <input> and <textarea> variants. */
function useTransliterate({ value, onChange, enabled, fieldRef }) {
  const [suggestions, setSuggestions] = useState([])
  const [highlight,   setHighlight]   = useState(0)
  const [activeRange, setActiveRange] = useState(null)  // {start,end} of token
  const debounceRef = useRef(null)
  const reqIdRef    = useRef(0)

  const dismiss = useCallback(() => {
    setSuggestions([])
    setActiveRange(null)
    setHighlight(0)
  }, [])

  // Recompute the active token whenever the value or caret moves.
  const refresh = useCallback(() => {
    if (!enabled) { dismiss(); return }
    const el = fieldRef.current
    if (!el) return
    const caret = el.selectionStart ?? 0
    // Only fire when selectionStart === selectionEnd (no active selection).
    if (caret !== (el.selectionEnd ?? 0)) { dismiss(); return }

    const tok = tokenAtCaret(value ?? '', caret)
    if (!tok || tok.token.length < MIN_TOKEN_LEN) { dismiss(); return }

    setActiveRange({ start: tok.start, end: tok.end })

    if (debounceRef.current) clearTimeout(debounceRef.current)
    const myId = ++reqIdRef.current
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await translitApi.hi(tok.token)
        if (myId !== reqIdRef.current) return  // stale
        const list = Array.isArray(res?.suggestions) ? res.suggestions : []
        setSuggestions(list)
        setHighlight(0)
      } catch {
        // Network error → silently fall back to no suggestions.
        if (myId === reqIdRef.current) setSuggestions([])
      }
    }, DEBOUNCE_MS)
  }, [value, enabled, fieldRef, dismiss])

  useEffect(() => { refresh() /* eslint-disable-next-line */ }, [value, enabled])
  useEffect(() => () => debounceRef.current && clearTimeout(debounceRef.current), [])

  /** Replace [start,end) with `replacement`, optionally append a trailing char. */
  const applyReplacement = useCallback((replacement, trailing = '') => {
    const el = fieldRef.current
    if (!el || !activeRange) return
    const before = (value ?? '').slice(0, activeRange.start)
    const after  = (value ?? '').slice(activeRange.end)
    const next   = before + replacement + trailing + after
    const newCaret = (before + replacement + trailing).length
    onChange({ target: { value: next } })
    // Restore caret on the next tick after React re-renders.
    requestAnimationFrame(() => {
      if (fieldRef.current) {
        try { fieldRef.current.setSelectionRange(newCaret, newCaret) } catch { /* ignore */ }
      }
    })
    dismiss()
  }, [value, onChange, activeRange, fieldRef, dismiss])

  const handleKeyDown = useCallback((e) => {
    if (!enabled || !suggestions.length || !activeRange) return
    if (e.key === 'Escape') { e.preventDefault(); dismiss(); return }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight((h) => (h + 1) % suggestions.length); return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight((h) => (h - 1 + suggestions.length) % suggestions.length); return
    }
    if (e.key === 'Enter' || e.key === 'Tab') {
      // Accept the highlighted candidate without injecting a trailing char.
      e.preventDefault()
      applyReplacement(suggestions[highlight] ?? suggestions[0]); return
    }
    if (e.key === ' ' || e.key === 'Spacebar') {
      // Accept top suggestion + keep the space the user just pressed.
      e.preventDefault()
      applyReplacement(suggestions[highlight] ?? suggestions[0], ' '); return
    }
    if (/^[1-5]$/.test(e.key)) {
      const idx = Number(e.key) - 1
      if (idx < suggestions.length) {
        e.preventDefault()
        applyReplacement(suggestions[idx]); return
      }
    }
  }, [enabled, suggestions, activeRange, highlight, applyReplacement, dismiss])

  return { suggestions, highlight, activeRange, handleKeyDown, dismiss, applyReplacement, refresh }
}

function ToggleButton({ enabled, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      title={enabled ? 'Hindi typing on — click for English' : 'English mode — click for Hindi'}
      className={clsx(
        'absolute right-2 top-2 text-[10px] font-semibold px-1.5 py-0.5 rounded',
        'border transition select-none',
        enabled
          ? 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100'
          : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100',
      )}
    >
      {enabled ? 'हि' : 'EN'}
    </button>
  )
}

function SuggestionPopover({ suggestions, highlight, onPick }) {
  if (!suggestions.length) return null
  return (
    <div className="absolute left-0 top-full mt-1 z-30 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden min-w-[160px]">
      {suggestions.map((s, i) => (
        <button
          type="button"
          key={`${s}-${i}`}
          onMouseDown={(e) => { e.preventDefault(); onPick(i) }}
          className={clsx(
            'flex items-center gap-2 w-full px-2.5 py-1.5 text-left text-sm',
            i === highlight ? 'bg-blue-50 text-blue-900' : 'text-slate-800 hover:bg-slate-50',
          )}
        >
          <span className="text-[10px] font-mono text-slate-400 w-3">{i + 1}</span>
          <span className="font-medium">{s}</span>
        </button>
      ))}
      <div className="px-2.5 py-1 bg-slate-50 border-t border-slate-100 text-[10px] text-slate-400">
        Space · 1–5 · Esc to dismiss
      </div>
    </div>
  )
}

// ── <HindiInput> ─────────────────────────────────────────────────────────────

export function HindiInput({
  label, error, className, value, onChange, ...props
}) {
  const fieldRef = useRef(null)
  const [enabled, setEnabled] = useState(loadEnabled)
  const [, force] = useState(0)
  const { suggestions, highlight, handleKeyDown, applyReplacement, refresh, dismiss } =
    useTransliterate({ value, onChange, enabled, fieldRef })

  const toggle = () => setEnabled((v) => { saveEnabled(!v); return !v })

  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-sm font-medium text-slate-700">{label}</label>}
      <div className="relative">
        <input
          ref={fieldRef}
          value={value ?? ''}
          onChange={(e) => { onChange(e); force((n) => n + 1) }}
          onKeyUp={() => refresh()}
          onClick={() => refresh()}
          onKeyDown={handleKeyDown}
          onBlur={() => setTimeout(dismiss, 120)}
          className={clsx(
            'w-full rounded-lg border border-slate-300 bg-white text-sm text-slate-900',
            'placeholder:text-slate-400 shadow-xs',
            'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
            'disabled:bg-slate-50 disabled:text-slate-500',
            'pl-3 pr-10 py-2',
            error && 'border-red-400 focus:ring-red-400',
            className,
          )}
          {...props}
        />
        <ToggleButton enabled={enabled} onToggle={toggle} />
        {enabled && (
          <SuggestionPopover
            suggestions={suggestions}
            highlight={highlight}
            onPick={(i) => applyReplacement(suggestions[i])}
          />
        )}
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}

// ── <HindiTextarea> ──────────────────────────────────────────────────────────

export function HindiTextarea({
  label, error, className, value, onChange, rows = 3, ...props
}) {
  const fieldRef = useRef(null)
  const [enabled, setEnabled] = useState(loadEnabled)
  const [, force] = useState(0)
  const { suggestions, highlight, handleKeyDown, applyReplacement, refresh, dismiss } =
    useTransliterate({ value, onChange, enabled, fieldRef })

  const toggle = () => setEnabled((v) => { saveEnabled(!v); return !v })

  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-sm font-medium text-slate-700">{label}</label>}
      <div className="relative">
        <textarea
          ref={fieldRef}
          value={value ?? ''}
          rows={rows}
          onChange={(e) => { onChange(e); force((n) => n + 1) }}
          onKeyUp={() => refresh()}
          onClick={() => refresh()}
          onKeyDown={handleKeyDown}
          onBlur={() => setTimeout(dismiss, 120)}
          className={clsx(
            'w-full rounded-lg border border-slate-300 bg-white text-sm text-slate-900',
            'placeholder:text-slate-400 shadow-xs resize-y',
            'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
            'disabled:bg-slate-50 disabled:text-slate-500',
            'pl-3 pr-10 py-2',
            error && 'border-red-400 focus:ring-red-400',
            className,
          )}
          {...props}
        />
        <ToggleButton enabled={enabled} onToggle={toggle} />
        {enabled && (
          <SuggestionPopover
            suggestions={suggestions}
            highlight={highlight}
            onPick={(i) => applyReplacement(suggestions[i])}
          />
        )}
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}

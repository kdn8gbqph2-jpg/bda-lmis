/*
 * HindiInput / HindiTextarea — drop-in replacements for <Input> / <textarea>
 * that add inline English → Hindi transliteration via the backend proxy
 * (Google Input Tools).
 *
 * UX (matches Google Input Tools' web widget):
 *   ─ Type Latin letters; the trailing word is the "active token".
 *   ─ A small popover lists up to 5 Hindi candidates ranked by Google.
 *   ─ Space auto-accepts the top candidate and inserts a space after it.
 *     If the user hits Space before the debounced fetch fires, we cancel
 *     the debounce and fetch synchronously so Space still replaces the
 *     token instead of leaking through as a literal space.
 *   ─ 1–5 numeric keys pick a specific candidate.
 *   ─ ↑/↓ to highlight, Enter to accept the highlighted candidate.
 *   ─ Esc dismisses the popover; user can keep typing Latin (the field
 *     keeps the raw English token in that case).
 *   ─ A हि/EN pill at the field's top-right toggles the feature; the
 *     preference is persisted per-user in localStorage so the choice
 *     follows them across pages.
 *
 * The popover renders through a React portal pinned to document.body and
 * positioned with fixed coords from the input's bounding rect, so it can
 * escape `overflow:auto` parents (modals, scrolling forms) without being
 * clipped.
 *
 * The component is controlled — parents pass `value` + `onChange(e)` and
 * everything else (label, error, prefix, suffix) is forwarded to the
 * underlying <input>/<textarea>. Wiring into an existing form is a
 * one-line import swap.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { clsx } from 'clsx'
import { transliterate as translitApi } from '@/api/endpoints'

const LS_KEY = 'bda.translit.hi.enabled'
const DEBOUNCE_MS = 80
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

/** Shared logic for the <input> / <textarea> variants AND the Combobox
 *  search field — exported so any controlled text input can opt in to
 *  English→Hindi transliteration without duplicating this state machine. */
export function useTransliterate({ value, onChange, enabled, fieldRef }) {
  const [suggestions, setSuggestions] = useState([])
  const [highlight,   setHighlight]   = useState(0)
  const [activeRange, setActiveRange] = useState(null)
  const debounceRef = useRef(null)
  const reqIdRef    = useRef(0)
  const cacheRef    = useRef(new Map())   // token → suggestions[] (session cache)

  const dismiss = useCallback(() => {
    setSuggestions([])
    setActiveRange(null)
    setHighlight(0)
    if (debounceRef.current) { clearTimeout(debounceRef.current); debounceRef.current = null }
  }, [])

  /** Hit the API for `token`, caching by token in-memory. */
  const fetchSuggestions = useCallback(async (token) => {
    const hit = cacheRef.current.get(token)
    if (hit) return hit
    try {
      const res = await translitApi.hi(token)
      const list = Array.isArray(res?.suggestions) ? res.suggestions : []
      cacheRef.current.set(token, list)
      return list
    } catch (err) {
      const status = err?.response?.status
      const detail = err?.response?.data?.detail || err?.message || err
      console.warn('[transliterate] request failed', { status, detail, token })
      return []
    }
  }, [])

  /** Compute active token from caret and schedule a debounced fetch. */
  const refresh = useCallback(() => {
    if (!enabled) { dismiss(); return }
    const el = fieldRef.current
    if (!el) return
    const caret = el.selectionStart ?? 0
    if (caret !== (el.selectionEnd ?? 0)) { dismiss(); return }

    const tok = tokenAtCaret(value ?? '', caret)
    if (!tok || tok.token.length < MIN_TOKEN_LEN) { dismiss(); return }

    setActiveRange({ start: tok.start, end: tok.end })

    if (debounceRef.current) clearTimeout(debounceRef.current)
    const myId = ++reqIdRef.current
    debounceRef.current = setTimeout(async () => {
      const list = await fetchSuggestions(tok.token)
      if (myId !== reqIdRef.current) return
      setSuggestions(list)
      setHighlight(0)
    }, DEBOUNCE_MS)
  }, [value, enabled, fieldRef, dismiss, fetchSuggestions])

  useEffect(() => { refresh() /* eslint-disable-next-line */ }, [value, enabled])
  useEffect(() => () => debounceRef.current && clearTimeout(debounceRef.current), [])

  /**
   * Replace [start,end) with `replacement`, optionally append a trailing char.
   * Reads activeRange and the current `value` from the closure so the caller
   * doesn't need to thread them through.
   */
  const applyReplacement = useCallback((replacement, trailing = '', range = null) => {
    const el = fieldRef.current
    const r  = range ?? activeRange
    if (!el || !r) return
    const before = (value ?? '').slice(0, r.start)
    const after  = (value ?? '').slice(r.end)
    const next   = before + replacement + trailing + after
    const newCaret = (before + replacement + trailing).length
    onChange({ target: { value: next } })
    requestAnimationFrame(() => {
      if (fieldRef.current) {
        try { fieldRef.current.setSelectionRange(newCaret, newCaret) } catch { /* ignore */ }
      }
    })
    dismiss()
  }, [value, onChange, activeRange, fieldRef, dismiss])

  const handleKeyDown = useCallback(async (e) => {
    if (!enabled) return

    // Space: auto-accept the top suggestion. If the debounce hasn't
    // fired yet (user typed quickly), fetch synchronously so Space
    // still does the right thing instead of leaking through.
    if (e.key === ' ' || e.key === 'Spacebar') {
      const el = fieldRef.current
      if (!el) return
      const caret = el.selectionStart ?? 0
      if (caret !== (el.selectionEnd ?? 0)) return
      const tok = tokenAtCaret(value ?? '', caret)
      if (!tok || tok.token.length < MIN_TOKEN_LEN) return

      e.preventDefault()
      // Use the live suggestions list when it matches the current token;
      // otherwise fetch now (cancels any in-flight debounce).
      let list = suggestions
      if (debounceRef.current) { clearTimeout(debounceRef.current); debounceRef.current = null }
      const cached = cacheRef.current.get(tok.token)
      if (cached) list = cached
      else if (!list.length || activeRange?.end !== tok.end) {
        list = await fetchSuggestions(tok.token)
      }

      const range = { start: tok.start, end: tok.end }
      if (list.length) {
        applyReplacement(list[highlight] ?? list[0], ' ', range)
      } else {
        // No Hindi candidates — keep the Latin word and append the space.
        applyReplacement(tok.token, ' ', range)
      }
      return
    }

    if (!suggestions.length || !activeRange) return

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
      e.preventDefault()
      applyReplacement(suggestions[highlight] ?? suggestions[0]); return
    }
    if (/^[1-5]$/.test(e.key)) {
      const idx = Number(e.key) - 1
      if (idx < suggestions.length) {
        e.preventDefault()
        applyReplacement(suggestions[idx]); return
      }
    }
  }, [enabled, suggestions, activeRange, highlight,
      applyReplacement, dismiss, fetchSuggestions, value, fieldRef])

  return {
    suggestions, highlight, activeRange,
    handleKeyDown, dismiss, applyReplacement, refresh,
  }
}

// ── UI sub-components ────────────────────────────────────────────────────────

/**
 * Small हि/EN toggle pill. Exported so other inputs (e.g. the colony
 * Combobox search field) can show the same control instead of inventing
 * one. `className` overrides the default absolute-positioned styling for
 * non-rectangular hosts that need a static-flow placement.
 */
export function HindiToggleButton({ enabled, onToggle, className }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      title={enabled ? 'Hindi typing on — click for English' : 'English mode — click for Hindi'}
      className={clsx(
        'text-[10px] font-semibold px-1.5 py-0.5 rounded',
        'border transition select-none',
        enabled
          ? 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100'
          : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100',
        className ?? 'absolute right-2 top-2',
      )}
    >
      {enabled ? 'हि' : 'EN'}
    </button>
  )
}

const ToggleButton = HindiToggleButton

export { loadEnabled as loadHindiEnabled, saveEnabled as saveHindiEnabled }

/**
 * Suggestion popover. Pinned to document.body via a portal and positioned
 * with `fixed` coords so it can escape any `overflow:auto`/`overflow:hidden`
 * ancestor (modal bodies, scrolling forms).
 */
export function HindiSuggestionPopover(props) { return SuggestionPopover(props) }

function SuggestionPopover({ suggestions, highlight, onPick, anchorRef }) {
  const [pos, setPos] = useState(null)
  const popoverRef = useRef(null)

  useLayoutEffect(() => {
    if (!suggestions.length || !anchorRef.current) { setPos(null); return }
    const update = () => {
      const r = anchorRef.current?.getBoundingClientRect()
      if (!r) return
      const popoverH = popoverRef.current?.offsetHeight ?? 200
      const spaceBelow = window.innerHeight - r.bottom
      const placeAbove = spaceBelow < popoverH + 12 && r.top > popoverH + 12
      setPos({
        left:   r.left,
        top:    placeAbove ? r.top - popoverH - 4 : r.bottom + 4,
        minWidth: Math.min(r.width, 240),
      })
    }
    update()
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  }, [suggestions, anchorRef])

  if (!suggestions.length || !pos) return null

  return createPortal(
    <div
      ref={popoverRef}
      style={{ position: 'fixed', left: pos.left, top: pos.top, minWidth: pos.minWidth, zIndex: 9999 }}
      className="bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden"
    >
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
    </div>,
    document.body,
  )
}

// ── <HindiInput> ─────────────────────────────────────────────────────────────

export function HindiInput({
  label, error, className, value, onChange, labelExtra, ...props
}) {
  const fieldRef = useRef(null)
  const [enabled, setEnabled] = useState(loadEnabled)
  const { suggestions, highlight, handleKeyDown, applyReplacement, refresh, dismiss } =
    useTransliterate({ value, onChange, enabled, fieldRef })

  const toggle = () => setEnabled((v) => { saveEnabled(!v); return !v })

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-sm font-medium text-slate-700 flex items-center gap-2 flex-wrap">
          <span>{label}</span>
          {labelExtra}
        </label>
      )}
      <div className="relative">
        <input
          ref={fieldRef}
          value={value ?? ''}
          onChange={onChange}
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
            anchorRef={fieldRef}
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
  label, error, className, value, onChange, rows = 3, labelExtra, ...props
}) {
  const fieldRef = useRef(null)
  const [enabled, setEnabled] = useState(loadEnabled)
  const { suggestions, highlight, handleKeyDown, applyReplacement, refresh, dismiss } =
    useTransliterate({ value, onChange, enabled, fieldRef })

  const toggle = () => setEnabled((v) => { saveEnabled(!v); return !v })

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-sm font-medium text-slate-700 flex items-center gap-2 flex-wrap">
          <span>{label}</span>
          {labelExtra}
        </label>
      )}
      <div className="relative">
        <textarea
          ref={fieldRef}
          value={value ?? ''}
          rows={rows}
          onChange={onChange}
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
            anchorRef={fieldRef}
            onPick={(i) => applyReplacement(suggestions[i])}
          />
        )}
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}

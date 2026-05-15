/**
 * Combobox — searchable dropdown for picking one value from a list of
 * `{ value, label }` options. Replaces a native <select> when the list
 * is long enough that scrolling is annoying (≳ 30 entries).
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
 *   - Type → filters by case-insensitive substring on label.
 *   - Click option → selects, closes, clears search text.
 *   - Empty / clear button → resets value to '' (the "all" sentinel).
 *   - Click outside → closes without changing value.
 *   - Keyboard: ↑ / ↓ to navigate, Enter to pick, Esc to close.
 */

import { useEffect, useRef, useState } from 'react'
import { clsx } from 'clsx'
import { ChevronDown, X, Search } from 'lucide-react'

export function Combobox({
  value, onChange, options,
  placeholder = 'Select…',
  clearLabel  = 'Clear',
  className,
}) {
  const [open, setOpen]               = useState(false)
  const [query, setQuery]             = useState('')
  const [activeIdx, setActiveIdx]     = useState(0)
  const ref     = useRef(null)
  const listRef = useRef(null)

  const selected = options.find((o) => String(o.value) === String(value)) || null

  const filtered = query
    ? options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()))
    : options

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false); setQuery('')
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  // Reset active index when filter changes
  useEffect(() => { setActiveIdx(0) }, [query, open])

  // Keep highlighted row in view
  useEffect(() => {
    if (!open || !listRef.current) return
    const el = listRef.current.children[activeIdx]
    el?.scrollIntoView({ block: 'nearest' })
  }, [activeIdx, open])

  const pick = (opt) => {
    onChange(opt ? opt.value : '')
    setOpen(false); setQuery('')
  }

  const onKey = (e) => {
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

  return (
    <div ref={ref} className={clsx('relative', className)}>
      {/* Trigger — looks like Input/Select, behaves like a searchbox once open */}
      <div
        className={clsx(
          'flex items-center gap-2 rounded-lg border border-slate-300 bg-white',
          'pl-3 pr-2 py-2 shadow-xs cursor-text',
          'focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500',
        )}
        onClick={() => setOpen(true)}
      >
        <Search className="w-4 h-4 text-slate-400 flex-shrink-0" />
        <input
          type="text"
          value={open ? query : (selected?.label || '')}
          placeholder={selected ? selected.label : placeholder}
          onChange={(e) => { setOpen(true); setQuery(e.target.value) }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKey}
          className="flex-1 min-w-0 bg-transparent text-sm text-slate-900
                     placeholder:text-slate-500 focus:outline-none"
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

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white rounded-lg border border-slate-200
                        shadow-lg max-h-72 overflow-y-auto animate-[fadeIn_120ms_ease-out]">
          {/* Always-available "clear" option at the top */}
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

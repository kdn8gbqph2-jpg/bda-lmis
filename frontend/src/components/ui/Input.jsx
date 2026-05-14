import { clsx } from 'clsx'
import { forwardRef } from 'react'

export const Input = forwardRef(function Input({
  label, error, className, prefix, suffix, labelExtra, ...props
}, ref) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-sm font-medium text-slate-700 flex items-center gap-2 flex-wrap">
          <span>{label}</span>
          {labelExtra}
        </label>
      )}
      <div className="relative flex items-center">
        {prefix && (
          <span className="absolute left-3 text-slate-400 pointer-events-none">
            {prefix}
          </span>
        )}
        <input
          ref={ref}
          className={clsx(
            'w-full rounded-lg border border-slate-300 bg-white text-sm text-slate-900',
            'placeholder:text-slate-400 shadow-xs',
            'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
            'disabled:bg-slate-50 disabled:text-slate-500',
            prefix ? 'pl-9' : 'pl-3',
            suffix ? 'pr-9' : 'pr-3',
            'py-2',
            error && 'border-red-400 focus:ring-red-400',
            className
          )}
          {...props}
        />
        {suffix && (
          <span className="absolute right-3 text-slate-400 pointer-events-none">
            {suffix}
          </span>
        )}
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
})

export function Select({ label, error, className, children, labelExtra, ...props }) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-sm font-medium text-slate-700 flex items-center gap-2 flex-wrap">
          <span>{label}</span>
          {labelExtra}
        </label>
      )}
      <select
        className={clsx(
          'w-full rounded-lg border border-slate-300 bg-white text-sm text-slate-900',
          'px-3 py-2 shadow-xs focus:outline-none focus:ring-2 focus:ring-blue-500',
          'focus:border-blue-500 disabled:bg-slate-50',
          error && 'border-red-400',
          className
        )}
        {...props}
      >
        {children}
      </select>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}

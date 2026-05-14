/**
 * Tiny global toast store. One source of truth for transient status
 * messages — currently used for the "Sent for approval" cue that
 * staff users get back from the ChangeRequest queue, but reusable
 * anywhere we want a non-blocking confirmation.
 *
 * The axios client fires `toast.push(...)` automatically on any HTTP
 * 202 response that carries a `change_request_id`, so callers don't
 * need to wire anything per-mutation.
 *
 *   const push = useToastStore((s) => s.push)
 *   push('Sent for approval.', { kind: 'success' })
 *
 * Toasts auto-dismiss after `duration` ms (default 4500). The
 * <ToastViewport /> rendered at the layout root paints them.
 */
import { create } from 'zustand'

let nextId = 1

export const useToastStore = create((set, get) => ({
  toasts: [],
  push: (message, opts = {}) => {
    const id = nextId++
    const t  = {
      id,
      message,
      kind:     opts.kind     ?? 'info',     // info | success | warning | error
      duration: opts.duration ?? 4500,
    }
    set((s) => ({ toasts: [...s.toasts, t] }))
    if (t.duration) setTimeout(() => get().dismiss(id), t.duration)
    return id
  },
  dismiss: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))

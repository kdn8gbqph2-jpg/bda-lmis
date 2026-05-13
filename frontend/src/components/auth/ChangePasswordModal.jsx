/**
 * ChangePasswordModal — opens from anywhere a user is authenticated.
 *
 * Three fields (current / new / confirm), client-side validation for
 * match + min-length, then POST /api/auth/change-password/. Server
 * audits the change automatically.
 */

import { useState, useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Eye, EyeOff, ShieldCheck, AlertCircle, CheckCircle2 } from 'lucide-react'

import { auth } from '@/api/endpoints'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'

const MIN_LEN = 8

function PwdInput({ label, value, onChange, autoComplete }) {
  const [show, setShow] = useState(false)
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          required
          autoComplete={autoComplete}
          value={value}
          onChange={onChange}
          className="w-full pl-3 pr-10 py-2.5 border border-slate-300 rounded-lg text-sm bg-slate-50
                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          tabIndex={-1}
          className="absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-slate-600"
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </div>
  )
}

export function ChangePasswordModal({ open, onClose }) {
  const [form,   setForm]    = useState({ current: '', next: '', confirm: '' })
  const [error,  setError]   = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (open) {
      setForm({ current: '', next: '', confirm: '' })
      setError('')
      setSuccess(false)
    }
  }, [open])

  const mutation = useMutation({
    mutationFn: () => auth.changePassword({
      current_password: form.current,
      new_password:     form.next,
    }),
    onSuccess: () => {
      setSuccess(true)
      setForm({ current: '', next: '', confirm: '' })
    },
    onError: (err) => {
      const d = err.response?.data
      setError(
        d?.current_password?.[0]
        ?? d?.new_password?.[0]
        ?? d?.detail
        ?? 'Failed to change password. Please try again.'
      )
    },
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    setError('')
    if (form.next.length < MIN_LEN) {
      setError(`New password must be at least ${MIN_LEN} characters.`)
      return
    }
    if (form.next !== form.confirm) {
      setError('New password and confirmation do not match.')
      return
    }
    if (form.next === form.current) {
      setError('New password must differ from the current one.')
      return
    }
    mutation.mutate()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Change Password"
      size="sm"
      privateBackdrop
      footer={success ? (
        <Button onClick={onClose}>Close</Button>
      ) : (
        <>
          <Button variant="ghost" onClick={onClose} disabled={mutation.isPending}>Cancel</Button>
          <Button onClick={handleSubmit} loading={mutation.isPending}>Update Password</Button>
        </>
      )}
    >
      {success ? (
        <div className="flex flex-col items-center text-center py-4">
          <span className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mb-3">
            <CheckCircle2 className="w-6 h-6 text-emerald-600" />
          </span>
          <p className="font-semibold text-slate-800">Password updated</p>
          <p className="text-sm text-slate-500 mt-1">
            Use your new password the next time you sign in.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-start gap-2 text-xs text-blue-800 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
            <ShieldCheck className="w-4 h-4 flex-shrink-0 mt-0.5" />
            Password changes are recorded in the audit log.
          </div>

          <PwdInput
            label="Current Password"
            value={form.current}
            onChange={(e) => setForm((f) => ({ ...f, current: e.target.value }))}
            autoComplete="current-password"
          />
          <PwdInput
            label={`New Password (min ${MIN_LEN} characters)`}
            value={form.next}
            onChange={(e) => setForm((f) => ({ ...f, next: e.target.value }))}
            autoComplete="new-password"
          />
          <PwdInput
            label="Confirm New Password"
            value={form.confirm}
            onChange={(e) => setForm((f) => ({ ...f, confirm: e.target.value }))}
            autoComplete="new-password"
          />

          {error && (
            <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </form>
      )}
    </Modal>
  )
}

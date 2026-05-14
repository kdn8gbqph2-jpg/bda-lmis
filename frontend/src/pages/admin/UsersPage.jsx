import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, UserPlus, Pencil, UserX, UserCheck, Check, AlertCircle, Loader2 } from 'lucide-react'
import { users as usersApi } from '@/api/endpoints'
import { useDebounce } from '@/hooks/useDebounce'
import { Card } from '@/components/ui/Card'
import { Input, Select } from '@/components/ui/Input'
import { Table, Pagination } from '@/components/ui/Table'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'

const PAGE_SIZE = 20

const ROLES = [
  { value: '',               label: 'All Roles'        },
  { value: 'admin',          label: 'Admin'            },
  { value: 'superintendent', label: 'Superintendent'   },
  { value: 'staff',          label: 'Staff'            },
  { value: 'viewer',         label: 'Viewer'           },
]

const ROLE_COLORS = {
  admin:          'bg-red-50 text-red-700',
  superintendent: 'bg-violet-50 text-violet-700',
  staff:          'bg-blue-50 text-blue-700',
  viewer:         'bg-slate-100 text-slate-600',
}

function RoleBadge({ role }) {
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${ROLE_COLORS[role] || 'bg-slate-100 text-slate-600'}`}>
      {role}
    </span>
  )
}

// ── User form modal (create + edit) ──────────────────────────────────────────

/**
 * Inline availability hint for the SSO ID / User ID field. Three
 * states surface to the user:
 *   · checking — spinner while the debounced /check-emp-id/ call runs
 *   · available — green tick
 *   · taken    — red warning + who's holding it
 */
function SsoIdHint({ value, debounced, query, available }) {
  if (!value) return null
  // Show "checking" while the user is still typing (value !== debounced)
  // or while the request is in flight.
  const settling = value !== debounced || query.isFetching
  if (settling) {
    return (
      <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
        <Loader2 className="w-3 h-3 animate-spin" /> Checking availability…
      </p>
    )
  }
  if (available === true) {
    return (
      <p className="text-[11px] text-emerald-700 mt-1 flex items-center gap-1">
        <Check className="w-3 h-3" /> Available
      </p>
    )
  }
  if (available === false) {
    const who = query.data?.taken_by
    return (
      <p className="text-[11px] text-red-700 mt-1 flex items-center gap-1">
        <AlertCircle className="w-3 h-3" />
        Already in use{who ? ` by ${who}` : ''}.
      </p>
    )
  }
  return null
}

function emptyForm() {
  return {
    email: '', first_name: '', last_name: '',
    emp_id: '', mobile: '', role: 'viewer', password: '',
    is_active: true,
  }
}

function fromUser(u) {
  return {
    email:      u?.email      ?? '',
    first_name: u?.first_name ?? '',
    last_name:  u?.last_name  ?? '',
    emp_id:     u?.emp_id     ?? '',
    mobile:     u?.mobile     ?? '',
    role:       u?.role       ?? 'viewer',
    password:   '',
    is_active:  u?.is_active  ?? true,
  }
}

function UserFormModal({ open, onClose, user }) {
  const isEdit = !!user
  const qc = useQueryClient()
  const [form, setForm]     = useState(() => isEdit ? fromUser(user) : emptyForm())
  const [errors, setErrors] = useState({})
  const fieldErr = (k) => errors[k]?.[0]

  useEffect(() => {
    if (open) {
      setForm(isEdit ? fromUser(user) : emptyForm())
      setErrors({})
    }
  }, [open, user, isEdit])

  const mutation = useMutation({
    mutationFn: () => {
      if (isEdit) {
        // Don't include password if blank (means "leave unchanged").
        // Always send `username` — the model has it as a required
        // unique field and DRF rejects PUT bodies without it.
        // We preserve the existing username unless the SSO ID changed,
        // in which case we mirror the new SSO ID so the two stay synced.
        const { password, ...rest } = form
        const username = form.emp_id?.trim() || user.username
        const payload = { ...rest, username, ...(password ? { password } : {}) }
        return usersApi.update(user.id, payload)
      }
      // On create, derive username from SSO ID since the model requires it.
      return usersApi.create({ ...form, username: form.emp_id || form.email })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      onClose()
    },
    onError: (err) => {
      const data = err.response?.data
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        setErrors(data)
      } else {
        setErrors({ _detail: typeof data === 'string' ? data : 'Operation failed.' })
      }
    },
  })

  // Setting a value also clears that field's stale error so the red
  // hint goes away as soon as the user starts correcting it.
  const set = (k, v) => {
    setForm((f) => ({ ...f, [k]: v }))
    setErrors((e) => {
      if (!e || (!e[k] && !(k === 'emp_id' && e.username))) return e
      const next = { ...e }
      delete next[k]
      // The email input also displays username errors as a fallback
      // (since the user doesn't see a separate username field). Clear
      // the linked one when its visible field is edited.
      if (k === 'email')  delete next.username
      if (k === 'emp_id') delete next.username
      return next
    })
  }

  // ── SSO ID / User ID liveness check ──
  // Hit the backend after the user pauses typing for 400ms and show a
  // green tick / red warning inline below the input. The user's own
  // current SSO ID counts as available (we exclude the editing user).
  const debouncedEmpId = useDebounce(form.emp_id?.trim() ?? '', 400)
  const empIdQ = useQuery({
    queryKey: ['users', 'check-emp-id', debouncedEmpId, user?.id ?? null],
    queryFn:  () => usersApi.checkEmpId(debouncedEmpId, user?.id),
    enabled:  open && !!debouncedEmpId,
    staleTime: 30_000,
  })
  const empIdAvailable = debouncedEmpId
    ? (empIdQ.data?.available ?? null)
    : null

  const handleSubmit = () => {
    setErrors({})
    // Email is optional now — SSO ID alone is enough to identify a user.
    const required = isEdit
      ? !form.emp_id?.trim()
      : !form.emp_id?.trim() || !form.password
    if (required) {
      setErrors({
        _detail: isEdit
          ? 'SSO ID / User ID is required.'
          : 'SSO ID / User ID and Password are required.',
        ...(!form.emp_id?.trim()        && { emp_id:   ['This field is required.'] }),
        ...(!isEdit && !form.password   && { password: ['This field is required.'] }),
      })
      return
    }
    // Block submission if the SSO ID was reported as taken. The backend
    // would reject anyway; surfacing it client-side is friendlier.
    if (empIdAvailable === false) {
      setErrors({
        _detail: `SSO ID "${form.emp_id}" is already in use.`,
        emp_id: ['Already in use.'],
      })
      return
    }
    mutation.mutate()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? `Edit User — ${user?.username || user?.email}` : 'Add New User'}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={mutation.isPending} onClick={handleSubmit}>
            {isEdit ? 'Save Changes' : 'Create User'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {errors._detail && (
          <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {errors._detail}
          </p>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Input label="First Name" value={form.first_name}
                 onChange={(e) => set('first_name', e.target.value)}
                 error={fieldErr('first_name')} />
          <Input label="Last Name" value={form.last_name}
                 onChange={(e) => set('last_name', e.target.value)}
                 error={fieldErr('last_name')} />
        </div>

        <Input label="Email" type="email" value={form.email}
               onChange={(e) => set('email', e.target.value)}
               error={fieldErr('email') ?? fieldErr('username')} />

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Input
              label="SSO ID / User ID *"
              value={form.emp_id}
              onChange={(e) => set('emp_id', e.target.value)}
              error={fieldErr('emp_id')}
            />
            <p className="text-[11px] text-slate-500 mt-1 leading-snug">
              Enter custom User ID if SSO ID not available.
            </p>
            <SsoIdHint
              value={form.emp_id?.trim() ?? ''}
              debounced={debouncedEmpId}
              query={empIdQ}
              available={empIdAvailable}
            />
          </div>
          <Input label="Mobile" type="tel" inputMode="numeric"
                 placeholder="10 digits"
                 value={form.mobile}
                 onChange={(e) => set('mobile', e.target.value.replace(/\D/g, '').slice(0, 10))}
                 error={fieldErr('mobile')} />
        </div>

        <Input
          label={isEdit ? 'New Password (leave blank to keep current)' : 'Password *'}
          type="password"
          value={form.password}
          onChange={(e) => set('password', e.target.value)}
          error={fieldErr('password')}
        />

        <Select label="Role" value={form.role} onChange={(e) => set('role', e.target.value)}>
          {ROLES.slice(1).map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </Select>
        {fieldErr('role') && <p className="text-xs text-red-600">{fieldErr('role')}</p>}

        {isEdit && (
          <label className="flex items-center gap-2 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => set('is_active', e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500/30"
            />
            <span className="text-sm text-slate-700">Account active</span>
            <span className="text-xs text-slate-400 ml-auto">
              {form.is_active ? 'Can sign in' : 'Sign-in disabled'}
            </span>
          </label>
        )}
      </div>
    </Modal>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function UsersPage() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [role,   setRole]   = useState('')
  const [page,   setPage]   = useState(1)
  const [editing, setEditing] = useState(null)   // user object → edit
  const [creating, setCreating] = useState(false)

  const users = useQuery({
    queryKey: ['users', page, search, role],
    queryFn: () => usersApi.list({ page, page_size: PAGE_SIZE, search, role }),
    placeholderData: (prev) => prev,
  })

  const toggleActive = useMutation({
    mutationFn: (u) => usersApi.update(u.id, { is_active: !u.is_active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  })

  const reset = () => setPage(1)

  const COLUMNS = [
    {
      key: 'name',
      label: 'Name',
      render: (r) => {
        // Prefer raw first/last when the list payload carries them
        // (current UserListSerializer). Fall back to the computed
        // `full_name` for older clients / cached responses, and finally
        // to empty so the "Name not set" placeholder kicks in.
        const fullName = (
          `${r.first_name || ''} ${r.last_name || ''}`.trim()
          || (r.full_name && r.full_name.trim())
          || ''
        )
        const initial = (
          r.first_name?.[0] || r.last_name?.[0] || r.full_name?.[0] || r.email?.[0] || 'U'
        ).toUpperCase()
        return (
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-blue-100 rounded-full flex items-center justify-center
                            text-blue-700 text-xs font-semibold shrink-0">
              {initial}
            </div>
            <div className="min-w-0">
              <p className={`text-sm font-medium truncate ${
                fullName ? 'text-slate-800' : 'text-slate-400 italic'
              }`}>
                {fullName || 'Name not set'}
              </p>
              {r.emp_id && (
                <p className="text-xs text-slate-400 truncate">{r.emp_id}</p>
              )}
            </div>
          </div>
        )
      },
    },
    { key: 'email', label: 'Email', cellClass: 'text-slate-500 text-xs' },
    {
      key: 'login_id',
      label: 'Login ID',
      cellClass: 'text-xs',
      render: (r) => (
        <span className="font-mono text-slate-700">{r.username}</span>
      ),
    },
    { key: 'mobile', label: 'Mobile', cellClass: 'text-xs text-slate-500', render: (r) => r.mobile || '—' },
    { key: 'role',   label: 'Role',   render: (r) => <RoleBadge role={r.role} /> },
    {
      key: 'is_active',
      label: 'Status',
      render: (r) => (
        <span className={`text-xs font-medium ${r.is_active ? 'text-green-600' : 'text-slate-400'}`}>
          {r.is_active ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    {
      key: 'actions',
      label: '',
      render: (r) => (
        <div className="flex items-center gap-1 justify-end">
          <button
            type="button"
            onClick={() => setEditing(r)}
            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50 rounded"
            title="Edit user"
          >
            <Pencil className="w-3.5 h-3.5" /> Edit
          </button>
          <button
            type="button"
            onClick={() => {
              if (window.confirm(`${r.is_active ? 'Deactivate' : 'Activate'} ${r.username}?`)) {
                toggleActive.mutate(r)
              }
            }}
            disabled={toggleActive.isPending}
            className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded ${
              r.is_active
                ? 'text-red-600 hover:bg-red-50'
                : 'text-emerald-700 hover:bg-emerald-50'
            }`}
            title={r.is_active ? 'Deactivate user' : 'Activate user'}
          >
            {r.is_active
              ? <><UserX className="w-3.5 h-3.5" /> Deactivate</>
              : <><UserCheck className="w-3.5 h-3.5" /> Activate</>}
          </button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-64">
          <Input
            placeholder="Search name or email…"
            prefix={<Search className="w-3.5 h-3.5" />}
            value={search}
            onChange={(e) => { setSearch(e.target.value); reset() }}
          />
        </div>
        <div className="w-44">
          <Select value={role} onChange={(e) => { setRole(e.target.value); reset() }}>
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </Select>
        </div>
        <Button
          variant="primary"
          size="sm"
          className="ml-auto"
          onClick={() => setCreating(true)}
        >
          <UserPlus className="w-4 h-4 mr-1.5" /> Add User
        </Button>
      </div>

      <Card padding={false}>
        <Table
          columns={COLUMNS}
          data={users.data?.results ?? []}
          loading={users.isPending}
          emptyMessage="No users found."
        />
      </Card>

      <Pagination
        page={page}
        totalPages={Math.ceil((users.data?.count || 0) / PAGE_SIZE)}
        count={users.data?.count}
        pageSize={PAGE_SIZE}
        onPage={setPage}
      />

      <UserFormModal open={creating}    onClose={() => setCreating(false)} />
      <UserFormModal open={!!editing}   onClose={() => setEditing(null)} user={editing} />
    </div>
  )
}

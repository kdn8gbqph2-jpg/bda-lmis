import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, UserPlus, Shield } from 'lucide-react'
import { users as usersApi } from '@/api/endpoints'
import { Card } from '@/components/ui/Card'
import { Input, Select } from '@/components/ui/Input'
import { Table, Pagination } from '@/components/ui/Table'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'

const PAGE_SIZE = 20

const ROLES = [
  { value: '',             label: 'All Roles' },
  { value: 'admin',        label: 'Admin' },
  { value: 'superintendent', label: 'Superintendent' },
  { value: 'staff',        label: 'Staff' },
  { value: 'viewer',       label: 'Viewer' },
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

function CreateUserModal({ open, onClose }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    email: '', first_name: '', last_name: '',
    emp_id: '', role: 'viewer', password: '',
  })
  // DRF returns { field: [msg], ... }.  Keep the dict around so we can show
  // per-field errors next to each Input; top banner only carries the
  // non-field / unknown-shape messages.
  const [errors, setErrors] = useState({})
  const fieldErr = (k) => errors[k]?.[0]

  const reset = () => {
    setForm({ email: '', first_name: '', last_name: '', emp_id: '', role: 'viewer', password: '' })
    setErrors({})
  }

  const create = useMutation({
    mutationFn: () => usersApi.create({
      ...form,
      // Server requires username (unique). Derive from SSO ID — operators
      // sign in by SSO ID / email anyway, so the username is plumbing.
      username: form.emp_id || form.email,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      onClose()
      reset()
    },
    onError: (err) => {
      const data = err.response?.data
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        setErrors(data)
      } else {
        setErrors({ _detail: typeof data === 'string' ? data : 'Failed to create user.' })
      }
    },
  })

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const handleSubmit = () => {
    setErrors({})
    // Light client-side check so users see the most obvious miss immediately.
    if (!form.emp_id?.trim() || !form.email?.trim() || !form.password) {
      setErrors({
        _detail: 'Email, SSO ID, and Password are required.',
        ...(!form.email?.trim()    && { email:    ['This field is required.'] }),
        ...(!form.emp_id?.trim()   && { emp_id:   ['This field is required.'] }),
        ...(!form.password         && { password: ['This field is required.'] }),
      })
      return
    }
    create.mutate()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add New User"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={create.isPending} onClick={handleSubmit}>
            Create User
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
          <Input label="Last Name"  value={form.last_name}
                 onChange={(e) => set('last_name',  e.target.value)}
                 error={fieldErr('last_name')} />
        </div>
        <Input label="Email *" type="email" value={form.email}
               onChange={(e) => set('email', e.target.value)}
               error={fieldErr('email') ?? fieldErr('username')} />
        <Input label="SSO ID *" value={form.emp_id}
               onChange={(e) => set('emp_id', e.target.value)}
               error={fieldErr('emp_id')} />
        <Input label="Password *" type="password" value={form.password}
               onChange={(e) => set('password', e.target.value)}
               error={fieldErr('password')} />
        <Select label="Role" value={form.role}
                onChange={(e) => set('role', e.target.value)}>
          {ROLES.slice(1).map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </Select>
        {fieldErr('role') && <p className="text-xs text-red-600">{fieldErr('role')}</p>}
      </div>
    </Modal>
  )
}

const COLUMNS = [
  {
    key: 'name',
    label: 'Name',
    render: (r) => (
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 text-xs font-semibold shrink-0">
          {r.first_name?.[0] || r.email?.[0]?.toUpperCase() || 'U'}
        </div>
        <div>
          <p className="text-sm font-medium text-slate-800">
            {r.first_name ? `${r.first_name} ${r.last_name || ''}`.trim() : r.email}
          </p>
          <p className="text-xs text-slate-400">{r.emp_id}</p>
        </div>
      </div>
    ),
  },
  { key: 'email', label: 'Email', cellClass: 'text-slate-500 text-xs' },
  { key: 'role',  label: 'Role', render: (r) => <RoleBadge role={r.role} /> },
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
    key: 'date_joined',
    label: 'Joined',
    cellClass: 'text-xs text-slate-400 tabular-nums',
    render: (r) => r.date_joined ? new Date(r.date_joined).toLocaleDateString('en-IN') : '—',
  },
]

export default function UsersPage() {
  const [search,   setSearch]   = useState('')
  const [role,     setRole]     = useState('')
  const [page,     setPage]     = useState(1)
  const [showCreate, setShowCreate] = useState(false)

  const users = useQuery({
    queryKey: ['users', page, search, role],
    queryFn: () => usersApi.list({ page, page_size: PAGE_SIZE, search, role }),
    placeholderData: (prev) => prev,
  })

  const reset = () => setPage(1)

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
          onClick={() => setShowCreate(true)}
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

      <CreateUserModal open={showCreate} onClose={() => setShowCreate(false)} />
    </div>
  )
}

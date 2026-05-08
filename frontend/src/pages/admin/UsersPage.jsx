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
  const [error, setError] = useState('')

  const create = useMutation({
    mutationFn: () => usersApi.create(form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      onClose()
      setForm({ email: '', first_name: '', last_name: '', emp_id: '', role: 'viewer', password: '' })
      setError('')
    },
    onError: (err) => {
      const data = err.response?.data
      const msg = typeof data === 'string' ? data : Object.values(data || {}).flat().join(' ')
      setError(msg || 'Failed to create user.')
    },
  })

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add New User"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={create.isPending} onClick={() => create.mutate()}>
            Create User
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Input label="First Name" value={form.first_name} onChange={(e) => set('first_name', e.target.value)} />
          <Input label="Last Name"  value={form.last_name}  onChange={(e) => set('last_name',  e.target.value)} />
        </div>
        <Input label="Email"    type="email" value={form.email}  onChange={(e) => set('email',  e.target.value)} />
        <Input label="Emp ID"   value={form.emp_id}   onChange={(e) => set('emp_id',   e.target.value)} />
        <Input label="Password" type="password" value={form.password} onChange={(e) => set('password', e.target.value)} />
        <Select label="Role" value={form.role} onChange={(e) => set('role', e.target.value)}>
          {ROLES.slice(1).map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </Select>
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

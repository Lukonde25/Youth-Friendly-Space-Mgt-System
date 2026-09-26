import { useEffect, useState } from 'react'
import { Button, Card, Input, Modal, Alert, MemberCard } from '../components'
import { useForm } from '../hooks/useForm'
import {
  fetchMembers,
  createMember,
  updateMember,
  deactivateMember,
  getMemberStats,
  getMemberEngagementHistory
} from '../services/memberService'

export default function MembersPage({ organizationId }) {
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('active')
  const [editingMember, setEditingMember] = useState(null)
  const [historyMember, setHistoryMember] = useState(null)

  useEffect(() => {
    loadMembers()
  }, [organizationId, statusFilter])

  const loadMembers = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await fetchMembers(organizationId, { includeInactive: statusFilter !== 'active' })
      setMembers((data || []).filter((member) => (
        statusFilter === 'all' || member.active === (statusFilter === 'active')
      )))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleAddMember = async (values) => {
    try {
      await createMember(organizationId, { ...values, date_joined: values.date_joined || new Date().toISOString().split('T')[0] })
      setShowAddForm(false)
      await loadMembers()
    } catch (err) {
      throw new Error(err.message)
    }
  }

  const handleDeleteMember = async (memberId) => {
    if (!confirm('Remove this member?')) return
    try {
      await deactivateMember(memberId)
      await loadMembers()
    } catch (err) {
      setError(err.message)
    }
  }

  const filteredMembers = members.filter(m => 
    m.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.phone?.includes(searchQuery) ||
    m.email?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (loading) return <div className="p-6 text-center text-secondary">Loading members...</div>

  return (
    <div className="space-y-6">
      {error && <Alert variant="error" onDismiss={() => setError(null)}>{error}</Alert>}

      <div className="flex-between">
        <div className="flex gap-3 flex-wrap">
          <Input placeholder="Search name, phone or email..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="max-w-md" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filter members by status"
            className="p-3 border rounded"
          >
            <option value="active">Active members</option>
            <option value="inactive">Inactive members</option>
            <option value="all">All members</option>
          </select>
        </div>
        <Button onClick={() => setShowAddForm(true)}>+ Add Member</Button>
      </div>

      {filteredMembers.length > 0 ? (
        <div className="space-y-4">
          {filteredMembers.map(member => (
            <MemberCard
              key={member.id}
              member={member}
              onEdit={() => setEditingMember(member)}
              onHistory={() => setHistoryMember(member)}
              onRemove={() => handleDeleteMember(member.id)}
              showActions={true}
            />
          ))}
        </div>
      ) : (
        <Card className="text-center py-12">
          <div className="mb-4 text-4xl">👥</div>
          <h3>No Members Yet</h3>
          <p className="text-secondary mb-4">Add your first member to start tracking participation</p>
          <Button onClick={() => setShowAddForm(true)}>Add First Member</Button>
        </Card>
      )}

      {members.length > 0 && <div className="text-center text-secondary text-sm">Showing {filteredMembers.length} of {members.length} members</div>}

      <AddMemberModal isOpen={showAddForm} organizationId={organizationId} onClose={() => setShowAddForm(false)} onSuccess={loadMembers} />
      {editingMember && (
        <EditMemberModal
          member={editingMember}
          onClose={() => setEditingMember(null)}
          onSave={async (values) => {
            try {
              await updateMember(editingMember.id, values)
              setEditingMember(null)
              await loadMembers()
            } catch (err) {
              throw new Error(err.message)
            }
          }}
        />
      )}
      {historyMember && (
        <MemberEngagementModal
          member={historyMember}
          onClose={() => setHistoryMember(null)}
        />
      )}
    </div>
  )
}

function AddMemberModal({ isOpen, organizationId, onClose, onSuccess }) {
  const [submitError, setSubmitError] = useState(null)

  const form = useForm(
    { name: '', phone: '', email: '', age: '', health_info: '', role: 'regular_participant', date_joined: new Date().toISOString().split('T')[0] },
    async (values) => {
      try {
        setSubmitError(null)
        await createMember(organizationId, values)
        form.reset()
        onClose()
        onSuccess()
      } catch (err) {
        setSubmitError(err.message)
      }
    }
  )

  return (
    <Modal isOpen={isOpen} title="Add New Member" onClose={onClose}>
      {submitError && <Alert variant="error" className="mb-4" onDismiss={() => setSubmitError(null)}>{submitError}</Alert>}

      <form onSubmit={form.handleSubmit} className="space-y-4">
        <input type="text" name="name" placeholder="Full Name" value={form.values.name} onChange={form.handleChange} required className="w-full p-3 border rounded" />
        <input type="tel" name="phone" placeholder="Phone Number" value={form.values.phone} onChange={form.handleChange} required className="w-full p-3 border rounded" />
        <input type="email" name="email" placeholder="Email (optional)" value={form.values.email} onChange={form.handleChange} className="w-full p-3 border rounded" />
        <input type="number" name="age" placeholder="Age (optional)" min="10" max="120" value={form.values.age} onChange={form.handleChange} className="w-full p-3 border rounded" />
        <textarea name="health_info" placeholder="Health information (optional; restricted to coordinators)" value={form.values.health_info} onChange={form.handleChange} rows="3" className="w-full p-3 border rounded" />
        
        <div>
          <label className="block mb-2 font-medium text-sm">Role</label>
          <select name="role" value={form.values.role} onChange={form.handleChange} className="w-full">
            <option value="core_member">Core Member</option>
            <option value="regular_participant">Regular Participant</option>
            <option value="volunteer">Volunteer</option>
          </select>
        </div>

        <input type="date" name="date_joined" value={form.values.date_joined} onChange={form.handleChange} className="w-full p-3 border rounded" />

        <div className="flex gap-3 mt-6">
          <Button type="button" variant="secondary" onClick={() => { onClose(); form.reset() }}>Cancel</Button>
          <Button type="submit" loading={form.loading}>Add Member</Button>
        </div>
      </form>
    </Modal>
  )
}

function EditMemberModal({ member, onClose, onSave }) {
  const [values, setValues] = useState({
    name: member.name || '',
    phone: member.phone || '',
    email: member.email || '',
    age: member.age || '',
    health_info: member.health_info || '',
    role: member.role || 'regular_participant'
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (event) => {
    event.preventDefault()
    try {
      setSaving(true)
      setError(null)
      await onSave({
        ...values,
        age: values.age ? Number(values.age) : null
      })
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal isOpen title="Edit Member" onClose={onClose}>
      {error && <Alert variant="error" className="mb-4">{error}</Alert>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <input className="w-full p-3 border rounded" placeholder="Full name" value={values.name} onChange={(event) => setValues({ ...values, name: event.target.value })} required />
        <input className="w-full p-3 border rounded" type="tel" placeholder="Phone" value={values.phone} onChange={(event) => setValues({ ...values, phone: event.target.value })} required />
        <input className="w-full p-3 border rounded" type="email" placeholder="Email" value={values.email} onChange={(event) => setValues({ ...values, email: event.target.value })} />
        <input className="w-full p-3 border rounded" type="number" placeholder="Age" min="10" max="120" value={values.age} onChange={(event) => setValues({ ...values, age: event.target.value })} />
        <textarea className="w-full p-3 border rounded" placeholder="Health information (restricted to coordinators)" rows="3" value={values.health_info} onChange={(event) => setValues({ ...values, health_info: event.target.value })} />
        <select className="w-full p-3 border rounded" value={values.role} onChange={(event) => setValues({ ...values, role: event.target.value })}>
          <option value="core_member">Core Member</option>
          <option value="regular_participant">Regular Participant</option>
          <option value="volunteer">Volunteer</option>
        </select>
        <div className="flex gap-3">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={saving}>Save changes</Button>
        </div>
      </form>
    </Modal>
  )
}

function MemberEngagementModal({ member, onClose }) {
  const [stats, setStats] = useState(null)
  const [history, setHistory] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    Promise.all([
      getMemberStats(member.id),
      getMemberEngagementHistory(member.id)
    ])
      .then(([memberStats, memberHistory]) => {
        setStats(memberStats)
        setHistory(memberHistory)
      })
      .catch((loadError) => setError(loadError.message))
  }, [member.id])

  return (
    <Modal isOpen title={`${member.name} · Engagement`} onClose={onClose}>
      {error && <Alert variant="error">{error}</Alert>}
      {!stats && !error ? <p className="text-secondary">Loading engagement history...</p> : stats && (
        <div className="space-y-5">
          <div className="grid grid-2 gap-4">
            <Card><p className="text-secondary">Events attended</p><strong>{stats.events_attended}</strong></Card>
            <Card><p className="text-secondary">Activities participated</p><strong>{stats.activities_participated}</strong></Card>
          </div>
          <section>
            <h4>Event history</h4>
            {history?.events.filter((entry) => entry.events).map((entry) => (
              <p key={entry.id} className="text-sm border-t py-2">
                {entry.events.name} · {new Date(entry.events.date).toLocaleDateString()} · {entry.status}
              </p>
            ))}
          </section>
          <section>
            <h4>Activity history</h4>
            {history?.activities.filter((entry) => entry.activities).map((entry) => (
              <p key={entry.id} className="text-sm border-t py-2">
                {entry.activities.activity_type.replaceAll('_', ' ')} · {new Date(entry.activities.date).toLocaleDateString()}
                {entry.activities.location ? ` · ${entry.activities.location}` : ''}
              </p>
            ))}
          </section>
        </div>
      )}
    </Modal>
  )
}

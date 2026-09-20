import { useEffect, useState } from 'react'
import { Button, Card, Input, Modal, Alert, MemberCard } from '../components'
import { useForm } from '../hooks/useForm'
import { fetchMembers, createMember, updateMember, deactivateMember } from '../services/memberService'

export default function MembersPage({ organizationId }) {
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    loadMembers()
  }, [organizationId])

  const loadMembers = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await fetchMembers(organizationId)
      setMembers(data || [])
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
    m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.phone.includes(searchQuery)
  )

  if (loading) return <div className="p-6 text-center text-secondary">Loading members...</div>

  return (
    <div className="space-y-6">
      {error && <Alert variant="error" onDismiss={() => setError(null)}>{error}</Alert>}

      <div className="flex-between">
        <Input placeholder="Search by name or phone..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="max-w-md" />
        <Button onClick={() => setShowAddForm(true)}>+ Add Member</Button>
      </div>

      {filteredMembers.length > 0 ? (
        <div className="space-y-4">
          {filteredMembers.map(member => (
            <MemberCard
              key={member.id}
              member={member}
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
    </div>
  )
}

function AddMemberModal({ isOpen, organizationId, onClose, onSuccess }) {
  const [submitError, setSubmitError] = useState(null)

  const form = useForm(
    { name: '', phone: '', email: '', role: 'regular_participant', date_joined: new Date().toISOString().split('T')[0] },
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

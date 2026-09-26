import { useEffect, useState } from 'react'
import { Alert, Button, Card } from '../components'
import { supabase } from '../services/supabaseClient'

export default function MemberRequestsPage({ organizationId, onResolved }) {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState(null)

  const loadRequests = async () => {
    try {
      setError(null)
      const { data, error: requestError } = await supabase
        .from('users')
        .select('id, full_name, email, phone, age, created_at')
        .eq('organization_id', organizationId)
        .eq('app_role', 'member')
        .eq('approval_status', 'pending')
        .order('created_at', { ascending: true })

      if (requestError) throw requestError
      setRequests(data || [])
    } catch (loadError) {
      setError(loadError.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRequests()
  }, [organizationId])

  const resolveRequest = async (userId, action) => {
    try {
      setBusyId(userId)
      setError(null)
      const { error: resolveError } = await supabase.rpc(
        action === 'approve' ? 'approve_member_request' : 'reject_member_request',
        { requested_user_id: userId }
      )
      if (resolveError) throw resolveError
      await loadRequests()
      onResolved?.()
    } catch (resolveError) {
      setError(resolveError.message)
    } finally {
      setBusyId(null)
    }
  }

  if (loading) return <p className="text-secondary">Loading membership requests...</p>

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Membership requests</h2>
        <p className="text-secondary">Review youth requests to join your friendly space.</p>
      </div>
      {error && <Alert variant="error" onDismiss={() => setError(null)}>{error}</Alert>}
      {requests.length ? requests.map((request) => (
        <Card key={request.id}>
          <div className="flex-between gap-4">
            <div>
              <h3>{request.full_name || 'New member'}</h3>
              <p className="text-secondary">{request.email}</p>
              {request.phone && <p className="text-sm text-secondary">{request.phone}</p>}
              {request.age && <p className="text-sm text-secondary">Age {request.age}</p>}
              <p className="text-xs text-tertiary">
                Requested {new Date(request.created_at).toLocaleDateString()}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => resolveRequest(request.id, 'approve')}
                loading={busyId === request.id}
              >
                Approve
              </Button>
              <Button
                variant="danger"
                onClick={() => resolveRequest(request.id, 'reject')}
                disabled={busyId === request.id}
              >
                Decline
              </Button>
            </div>
          </div>
        </Card>
      )) : (
        <Card className="text-center py-8">
          <p className="text-secondary">There are no pending requests.</p>
        </Card>
      )}
    </div>
  )
}

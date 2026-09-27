import { supabase } from './supabaseClient'

export const fetchNotifications = async (recipientId) => {
  if (!supabase) throw new Error('Supabase is not configured.')

  const { data, error } = await supabase
    .from('notifications')
    .select('id, organization_id, request_user_id, title, body, created_at, read_at')
    .eq('recipient_id', recipientId)
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) throw error
  return data || []
}

export const markNotificationAsRead = async (notificationId, recipientId) => {
  if (!supabase) throw new Error('Supabase is not configured.')

  const { data, error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', notificationId)
    .eq('recipient_id', recipientId)
    .is('read_at', null)
    .select('id, read_at')
    .maybeSingle()

  if (error) throw error
  return data
}

export const subscribeToNotifications = (recipientId, onInsert, onError) => {
  if (!supabase) throw new Error('Supabase is not configured.')

  const channel = supabase
    .channel(`admin-notifications-${recipientId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `recipient_id=eq.${recipientId}`
      },
      onInsert
    )
    .subscribe((status, error) => {
      if ((status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') && onError) {
        onError(error || new Error(`Notification subscription status: ${status}`))
      }
    })

  return () => {
    supabase.removeChannel(channel).catch((error) => {
      console.error('Could not close notification subscription:', error)
    })
  }
}

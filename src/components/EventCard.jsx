import React from 'react'
import Badge from './Badge'
import Button from './Button'
import CoverContentCard from './CoverContentCard'

const EventCard = ({
  event,
  onEdit,
  onSendReminders,
  onCheckin,
  onDelete,
  onCancel,
  onViewMetrics,
  showActions = true,
  showInvitationStats = true,
  invitationActionLabel = 'Manage Invitations',
  ...props
}) => {
  const eventDate = new Date(event.date)
  const isUpcoming = eventDate > new Date()
  const formatDate = (date) => new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date)

  const status = event.status === 'cancelled'
    ? <Badge variant="warning">Cancelled</Badge>
    : isUpcoming
      ? <Badge variant="info">Upcoming</Badge>
      : <Badge variant="success">Completed</Badge>

  const actions = showActions && (
    <div className="event-card-actions">
      {isUpcoming && event.status !== 'cancelled' && (
        <>
          {onSendReminders && (
            <Button onClick={onSendReminders} size="sm" variant="secondary">
              {invitationActionLabel}
            </Button>
          )}
          {onEdit && <Button onClick={onEdit} size="sm" variant="secondary">Edit</Button>}
          {onCancel && (
            <Button onClick={onCancel} size="sm" variant="danger">Cancel Event</Button>
          )}
        </>
      )}
      {!isUpcoming && onCheckin && (
        <Button onClick={onCheckin} size="sm" variant="primary">Record Attendance</Button>
      )}
      {onViewMetrics && event.status !== 'cancelled' && (
        <Button onClick={onViewMetrics} size="sm" variant="ghost">Attendance &amp; Metrics</Button>
      )}
      {onDelete && <Button onClick={onDelete} size="sm" variant="danger">Delete</Button>}
    </div>
  )

  return (
    <div className="event-card-shell" {...props}>
      <CoverContentCard
        title={event.name}
        body={event.description}
        coverImageUrl={event.cover_image_url}
        date={event.date}
        footer={(
          <div className="event-card-footer">
            {status}
            {event.event_type && (
              <span className="event-type-label">{event.event_type.replaceAll('_', ' ')}</span>
            )}
          </div>
        )}
        details={(
          <div className="event-card-details">
            <p><strong>Type:</strong> {event.event_type?.replaceAll('_', ' ') || 'Event'}</p>
            <p><strong>Date:</strong> {formatDate(eventDate)}</p>
            <p><strong>Location:</strong> {event.location || 'Not specified'}</p>
            {event.capacity != null && <p><strong>Capacity:</strong> {event.capacity}</p>}
            {showInvitationStats && (
              <div className="event-invitation-stats">
                <span><strong>{event.total_invited || 0}</strong> Invited</span>
                <span><strong>{event.confirmed_count || event.confirmed || 0}</strong> Confirmed</span>
                <span><strong>{event.attended_count || event.attended || 0}</strong> Attended</span>
              </div>
            )}
          </div>
        )}
      />
      {actions && <div className="event-actions-row">{actions}</div>}
    </div>
  )
}

export default EventCard

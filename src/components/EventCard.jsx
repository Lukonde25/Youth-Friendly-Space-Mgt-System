/**
 * EventCard Component
 * 
 * Displays event information with status and actions
 * 
 * Usage:
 * <EventCard
 *   event={event}
 *   onEdit={() => handleEdit(event)}
 *   onSendReminders={() => handleReminders(event)}
 *   onCheckin={() => handleCheckin(event)}
 * />
 */

import React from 'react';
import Badge from './Badge';
import Button from './Button';

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
  const eventDate = new Date(event.date);
  const isUpcoming = eventDate > new Date();

  const getStatusBadge = () => {
    if (event.status === 'cancelled') {
      return <Badge variant="warning">Cancelled</Badge>;
    }
    if (isUpcoming) {
      return <Badge variant="info">Upcoming</Badge>;
    }
    return <Badge variant="success">Completed</Badge>;
  };

  const formatDate = (date) => {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  return (
    <div className="card hover:shadow-md transition-shadow" {...props}>
      <div className="flex-between mb-4">
        <h3 className="h4 m-0">{event.name}</h3>
        {getStatusBadge()}
      </div>

      <div className="space-y-2 mb-4">
        {event.event_type && (
          <p className="text-secondary m-0 capitalize">{event.event_type.replaceAll('_', ' ')}</p>
        )}
        <p className="text-secondary m-0">
          <span className="font-medium">📅</span> {formatDate(eventDate)}
        </p>
        <p className="text-secondary m-0">
          <span className="font-medium">📍</span> {event.location}
        </p>
        {event.description && (
          <p className="text-secondary m-0 text-sm">{event.description}</p>
        )}
      </div>

      {/* Invitation Stats */}
      {showInvitationStats && (
        <div className="grid grid-cols-3 gap-3 mb-4 p-3 bg-gray-50 rounded-md">
          <div>
            <div className="text-2xl font-bold text-primary">
              {event.total_invited || 0}
            </div>
            <div className="text-xs text-tertiary">Invited</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-success">
              {event.confirmed_count || 0}
            </div>
            <div className="text-xs text-tertiary">Confirmed</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-info">
              {event.attended_count || 0}
            </div>
            <div className="text-xs text-tertiary">Attended</div>
          </div>
        </div>
      )}

      {showActions && (
        <div className="flex gap-2 flex-wrap">
          {isUpcoming && event.status !== 'cancelled' && (
            <>
              {onSendReminders && (
                <Button
                  onClick={onSendReminders}
                  size="sm"
                  variant="secondary"
                >
                  {invitationActionLabel}
                </Button>
              )}
              {onEdit && (
                <Button
                  onClick={onEdit}
                  size="sm"
                  variant="secondary"
                >
                  Edit
                </Button>
              )}
              {onCancel && event.status !== 'cancelled' && (
                <Button
                  onClick={onCancel}
                  size="sm"
                  variant="danger"
                >
                  Cancel Event
                </Button>
              )}
            </>
          )}
          {!isUpcoming && onCheckin && (
            <Button
              onClick={onCheckin}
              size="sm"
              variant="primary"
            >
              Record Attendance
            </Button>
          )}
          {onViewMetrics && event.status !== 'cancelled' && (
            <Button onClick={onViewMetrics} size="sm" variant="ghost">
              Attendance & Metrics
            </Button>
          )}
          {onDelete && (
            <Button
              onClick={onDelete}
              size="sm"
              variant="danger"
            >
              Delete
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

export default EventCard;

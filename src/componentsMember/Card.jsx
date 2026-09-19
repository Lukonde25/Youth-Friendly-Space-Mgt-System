/**
 * MemberCard Component
 * 
 * Displays member information in a card format
 * 
 * Usage:
 * <MemberCard
 *   member={member}
 *   onEdit={() => handleEdit(member)}
 *   onRemove={() => handleRemove(member)}
 *   showActions={true}
 * />
 */

import React from 'react';
import Badge from './Badge';
import Button from './Button';

const MemberCard = ({
  member,
  onEdit,
  onRemove,
  onSelect,
  selected = false,
  showActions = true,
  showCheckbox = false,
  ...props
}) => {
  const getStatusBadge = (active) => {
    if (active) {
      return <Badge variant="success">Active</Badge>;
    }
    return <Badge variant="warning">Inactive</Badge>;
  };

  const getParticipationColor = (events) => {
    if (events >= 10) return 'success';
    if (events >= 5) return 'info';
    return 'warning';
  };

  return (
    <div
      className={[
        'card cursor-pointer transition-all',
        selected ? 'ring-2 ring-primary bg-primary-light' : 'hover:shadow-md'
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      <div className="flex gap-4">
        {showCheckbox && (
          <input
            type="checkbox"
            checked={selected}
            onChange={(e) => onSelect?.(e.target.checked)}
            className="mt-1"
          />
        )}

        <div className="flex-1">
          <div className="flex-between mb-3">
            <h3 className="h4 m-0">{member.name}</h3>
            {getStatusBadge(member.active)}
          </div>

          <div className="space-y-2 text-sm mb-4">
            <p className="text-secondary m-0">
              <span className="text-tertiary">Phone:</span> {member.phone}
            </p>
            <p className="text-secondary m-0">
              <span className="text-tertiary">Joined:</span>{' '}
              {new Date(member.date_joined).toLocaleDateString()}
            </p>
            <p className="text-secondary m-0">
              <span className="text-tertiary">Role:</span> {member.role}
            </p>
          </div>

          {/* Events attended */}
          <div className="flex items-center gap-2 mb-4">
            <span className="text-sm text-tertiary">Events:</span>
            <Badge variant={getParticipationColor(member.events_attended || 0)}>
              {member.events_attended || 0} attended
            </Badge>
          </div>

          {showActions && (
            <div className="flex gap-2">
              {onEdit && (
                <Button
                  onClick={onEdit}
                  size="sm"
                  variant="secondary"
                >
                  Edit
                </Button>
              )}
              {onRemove && (
                <Button
                  onClick={onRemove}
                  size="sm"
                  variant="danger"
                >
                  Remove
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MemberCard;

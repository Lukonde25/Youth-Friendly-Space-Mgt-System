import Button from './Button'
import CoverContentCard from './CoverContentCard'

export default function ActivityCard({ activity, onDelete }) {
  const activityName = activity.activity_type.replaceAll('_', ' ')
  const metrics = [
    ['People reached', activity.people_reached],
    ['Pregnancies identified', activity.pregnancies_identified],
    ['Contraceptives distributed', activity.contraceptives_distributed],
    ['Screenings done', activity.screenings_done],
    ['Health talks given', activity.health_talks_given]
  ]

  return (
    <div className="activity-card-shell">
      <CoverContentCard
        title={activityName}
        body={activity.description}
        coverImageUrl={activity.cover_image_url}
        date={activity.date}
        footer={(
          <div className="activity-card-footer">
            {activity.location && <span>{activity.location}</span>}
            {onDelete && (
              <Button size="sm" variant="danger" onClick={() => onDelete(activity.id)}>
                Delete
              </Button>
            )}
          </div>
        )}
        details={(
          <div className="activity-card-details">
            {activity.location && <p><strong>Location:</strong> {activity.location}</p>}
            <div className="activity-metric-grid">
              {metrics.map(([label, value]) => (
                <div key={label}>
                  <strong>{value || 0}</strong>
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      />
    </div>
  )
}

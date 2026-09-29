import Badge from './Badge'

const statusVariants = {
  scheduled: 'info',
  ongoing: 'warning',
  completed: 'success',
  cancelled: 'danger'
}

export default function MeetingStatusBadge({ status }) {
  return <Badge variant={statusVariants[status] || 'primary'}>{status || 'scheduled'}</Badge>
}

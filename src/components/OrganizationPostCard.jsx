import { useState } from 'react'
import CoverContentCard from './CoverContentCard'
import { recordPostView, togglePostLove } from '../services/postService'

export default function OrganizationPostCard({ post, userId, onDelete }) {
  const [loveCount, setLoveCount] = useState(post.love_count || 0)
  const [viewCount, setViewCount] = useState(post.view_count || 0)
  const [loved, setLoved] = useState(Boolean(post.loved_by_user))
  const [reacting, setReacting] = useState(false)
  const [interactionError, setInteractionError] = useState(null)

  const handleOpen = async () => {
    try {
      const updatedCount = await recordPostView(post.id, userId)
      setViewCount(updatedCount)
    } catch (error) {
      setInteractionError(error.message)
    }
  }

  const handleLove = async () => {
    if (reacting) return
    try {
      setReacting(true)
      setInteractionError(null)
      const result = await togglePostLove(post.id, userId, loved)
      setLoved(result.loved)
      setLoveCount(result.loveCount)
    } catch (error) {
      setInteractionError(error.message)
    } finally {
      setReacting(false)
    }
  }

  return (
    <CoverContentCard
      title={post.title}
      body={post.body}
      coverImageUrl={post.cover_image_url}
      date={post.created_at}
      onOpen={handleOpen}
      footer={(
        <div className="post-engagement">
          <span className="post-view-count" aria-label={`${viewCount} views`}>◉ {viewCount}</span>
          <button
            type="button"
            className={`post-love-button${loved ? ' is-loved' : ''}`}
            onClick={handleLove}
            disabled={reacting}
            aria-pressed={loved}
            aria-label={`${loved ? 'Remove love reaction' : 'Love this post'}; ${loveCount} loves`}
          >
            <span aria-hidden="true">♥</span> {loveCount}
          </button>
          {interactionError && <span className="post-interaction-error" role="status">{interactionError}</span>}
          {onDelete && (
            <button
              type="button"
              className="organization-post-delete"
              onClick={() => onDelete(post)}
            >
              Delete post
            </button>
          )}
        </div>
      )}
    />
  )
}

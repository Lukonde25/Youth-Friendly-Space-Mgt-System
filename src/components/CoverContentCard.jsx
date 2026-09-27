import { useEffect, useState } from 'react'

export default function CoverContentCard({
  title,
  body,
  coverImageUrl,
  date,
  details,
  footer,
  onOpen
}) {
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    if (!isOpen) return undefined

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setIsOpen(false)
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  const openDetails = () => {
    setIsOpen(true)
    if (onOpen) onOpen()
  }

  return (
    <>
      <article className="organization-post-card">
        <button
          type="button"
          className={`organization-post-cover${coverImageUrl ? ' has-image' : ''}`}
          onClick={openDetails}
          aria-label={`Open details: ${title}`}
        >
          {coverImageUrl && (
            <img
              className="organization-post-cover-image"
              src={coverImageUrl}
              alt=""
              loading="lazy"
            />
          )}
          <span className="organization-post-cover-shade" aria-hidden="true" />
          <span className="organization-post-cover-copy">
            <strong>{title}</strong>
            <span className="organization-post-preview">{body || 'Open to view more details.'}</span>
            <span className="organization-post-read-more">View details</span>
          </span>
        </button>
        <div className="organization-post-footer">
          {date && <time dateTime={date}>{new Date(date).toLocaleString()}</time>}
          {footer}
        </div>
      </article>

      {isOpen && (
        <div
          className="organization-post-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setIsOpen(false)
          }}
        >
          <section
            className="organization-post-modal"
            role="dialog"
            aria-modal="true"
            aria-label={title}
          >
            <button
              type="button"
              className="organization-post-modal-close"
              onClick={() => setIsOpen(false)}
              aria-label="Close details"
            >
              ×
            </button>
            <div className={`organization-post-modal-cover${coverImageUrl ? ' has-image' : ''}`}>
              {coverImageUrl && <img src={coverImageUrl} alt="" />}
              <span className="organization-post-cover-shade" aria-hidden="true" />
              <h2>{title}</h2>
            </div>
            <div className="organization-post-modal-body">
              {date && <time dateTime={date}>{new Date(date).toLocaleString()}</time>}
              {body && <p>{body}</p>}
              {details}
            </div>
          </section>
        </div>
      )}
    </>
  )
}

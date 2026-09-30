import { useEffect, useRef, useState } from 'react'
import { Alert, Button, Card } from '../components'
import OrganizationPostCard from '../components/OrganizationPostCard'
import { createPost, deletePost, fetchPublishedPosts } from '../services/postService'
import { setPostPublic } from '../services/publicService'

export default function PostsPage({ organizationId, userId }) {
  const [posts, setPosts] = useState([])
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [isPublic, setIsPublic] = useState(false)
  const [coverFile, setCoverFile] = useState(null)
  const [coverPreviewUrl, setCoverPreviewUrl] = useState(null)
  const coverInputRef = useRef(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!coverFile) {
      setCoverPreviewUrl(null)
      return undefined
    }

    const previewUrl = URL.createObjectURL(coverFile)
    setCoverPreviewUrl(previewUrl)
    return () => URL.revokeObjectURL(previewUrl)
  }, [coverFile])

  const loadPosts = async () => {
    try {
      setError(null)
      const data = await fetchPublishedPosts(organizationId, userId)
      setPosts(data || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPosts()
  }, [organizationId, userId])

  const handleSubmit = async (event) => {
    event.preventDefault()
    try {
      setSaving(true)
      setError(null)
      const createdPost = await createPost(organizationId, userId, { title, body, coverFile, isPublic })
      setPosts((current) => [createdPost, ...current])
      setTitle('')
      setBody('')
      setIsPublic(false)
      setCoverFile(null)
      if (coverInputRef.current) coverInputRef.current.value = ''
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const togglePublic = async (post) => {
    try {
      setError(null)
      await setPostPublic(post.id, !post.is_public)
      setPosts((current) => current.map((item) => item.id === post.id ? { ...item, is_public: !post.is_public } : item))
    } catch (err) {
      setError(err.message)
    }
  }

  const handleDelete = async (post) => {
    if (!window.confirm('Delete this centre update?')) return
    try {
      setError(null)
      await deletePost(post.id, post.cover_image_path)
      setPosts((current) => current.filter((item) => item.id !== post.id))
    } catch (err) {
      setError(err.message)
      if (err.message.startsWith('The post was deleted,')) {
        setPosts((current) => current.filter((item) => item.id !== post.id))
      }
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Centre news</h2>
        <p className="text-secondary">Publish updates for people who belong to your centre.</p>
      </div>

      {error && <Alert variant="error" onDismiss={() => setError(null)}>{error}</Alert>}

      <Card className="post-composer">
        <div className="post-composer-heading">
          <div>
            <h3>Create a post</h3>
            <p className="text-secondary">Share a centre update with your members.</p>
          </div>
          <span className="post-composer-step">1 · Write</span>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="block mb-2 font-medium text-sm">Post title</span>
            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Give your post a title"
              aria-label="Post title"
              required
              maxLength={160}
              className="w-full p-3 border rounded"
            />
          </label>
          <label className="block">
            <span className="block mb-2 font-medium text-sm">Description</span>
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="Write the details you want to share..."
              aria-label="Post description"
              required
              rows="5"
              maxLength={10000}
              className="w-full p-3 border rounded"
            />
          </label>

          <div className="post-cover-picker">
            <div className="post-composer-heading">
              <div>
                <h4>Cover image</h4>
                <p className="text-secondary">Optional · Images are resized and compressed before upload.</p>
              </div>
              <span className="post-composer-step">2 · Add a photo</span>
            </div>
            <label className="post-image-select">
              <input
                type="file"
                ref={coverInputRef}
                accept="image/*"
                aria-label="Choose post cover image"
                onChange={(event) => {
                  const selectedFile = event.target.files?.[0] || null
                  if (selectedFile && !selectedFile.type.startsWith('image/')) {
                    setError('Choose an image file for the post cover.')
                    event.target.value = ''
                    return
                  }
                  if (selectedFile && selectedFile.size > 12 * 1024 * 1024) {
                    setError('The selected image is too large. Choose an image under 12 MB.')
                    event.target.value = ''
                    return
                  }
                  setError(null)
                  setCoverFile(selectedFile)
                }}
              />
              <span aria-hidden="true">＋</span>
              <span>{coverFile ? 'Choose a different image' : 'Choose cover image'}</span>
            </label>
            {coverFile && (
              <div className="post-selected-file">
                <span>{coverFile.name}</span>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setCoverFile(null)
                    if (coverInputRef.current) coverInputRef.current.value = ''
                  }}
                >
                  Remove
                </Button>
              </div>
            )}
            <div className={`post-compose-preview${coverPreviewUrl ? ' has-image' : ''}`}>
              {coverPreviewUrl && <img src={coverPreviewUrl} alt="" />}
              <span className="organization-post-cover-shade" aria-hidden="true" />
              <div className="post-compose-preview-copy">
                <strong>{title || 'Your post title'}</strong>
                <p>{body || 'Your description will appear over the cover image.'}</p>
              </div>
            </div>
          </div>
          <label className="public-visibility-toggle"><input type="checkbox" checked={isPublic} onChange={(event) => setIsPublic(event.target.checked)} /><span><strong>Show this update publicly</strong><small>Public updates appear on your friendly space profile. Member information and engagement details stay private.</small></span></label>
          <Button type="submit" loading={saving}>Publish post</Button>
        </form>
      </Card>

      <section className="space-y-4" aria-labelledby="published-updates-heading">
        <h3 id="published-updates-heading">Published updates</h3>
        {loading ? (
          <p className="text-secondary">Loading updates...</p>
        ) : posts.length ? posts.map((post) => (
          <div key={post.id} className="admin-post-row">
            <OrganizationPostCard post={post} userId={userId} onDelete={handleDelete} />
            <div className="admin-post-public-control">
              <span>{post.is_public ? 'Visible on the public space profile' : 'Members only'}</span>
              <Button type="button" size="sm" variant="secondary" onClick={() => togglePublic(post)}>{post.is_public ? 'Make private' : 'Make public'}</Button>
            </div>
          </div>
        )) : (
          <Card className="text-center py-8">
            <p className="text-secondary">No updates have been published yet.</p>
          </Card>
        )}
      </section>
    </div>
  )
}

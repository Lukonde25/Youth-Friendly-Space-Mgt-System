import { useEffect, useState } from 'react'
import { Alert, Button, Card } from '../components'
import { createPost, deletePost, fetchPublishedPosts } from '../services/postService'

export default function PostsPage({ organizationId, userId }) {
  const [posts, setPosts] = useState([])
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const loadPosts = async () => {
    try {
      setError(null)
      const data = await fetchPublishedPosts(organizationId)
      setPosts(data || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPosts()
  }, [organizationId])

  const handleSubmit = async (event) => {
    event.preventDefault()
    try {
      setSaving(true)
      setError(null)
      await createPost(organizationId, userId, { title, body })
      setTitle('')
      setBody('')
      await loadPosts()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (postId) => {
    if (!window.confirm('Delete this centre update?')) return
    try {
      setError(null)
      await deletePost(postId)
      await loadPosts()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Centre news</h2>
        <p className="text-secondary">Publish updates for people who belong to your centre.</p>
      </div>

      {error && <Alert variant="error" onDismiss={() => setError(null)}>{error}</Alert>}

      <Card>
        <h3>Publish an update</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Update title"
            aria-label="Update title"
            required
            maxLength={160}
            className="w-full p-3 border rounded"
          />
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Write your centre update..."
            aria-label="Update text"
            required
            rows="5"
            className="w-full p-3 border rounded"
          />
          <Button type="submit" loading={saving}>Publish update</Button>
        </form>
      </Card>

      <section className="space-y-4" aria-labelledby="published-updates-heading">
        <h3 id="published-updates-heading">Published updates</h3>
        {loading ? (
          <p className="text-secondary">Loading updates...</p>
        ) : posts.length ? posts.map((post) => (
          <Card key={post.id}>
            <div className="flex-between gap-4">
              <h4>{post.title}</h4>
              <Button variant="danger" onClick={() => handleDelete(post.id)}>Delete</Button>
            </div>
            <p className="text-secondary whitespace-pre-wrap">{post.body}</p>
            <p className="text-sm text-tertiary">{new Date(post.created_at).toLocaleString()}</p>
          </Card>
        )) : (
          <Card className="text-center py-8">
            <p className="text-secondary">No updates have been published yet.</p>
          </Card>
        )}
      </section>
    </div>
  )
}

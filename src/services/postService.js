import { supabase } from './supabaseClient'

export const fetchPublishedPosts = async (organizationId) => {
  const { data, error } = await supabase
    .from('organization_posts')
    .select('id, title, body, created_at')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}

export const createPost = async (organizationId, authorId, post) => {
  const { data, error } = await supabase
    .from('organization_posts')
    .insert({
      organization_id: organizationId,
      author_id: authorId,
      title: post.title.trim(),
      body: post.body.trim()
    })
    .select('id, title, body, created_at')
    .single()

  if (error) throw error
  return data
}

export const deletePost = async (postId) => {
  const { error } = await supabase
    .from('organization_posts')
    .delete()
    .eq('id', postId)

  if (error) throw error
}

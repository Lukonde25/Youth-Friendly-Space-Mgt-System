import { supabase } from './supabaseClient'

const POST_COVER_BUCKET = 'organization-post-covers'
const MAX_ORIGINAL_IMAGE_SIZE = 12 * 1024 * 1024
const MAX_COMPRESSED_IMAGE_SIZE = 2 * 1024 * 1024
const SIGNED_URL_LIFETIME_SECONDS = 60 * 60

const compressCoverImage = (file) => new Promise((resolve, reject) => {
  if (!file.type.startsWith('image/')) {
    reject(new Error('Choose an image file for the post cover.'))
    return
  }
  if (file.size > MAX_ORIGINAL_IMAGE_SIZE) {
    reject(new Error('The selected image is too large. Choose an image under 12 MB.'))
    return
  }

  const objectUrl = URL.createObjectURL(file)
  const image = new Image()

  image.onload = () => {
    URL.revokeObjectURL(objectUrl)
    const maxDimension = 1600
    const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))

    const context = canvas.getContext('2d')
    if (!context) {
      reject(new Error('Your browser could not prepare this image. Try a different image.'))
      return
    }

    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    canvas.toBlob((webpBlob) => {
      const useWebp = webpBlob?.type === 'image/webp'
      canvas.toBlob((jpegBlob) => {
        const compressedImage = useWebp ? webpBlob : jpegBlob
        if (!compressedImage) {
          reject(new Error('Your browser could not compress this image. Try a different image.'))
          return
        }
        if (compressedImage.size > MAX_COMPRESSED_IMAGE_SIZE) {
          reject(new Error('The image is still too large after compression. Choose a smaller image.'))
          return
        }

        resolve({
          blob: compressedImage,
          extension: useWebp ? 'webp' : 'jpg',
          contentType: useWebp ? 'image/webp' : 'image/jpeg'
        })
      }, 'image/jpeg', 0.78)
    }, 'image/webp', 0.82)
  }

  image.onerror = () => {
    URL.revokeObjectURL(objectUrl)
    reject(new Error('The selected image could not be read. Try another image.'))
  }
  image.src = objectUrl
})

export const attachSignedCoverUrls = async (items) => Promise.all(items.map(async (item) => {
  if (!item) return item
  if (!item.cover_image_path) return { ...item, cover_image_url: null }

  const { data, error } = await supabase.storage
    .from(POST_COVER_BUCKET)
    .createSignedUrl(item.cover_image_path, SIGNED_URL_LIFETIME_SECONDS)
  if (error) throw error
  return { ...item, cover_image_url: data.signedUrl }
}))

export const uploadCoverImage = async (organizationId, userId, file) => {
  if (!supabase) throw new Error('Supabase is not configured.')
  if (!file) return null

  const compressedImage = await compressCoverImage(file)
  const path = `${organizationId}/${userId}/${crypto.randomUUID()}.${compressedImage.extension}`
  const { error } = await supabase.storage
    .from(POST_COVER_BUCKET)
    .upload(path, compressedImage.blob, {
      contentType: compressedImage.contentType,
      cacheControl: '3600',
      upsert: false
    })
  if (error) throw error
  return path
}

export const removeCoverImage = async (path) => {
  if (!supabase) throw new Error('Supabase is not configured.')
  if (!path) return
  const { error } = await supabase.storage.from(POST_COVER_BUCKET).remove([path])
  if (error) throw error
}

const getPostCounts = async (postId) => {
  const [loves, views] = await Promise.all([
    supabase.from('organization_post_reactions').select('post_id', { count: 'exact', head: true }).eq('post_id', postId),
    supabase.from('organization_post_views').select('post_id', { count: 'exact', head: true }).eq('post_id', postId)
  ])
  if (loves.error) throw loves.error
  if (views.error) throw views.error
  return { loveCount: loves.count || 0, viewCount: views.count || 0 }
}

export const fetchPublishedPosts = async (organizationId, userId) => {
  if (!supabase) throw new Error('Supabase is not configured.')

  const { data, error } = await supabase
    .from('organization_posts')
    .select('id, title, body, cover_image_path, is_public, created_at, organization_post_reactions(count), organization_post_views(count)')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })

  if (error) throw error
  const posts = data || []
  const reactionsResult = posts.length
    ? await supabase
        .from('organization_post_reactions')
        .select('post_id')
        .eq('user_id', userId)
        .in('post_id', posts.map((post) => post.id))
    : { data: [], error: null }
  if (reactionsResult.error) throw reactionsResult.error
  const lovedPostIds = new Set((reactionsResult.data || []).map((reaction) => reaction.post_id))

  const enrichedPosts = posts.map((post) => ({
    ...post,
    love_count: post.organization_post_reactions?.[0]?.count || 0,
    view_count: post.organization_post_views?.[0]?.count || 0,
    loved_by_user: lovedPostIds.has(post.id)
  }))
  return attachSignedCoverUrls(enrichedPosts)
}

export const recordPostView = async (postId, userId) => {
  if (!supabase) throw new Error('Supabase is not configured.')

  const { error } = await supabase
    .from('organization_post_views')
    .upsert({ post_id: postId, user_id: userId }, { onConflict: 'post_id,user_id', ignoreDuplicates: true })
  if (error) throw error
  const { viewCount } = await getPostCounts(postId)
  return viewCount
}

export const togglePostLove = async (postId, userId, loved) => {
  if (!supabase) throw new Error('Supabase is not configured.')

  const result = loved
    ? await supabase
        .from('organization_post_reactions')
        .delete()
        .eq('post_id', postId)
        .eq('user_id', userId)
    : await supabase
        .from('organization_post_reactions')
        .insert({ post_id: postId, user_id: userId, reaction: 'love' })
  if (result.error) throw result.error
  const { loveCount } = await getPostCounts(postId)
  return { loveCount, loved: !loved }
}

export const createPost = async (organizationId, authorId, post) => {
  if (!supabase) throw new Error('Supabase is not configured.')

  const coverImagePath = await uploadCoverImage(organizationId, authorId, post.coverFile)

  const { data, error } = await supabase
    .from('organization_posts')
    .insert({
      organization_id: organizationId,
      author_id: authorId,
      title: post.title.trim(),
      body: post.body.trim(),
      is_public: Boolean(post.isPublic),
      cover_image_path: coverImagePath
    })
    .select('id, title, body, cover_image_path, is_public, created_at')
    .single()

  if (error) {
    if (coverImagePath) {
      try {
        await removeCoverImage(coverImagePath)
      } catch (cleanupError) {
        console.error('Could not remove post cover after post creation failed:', cleanupError)
      }
    }
    throw error
  }

  return (await attachSignedCoverUrls([{ ...data, love_count: 0, view_count: 0, loved_by_user: false }]))[0]
}

export const deletePost = async (postId, coverImagePath) => {
  if (!supabase) throw new Error('Supabase is not configured.')

  const { error } = await supabase
    .from('organization_posts')
    .delete()
    .eq('id', postId)

  if (error) throw error

  if (coverImagePath) {
    try {
      await removeCoverImage(coverImagePath)
    } catch (cleanupError) {
      throw new Error(`The post was deleted, but its cover image could not be removed: ${cleanupError.message}`)
    }
  }
}

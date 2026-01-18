const FALLBACK_THUMBNAIL = 'https://picsum.photos/seed/big-brain-video/640/360'

function ensureThumbnail(video, topicSlug, index) {
  if (video.thumbnail) return video.thumbnail
  const seed = video.id || `${topicSlug}-${index}`
  return `https://picsum.photos/seed/${encodeURIComponent(seed)}/640/360`
}

function scoreVideo(video, currentTags, topicSlug) {
  const tags = video.tags || []
  const overlap = currentTags ? tags.filter((tag) => currentTags.includes(tag)).length : 0
  const topicBoost = tags.includes(topicSlug) ? 1.5 : 0
  const overlapBoost = overlap * 2
  const whyBoost = video.why ? Math.min(video.why.length / 140, 1) : 0
  return overlapBoost + topicBoost + whyBoost
}

export function getVideoRecommendations(course, currentVideoId, topicSlug, count = 5) {
  const videos = course?.videos || []
  if (!videos.length) return []

  const current = videos.find((video) => video.id === currentVideoId) || videos[0]
  const currentTags = current?.tags || []

  const ranked = videos
    .filter((video) => video.id !== current.id)
    .map((video, index) => ({
      ...video,
      thumbnail: ensureThumbnail(video, topicSlug, index) || FALLBACK_THUMBNAIL,
      _score: scoreVideo(video, currentTags, topicSlug),
    }))
    .sort((a, b) => b._score - a._score)
    .slice(0, count)
    .map(({ _score, ...video }) => video)

  return ranked
}

export function normalizeVideo(video, topicSlug, index = 0) {
  return {
    ...video,
    thumbnail: ensureThumbnail(video, topicSlug, index) || FALLBACK_THUMBNAIL,
  }
}

export function normalizeCourseVideos(course, topicSlug) {
  const videos = course?.videos || []
  return videos.map((video, index) => normalizeVideo(video, topicSlug, index))
}

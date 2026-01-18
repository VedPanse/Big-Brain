// YouTube Video Service - Real API with mock fallback

const API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY
const BASE_URL = 'https://www.googleapis.com/youtube/v3'

const TOPIC_KEYWORDS = {
  calculus: 'calculus derivatives integrals limits',
  'data-structures': 'data structures arrays linked lists trees',
  'machine-learning': 'machine learning neural networks deep learning',
}

const MOCK_VIDEOS_DB = {
  calculus: [
    { id: '1', title: 'Limits Explained', description: 'Understanding limits.', channel: 'Professor Leonard', thumbnail: 'https://picsum.photos/seed/calc1/480/360', url: 'https://youtube.com/watch?v=1', duration: '8:42', views: 245000, tags: ['limits', 'calculus'] },
    { id: '2', title: 'Derivatives Basics', description: 'Derivative intuition.', channel: '3Blue1Brown', thumbnail: 'https://picsum.photos/seed/calc2/480/360', url: 'https://youtube.com/watch?v=2', duration: '12:45', views: 1200000, tags: ['derivatives', 'calculus'] },
    { id: '3', title: 'Chain Rule', description: 'Master the chain rule.', channel: 'Khan Academy', thumbnail: 'https://picsum.photos/seed/calc3/480/360', url: 'https://youtube.com/watch?v=3', duration: '10:32', views: 890000, tags: ['chain rule', 'calculus'] },
    { id: '4', title: 'Integrals Overview', description: 'Integration explained.', channel: 'Professor Leonard', thumbnail: 'https://picsum.photos/seed/calc4/480/360', url: 'https://youtube.com/watch?v=4', duration: '11:05', views: 720000, tags: ['integrals', 'calculus'] },
    { id: '5', title: 'Fundamental Theorem', description: 'Connecting derivatives and integrals.', channel: 'Khan Academy', thumbnail: 'https://picsum.photos/seed/calc5/480/360', url: 'https://youtube.com/watch?v=5', duration: '13:40', views: 550000, tags: ['integrals', 'derivatives', 'calculus'] },
  ],
  'data-structures': [
    { id: 'd1', title: 'Arrays Explained', description: 'Memory layout.', channel: 'Back to Back SWE', thumbnail: 'https://picsum.photos/seed/ds1/480/360', url: 'https://youtube.com/watch?v=d1', duration: '7:30', views: 380000, tags: ['arrays', 'data structures'] },
    { id: 'd2', title: 'Linked Lists', description: 'Vs arrays.', channel: 'CS50', thumbnail: 'https://picsum.photos/seed/ds2/480/360', url: 'https://youtube.com/watch?v=d2', duration: '8:45', views: 920000, tags: ['linked lists', 'data structures'] },
    { id: 'd3', title: 'Trees', description: 'Tree structures.', channel: 'Kunal Kushwaha', thumbnail: 'https://picsum.photos/seed/ds3/480/360', url: 'https://youtube.com/watch?v=d3', duration: '22:15', views: 450000, tags: ['trees', 'data structures'] },
    { id: 'd4', title: 'Binary Search Trees', description: 'BST explained.', channel: 'Back to Back SWE', thumbnail: 'https://picsum.photos/seed/ds4/480/360', url: 'https://youtube.com/watch?v=d4', duration: '16:50', views: 620000, tags: ['bst', 'data structures'] },
  ],
  'machine-learning': [
    { id: 'm1', title: 'Linear Regression', description: 'ML basics.', channel: '3Blue1Brown', thumbnail: 'https://picsum.photos/seed/ml1/480/360', url: 'https://youtube.com/watch?v=m1', duration: '14:50', views: 2300000, tags: ['machine learning', 'regression'] },
    { id: 'm2', title: 'Gradient Descent', description: 'Optimization.', channel: 'Andrew Ng', thumbnail: 'https://picsum.photos/seed/ml2/480/360', url: 'https://youtube.com/watch?v=m2', duration: '11:30', views: 1800000, tags: ['machine learning', 'gradient descent'] },
    { id: 'm3', title: 'Backpropagation', description: 'Neural networks.', channel: '3Blue1Brown', thumbnail: 'https://picsum.photos/seed/ml3/480/360', url: 'https://youtube.com/watch?v=m3', duration: '15:50', views: 3200000, tags: ['machine learning', 'neural networks'] },
    { id: 'm4', title: 'Attention Mechanism', description: 'Transformers.', channel: 'StatQuest', thumbnail: 'https://picsum.photos/seed/ml4/480/360', url: 'https://youtube.com/watch?v=m4', duration: '13:20', views: 980000, tags: ['machine learning', 'attention'] },
  ],
}

export async function searchYoutubeVideos(topic, count = 8) {
  if (!API_KEY || API_KEY === 'YOUR_YOUTUBE_API_KEY_HERE') {
    console.warn('YouTube API key not configured. Using mock data.')
    return getMockVideos(topic, count)
  }

  try {
    const searchQuery = TOPIC_KEYWORDS[topic] || topic
    const response = await fetch(
      `${BASE_URL}/search?part=snippet&q=${encodeURIComponent(searchQuery)}&type=video&maxResults=${count}&key=${API_KEY}&relevanceLanguage=en&order=relevance`
    )

    if (!response.ok) throw new Error('Search failed')

    const data = await response.json()
    const videoIds = data.items.map((item) => item.id.videoId)

    const detailsResponse = await fetch(
      `${BASE_URL}/videos?part=snippet,statistics,contentDetails&id=${videoIds.join(',')}&key=${API_KEY}`
    )

    if (!detailsResponse.ok) throw new Error('Details failed')

    const detailsData = await detailsResponse.json()

    return detailsData.items.map((video) => ({
      id: video.id,
      title: video.snippet.title,
      description: video.snippet.description,
      channel: video.snippet.channelTitle,
      thumbnail: video.snippet.thumbnails.medium.url,
      url: `https://www.youtube.com/watch?v=${video.id}`,
      duration: parseDuration(video.contentDetails.duration),
      views: parseInt(video.statistics.viewCount || 0),
      tags: extractTags(video.snippet.tags || []),
    }))
  } catch (error) {
    console.error('YouTube API error:', error)
    return getMockVideos(topic, count)
  }
}

export async function getVideosByIds(videoIds) {
  if (!API_KEY || API_KEY === 'YOUR_YOUTUBE_API_KEY_HERE') {
    return getMockVideosById(videoIds)
  }

  try {
    const response = await fetch(
      `${BASE_URL}/videos?part=snippet,statistics,contentDetails&id=${videoIds.join(',')}&key=${API_KEY}`
    )

    if (!response.ok) return []

    const data = await response.json()
    return data.items.map((video) => ({
      id: video.id,
      title: video.snippet.title,
      description: video.snippet.description,
      channel: video.snippet.channelTitle,
      thumbnail: video.snippet.thumbnails.medium.url,
      url: `https://www.youtube.com/watch?v=${video.id}`,
      duration: parseDuration(video.contentDetails.duration),
      views: parseInt(video.statistics.viewCount || 0),
      tags: extractTags(video.snippet.tags || []),
    }))
  } catch {
    return []
  }
}

export function calculateVideoSimilarity(video1, video2) {
  if (!video1 || !video2) return 0
  const tags1 = new Set(video1.tags || [])
  const tags2 = new Set(video2.tags || [])
  const intersection = [...tags1].filter((tag) => tags2.has(tag)).length
  const union = new Set([...tags1, ...tags2]).size
  const tagSimilarity = union > 0 ? intersection / union : 0
  const channelBonus = video1.channel === video2.channel ? 0.15 : 0
  return Math.min(1, tagSimilarity + channelBonus)
}

export function recommendVideos(currentVideo, allVideos, viewedVideoIds = [], topicVideos = null, count = 6) {
  const availableVideos = topicVideos || allVideos
  
  // First, try to get unviewed videos (excluding current)
  const unviewedCandidates = availableVideos.filter((video) => {
    if (video.id === currentVideo.id) return false
    if (viewedVideoIds.includes(video.id)) return false
    return true
  })

  const scoredUnviewed = unviewedCandidates.map((video) => ({
    ...video,
    _score: calculateVideoSimilarity(currentVideo, video),
  }))

  const sortedUnviewed = scoredUnviewed.sort((a, b) => b._score - a._score)
  
  // If we have enough unviewed videos, return them
  if (sortedUnviewed.length >= count) {
    return sortedUnviewed
      .slice(0, count)
      .map(({ _score, ...video }) => video)
  }
  
  // Otherwise, supplement with viewed videos to reach the requested count
  const viewedCandidates = availableVideos.filter((video) => {
    if (video.id === currentVideo.id) return false
    if (!viewedVideoIds.includes(video.id)) return false
    return true
  })

  const scoredViewed = viewedCandidates.map((video) => ({
    ...video,
    _score: calculateVideoSimilarity(currentVideo, video),
  }))

  const sortedViewed = scoredViewed.sort((a, b) => b._score - a._score)
  
  // Combine unviewed + viewed to reach the count
  const combined = [...sortedUnviewed, ...sortedViewed]
    .slice(0, count)
    .map(({ _score, ...video }) => video)
  
  return combined
}

function parseDuration(duration) {
  const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/)
  const hours = parseInt(match?.[1] || 0)
  const minutes = parseInt(match?.[2] || 0)
  const seconds = parseInt(match?.[3] || 0)
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

function extractTags(tags) {
  return tags.slice(0, 4).map((tag) => tag.toLowerCase())
}

function getMockVideos(topic, count) {
  const db = MOCK_VIDEOS_DB[topic] || []
  return db.slice(0, count)
}

function getMockVideosById(videoIds) {
  const allVideos = Object.values(MOCK_VIDEOS_DB).flat()
  return videoIds.map((id) => allVideos.find((v) => v.id === id)).filter(Boolean)
}

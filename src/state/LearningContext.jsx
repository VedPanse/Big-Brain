import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { courseNodes } from '../data/mockCourse'

const LearningContext = createContext(null)

const STORAGE_KEY = 'big-brain-state'

const emptyMastery = courseNodes.reduce((acc, node) => {
  acc[node.title] = 0
  return acc
}, {})

const defaultState = {
  masteryMap: emptyMastery,
  fingerprint: [],
  answers: [],
  currentNodeId: courseNodes[0]?.id || null,
  diagnosticCompleted: false,
  viewedVideosByTopic: {}, // topic -> [videoIds]
}

export function LearningProvider({ children }) {
  const [state, setState] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      return stored ? { ...defaultState, ...JSON.parse(stored) } : defaultState
    } catch {
      return defaultState
    }
  })

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [state])

  const value = useMemo(() => {
    const completeDiagnostic = ({ masteryMap, fingerprint, answers }) => {
      setState((prev) => ({
        ...prev,
        masteryMap,
        fingerprint,
        answers,
        diagnosticCompleted: true,
      }))
    }

    const setCurrentNode = (nodeId) => {
      setState((prev) => ({ ...prev, currentNodeId: nodeId }))
    }

    const updateMastery = (nodeTitle, nextScore) => {
      setState((prev) => ({
        ...prev,
        masteryMap: { ...prev.masteryMap, [nodeTitle]: nextScore },
      }))
    }

    const resetLearning = () => {
      setState(defaultState)
    }

    const markVideoViewed = (topic, videoId) => {
      setState((prev) => {
        const topicViews = prev.viewedVideosByTopic[topic] || []
        if (topicViews.includes(videoId)) return prev // Already tracked
        return {
          ...prev,
          viewedVideosByTopic: {
            ...prev.viewedVideosByTopic,
            [topic]: [...topicViews, videoId],
          },
        }
      })
    }

    const unmarkVideoViewed = (topic, videoId) => {
      setState((prev) => {
        const topicViews = prev.viewedVideosByTopic[topic] || []
        return {
          ...prev,
          viewedVideosByTopic: {
            ...prev.viewedVideosByTopic,
            [topic]: topicViews.filter((id) => id !== videoId),
          },
        }
      })
    }

    const getViewedVideosForTopic = (topic) => {
      return state.viewedVideosByTopic[topic] || []
    }

    return {
      ...state,
      courseNodes,
      completeDiagnostic,
      setCurrentNode,
      updateMastery,
      resetLearning,
      markVideoViewed,
      unmarkVideoViewed,
      getViewedVideosForTopic,
    }
  }, [state])

  return <LearningContext.Provider value={value}>{children}</LearningContext.Provider>
}

export function useLearning() {
  const context = useContext(LearningContext)
  if (!context) {
    throw new Error('useLearning must be used within LearningProvider')
  }
  return context
}

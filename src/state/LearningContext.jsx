import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
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
  quizzesBySource: {}, // sourceKey -> [quizzes with metadata]
  learnerProfile: null,
  learnerConceptState: {},
  prereqEdges: [],
  learnerContentState: {},
  courseCatalog: [],
  learnerUpdatedAt: null,
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

  const refreshLearnerProfile = useCallback(async () => {
    const response = await fetch('/api/learner/profile')
    if (!response.ok) return null
    const data = await response.json()
    setState((prev) => {
      const conceptState = data.learner_concept_state || {}
      const masteryMap = { ...prev.masteryMap }
      Object.values(conceptState).forEach((concept) => {
        if (!concept?.name) return
        masteryMap[concept.name] = concept.mastery ?? masteryMap[concept.name] ?? 0
      })
      return {
        ...prev,
        masteryMap,
        learnerProfile: data.learner_profile || null,
        learnerConceptState: conceptState,
        prereqEdges: data.prereq_edges || [],
        learnerContentState: data.learner_content_state || {},
        courseCatalog: data.course_catalog || [],
        learnerUpdatedAt: data.learner_profile?.updatedAt || new Date().toISOString(),
      }
    })
    return data
  }, [])

  useEffect(() => {
    refreshLearnerProfile().catch(() => {})
  }, [refreshLearnerProfile])

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
        const topicViews = prev.viewedVideosByTopic?.[topic] || []
        if (topicViews.includes(videoId)) return prev
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
        const topicViews = prev.viewedVideosByTopic?.[topic] || []
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
      return state.viewedVideosByTopic?.[topic] || []
    }

    const storeQuizWithSource = (sourceType, sourceId, sourceMetadata, quizData) => {
      setState((prev) => {
        const sourceKey = `${sourceType}-${sourceId}`
        const quizWithSource = {
          ...quizData,
          sourceType,
          sourceId,
          sourceMetadata,
          createdAt: Date.now(),
        }
        const existingQuizzes = prev.quizzesBySource?.[sourceKey] || []
        return {
          ...prev,
          quizzesBySource: {
            ...prev.quizzesBySource,
            [sourceKey]: [quizWithSource, ...existingQuizzes],
          },
        }
      })
    }

    const getQuizzesForSource = (sourceType, sourceId) => {
      const sourceKey = `${sourceType}-${sourceId}`
      return state.quizzesBySource?.[sourceKey] || []
    }

    const getAllQuizzes = () => {
      return Object.values(state.quizzesBySource || {}).flat()
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
      storeQuizWithSource,
      getQuizzesForSource,
      getAllQuizzes,
      refreshLearnerProfile,
    }
  }, [state, refreshLearnerProfile])

  return <LearningContext.Provider value={value}>{children}</LearningContext.Provider>
}

export function useLearning() {
  const context = useContext(LearningContext)
  if (!context) {
    throw new Error('useLearning must be used within LearningProvider')
  }
  return context
}

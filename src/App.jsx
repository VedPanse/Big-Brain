import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import Landing from './pages/Landing'
import Learn from './pages/Learn'
import Course from './pages/Course'
import Canvas from './pages/Canvas'
import Diagnostic from './pages/Diagnostic'
import NotFound from './pages/NotFound'
import CognitiveFingerprintPage from './pages/CognitiveFingerprint'

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6 },
}

function PageTransition({ children }) {
  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ type: 'spring', stiffness: 120, damping: 18 }}
    >
      {children}
    </motion.div>
  )
}

function App() {
  const location = useLocation()

  return (
    <div className="app-shell font-body">
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route
            path="/"
            element={
              <PageTransition>
                <Landing />
              </PageTransition>
            }
          />
          <Route
            path="/learn"
            element={
              <PageTransition>
                <Learn />
              </PageTransition>
            }
          />
          <Route
            path="/graph"
            element={
              <PageTransition>
                <Learn />
              </PageTransition>
            }
          />
          <Route
            path="/course/:topic"
            element={
              <PageTransition>
                <Course />
              </PageTransition>
            }
          />
          <Route
            path="/canvas/:topic"
            element={
              <PageTransition>
                <Canvas />
              </PageTransition>
            }
          />
          <Route
            path="/diagnostic"
            element={
              <PageTransition>
                <Diagnostic />
              </PageTransition>
            }
          />
          <Route
            path="/cognitive-fingerprint"
            element={
              <PageTransition>
                <CognitiveFingerprintPage />
              </PageTransition>
            }
          />
          <Route
            path="*"
            element={
              <PageTransition>
                <NotFound />
              </PageTransition>
            }
          />
        </Routes>
      </AnimatePresence>
    </div>
  )
}

export default App

import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import Onboarding from './pages/Onboarding'
import Diagnostic from './pages/Diagnostic'
import Graph from './pages/Graph'
import Canvas from './pages/Canvas'
import TeachBack from './pages/TeachBack'

const pageVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
}

function PageTransition({ children }) {
  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ type: 'spring', stiffness: 120, damping: 18 }}
      className="relative z-10"
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
                <Onboarding />
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
            path="/graph"
            element={
              <PageTransition>
                <Graph />
              </PageTransition>
            }
          />
          <Route
            path="/canvas/:nodeId"
            element={
              <PageTransition>
                <Canvas />
              </PageTransition>
            }
          />
          <Route
            path="/teach/:nodeId"
            element={
              <PageTransition>
                <TeachBack />
              </PageTransition>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AnimatePresence>
    </div>
  )
}

export default App

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { LearningProvider } from './state/LearningContext.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <ErrorBoundary>
        <LearningProvider>
          <App />
        </LearningProvider>
      </ErrorBoundary>
    </BrowserRouter>
  </StrictMode>,
)

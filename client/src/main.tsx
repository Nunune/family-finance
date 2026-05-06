import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import ErrorBoundary from './components/ErrorBoundary'
import './index.css'

const savedScale = localStorage.getItem('fontScale')
if (savedScale) {
  const sizes: Record<string, string> = { sm: '14px', md: '16px', lg: '18px', xl: '20px' }
  document.documentElement.style.fontSize = sizes[savedScale] ?? '16px'
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
)

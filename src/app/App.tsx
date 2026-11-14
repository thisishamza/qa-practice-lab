import { BrowserRouter, Link, Route, Routes } from 'react-router-dom'
import { HomePage } from './HomePage'
import { NotFoundPage } from './NotFoundPage'

export function App() {
  return (
    <BrowserRouter>
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <div className="site-shell">
        <header className="site-header">
          <Link className="brand" to="/" aria-label="QA Practice Lab home">
            <span className="brand-mark" aria-hidden="true">
              QA
            </span>
            <span>QA Practice Lab</span>
          </Link>
          <span className="phase-badge">Phase 1 · Foundation</span>
        </header>

        <main id="main-content" className="site-main" tabIndex={-1}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </main>

        <footer className="site-footer">
          <p>Built in small, verifiable phases. No AI service is required at runtime.</p>
          <p className="footer-meta">v0.1.0</p>
        </footer>
      </div>
    </BrowserRouter>
  )
}

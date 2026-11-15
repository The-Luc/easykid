import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import './components.css'
import './sheet.css'
import './pages.css'
import './cloud.css'
import TabBar from './components/TabBar'
import Today from './pages/Today'
import History from './pages/History'
import Settings from './pages/Settings'
import Storage from './pages/Storage'

// The chart pages pull in the charting library, so load them on demand
const Stats = lazy(() => import('./pages/Stats'))
const Growth = lazy(() => import('./pages/Growth'))

export default function App() {
  return (
    <BrowserRouter>
      <main className="app">
        <Suspense fallback={<p className="muted">Loading…</p>}>
          <Routes>
            <Route path="/" element={<Today />} />
            <Route path="/history" element={<History />} />
            <Route path="/stats" element={<Stats />} />
            <Route path="/growth" element={<Growth />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/storage" element={<Storage />} />
          </Routes>
        </Suspense>
      </main>
      <TabBar />
    </BrowserRouter>
  )
}

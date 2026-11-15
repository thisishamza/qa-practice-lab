import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AppShell } from '../components/layout/AppShell'
import { ThemeProvider } from '../components/ui/ThemeProvider'
import { AboutPage } from '../pages/AboutPage'
import { DashboardPage } from '../pages/DashboardPage'
import { GuidesPage } from '../pages/GuidesPage'
import { GuideDetailPage } from '../pages/GuideDetailPage'
import { NotFoundPage } from '../pages/NotFoundPage'
import { PracticePage } from '../pages/PracticePage'
import { ProgressPage } from '../pages/ProgressPage'
import { ScenarioDetailPage } from '../pages/ScenarioDetailPage'
import { ScenariosPage } from '../pages/ScenariosPage'
import { ShopPage } from '../pages/ShopPage'
import { ShopProductPage } from '../pages/ShopProductPage'
import { TracksPage } from '../pages/TracksPage'
import { TrackDetailPage } from '../pages/TrackDetailPage'

export function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<DashboardPage />} />
            <Route path="tracks" element={<TracksPage />} />
            <Route path="tracks/:trackId" element={<TrackDetailPage />} />
            <Route path="scenarios" element={<ScenariosPage />} />
            <Route path="scenarios/:scenarioId" element={<ScenarioDetailPage />} />
            <Route path="guides" element={<GuidesPage />} />
            <Route path="guides/:guideId" element={<GuideDetailPage />} />
            <Route path="progress" element={<ProgressPage />} />
            <Route path="practice" element={<PracticePage />} />
            <Route path="shop" element={<ShopPage />} />
            <Route path="shop/products/:slug" element={<ShopProductPage />} />
            <Route path="about" element={<AboutPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  )
}

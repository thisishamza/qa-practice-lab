import { lazy } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { CartProvider } from '../features/cart/CartContext'
import { AuthProvider } from '../features/auth/AuthContext'
import { PracticeSessionProvider } from '../features/practice/PracticeSessionProvider'
import { AppShell } from '../components/layout/AppShell'
import { ThemeProvider } from '../components/ui/ThemeProvider'
import { DashboardPage } from '../pages/DashboardPage'

// Route-level code splitting: every non-index page is its own chunk, fetched
// on first navigation instead of up front. The dashboard stays eager because
// it is the landing route; everything behind the shell is deferrable.
const ApiReferencePage = lazy(() =>
  import('../pages/ApiReferencePage').then((m) => ({ default: m.ApiReferencePage })),
)
const ApiLabPage = lazy(() =>
  import('../pages/ApiLabPage').then((m) => ({ default: m.ApiLabPage })),
)
const DatabaseHubPage = lazy(() =>
  import('../pages/DatabaseHubPage').then((m) => ({ default: m.DatabaseHubPage })),
)
const DatabasePlaygroundPage = lazy(() =>
  import('../pages/DatabasePlaygroundPage').then((m) => ({ default: m.DatabasePlaygroundPage })),
)
const CartPage = lazy(() => import('../pages/CartPage').then((m) => ({ default: m.CartPage })))
const CheckoutPage = lazy(() => import('../pages/CheckoutPage').then((m) => ({ default: m.CheckoutPage })))
const OrderConfirmationPage = lazy(() =>
  import('../pages/OrderConfirmationPage').then((m) => ({ default: m.OrderConfirmationPage })),
)
const LoginPage = lazy(() => import('../pages/LoginPage').then((m) => ({ default: m.LoginPage })))
const AccountPage = lazy(() => import('../pages/AccountPage').then((m) => ({ default: m.AccountPage })))
const AccountOrdersPage = lazy(() =>
  import('../pages/AccountOrdersPage').then((m) => ({ default: m.AccountOrdersPage })),
)
const AccountOrderDetailPage = lazy(() =>
  import('../pages/AccountOrderDetailPage').then((m) => ({ default: m.AccountOrderDetailPage })),
)
const AdminInventoryPage = lazy(() =>
  import('../pages/AdminInventoryPage').then((m) => ({ default: m.AdminInventoryPage })),
)
const AboutPage = lazy(() => import('../pages/AboutPage').then((m) => ({ default: m.AboutPage })))
const GuidesPage = lazy(() => import('../pages/GuidesPage').then((m) => ({ default: m.GuidesPage })))
const GuideDetailPage = lazy(() =>
  import('../pages/GuideDetailPage').then((m) => ({ default: m.GuideDetailPage })),
)
const NotFoundPage = lazy(() => import('../pages/NotFoundPage').then((m) => ({ default: m.NotFoundPage })))
const PracticePage = lazy(() => import('../pages/PracticePage').then((m) => ({ default: m.PracticePage })))
const ProgressPage = lazy(() => import('../pages/ProgressPage').then((m) => ({ default: m.ProgressPage })))
const ScenarioDetailPage = lazy(() =>
  import('../pages/ScenarioDetailPage').then((m) => ({ default: m.ScenarioDetailPage })),
)
const ScenariosPage = lazy(() => import('../pages/ScenariosPage').then((m) => ({ default: m.ScenariosPage })))
const ShopPage = lazy(() => import('../pages/ShopPage').then((m) => ({ default: m.ShopPage })))
const ShopProductPage = lazy(() =>
  import('../pages/ShopProductPage').then((m) => ({ default: m.ShopProductPage })),
)
const TracksPage = lazy(() => import('../pages/TracksPage').then((m) => ({ default: m.TracksPage })))
const TrackDetailPage = lazy(() =>
  import('../pages/TrackDetailPage').then((m) => ({ default: m.TrackDetailPage })),
)

export function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <CartProvider>
          <AuthProvider>
            <PracticeSessionProvider>
            <Routes>
              <Route element={<AppShell />}>
                <Route index element={<DashboardPage />} />
                <Route path="tracks" element={<TracksPage />} />
                <Route path="tracks/:trackId" element={<TrackDetailPage />} />
                <Route path="scenarios" element={<ScenariosPage />} />
                <Route path="scenarios/:scenarioId" element={<ScenarioDetailPage />} />
                <Route path="guides" element={<GuidesPage />} />
                <Route path="guides/:guideId" element={<GuideDetailPage />} />
                <Route path="api-reference" element={<ApiReferencePage />} />
                <Route path="api-lab" element={<ApiLabPage />} />
                <Route path="database" element={<DatabaseHubPage />} />
                <Route path="database/playground" element={<DatabasePlaygroundPage />} />
                <Route path="progress" element={<ProgressPage />} />
                <Route path="practice" element={<PracticePage />} />
                <Route path="shop" element={<ShopPage />} />
                <Route path="shop/products/:slug" element={<ShopProductPage />} />
                <Route path="cart" element={<CartPage />} />
                <Route path="checkout" element={<CheckoutPage />} />
                <Route path="orders/:reference" element={<OrderConfirmationPage />} />
                <Route path="login" element={<LoginPage />} />
                <Route path="account" element={<AccountPage />} />
                <Route path="account/orders" element={<AccountOrdersPage />} />
                <Route path="admin/inventory" element={<AdminInventoryPage />} />
                <Route path="account/orders/:reference" element={<AccountOrderDetailPage />} />
                <Route path="about" element={<AboutPage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Route>
            </Routes>
            </PracticeSessionProvider>
          </AuthProvider>
        </CartProvider>
      </BrowserRouter>
    </ThemeProvider>
  )
}

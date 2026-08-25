import { QueryClientProvider } from '@tanstack/react-query'
import { HashRouter, BrowserRouter, Route, Routes } from 'react-router-dom'
import { WagmiProvider } from 'wagmi'
import { Layout } from './components/Layout'
import { I18nProvider } from './i18n'
import AboutPage from './pages/AboutPage'
import CreatePage from './pages/CreatePage'
import NotFoundPage from './pages/NotFoundPage'
import PendingPage from './pages/PendingPage'
import ResolvePage from './pages/ResolvePage'
import { queryClient, wagmiConfig } from './wallet'

const Router = import.meta.env.VITE_HASH_ROUTER === '1' ? HashRouter : BrowserRouter

export default function App() {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <I18nProvider>
          <Router>
            <Layout>
              <Routes>
                <Route path="/" element={<CreatePage />} />
                <Route path="/about" element={<AboutPage />} />
                <Route path="/pending/:prefix/:txHash" element={<PendingPage />} />
                <Route path="/c/:chainId/:id" element={<ResolvePage mode="chainId" />} />
                <Route path="/:prefix/:id" element={<ResolvePage mode="prefix" />} />
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </Layout>
          </Router>
        </I18nProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}

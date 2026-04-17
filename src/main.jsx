import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ClerkProvider, useAuth } from '@clerk/clerk-react'
import { ConvexProviderWithClerk } from 'convex/react-clerk'
import { ConvexReactClient } from 'convex/react'
import './index.css'
import App from './App.jsx'
import LandingPage from './pages/LandingPage.jsx'

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const CONVEX_URL = import.meta.env.VITE_CONVEX_URL;

if (!PUBLISHABLE_KEY) {
  console.warn('Previewing local frontend. Clerk Auth is disabled.');
}

const convex = CONVEX_URL ? new ConvexReactClient(CONVEX_URL) : null

function Providers({ children }) {
  if (convex) {
    return (
      <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
        <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
          <BrowserRouter>{children}</BrowserRouter>
        </ConvexProviderWithClerk>
      </ClerkProvider>
    )
  }

  // Fallback: Clerk only (no Convex URL configured yet)
  return (
    <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
      <BrowserRouter>{children}</BrowserRouter>
    </ClerkProvider>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {PUBLISHABLE_KEY ? (
      <Providers>
        <App />
      </Providers>
    ) : (
      <LandingPage />
    )}
  </StrictMode>,
)

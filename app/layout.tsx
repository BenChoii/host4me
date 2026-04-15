import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { ClerkProvider } from '@clerk/nextjs'
import { dark } from '@clerk/themes'
import { ConvexClientProvider } from './convex-client-provider'
import { Toaster } from '@/components/ui/toaster'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Host4Me - AI-Powered Property Management',
  description: 'Meet Alfred, your AI property manager. Host4Me automates guest communication, learns your hosting style, and manages your Airbnb & VRBO listings 24/7.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ClerkProvider appearance={{ baseTheme: dark }}>
      <html lang="en">
        <body className={inter.className}>
          <ConvexClientProvider>
            {children}
          </ConvexClientProvider>
          <Toaster />
        </body>
      </html>
    </ClerkProvider>
  )
}

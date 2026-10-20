import type { Metadata, Viewport } from 'next'
import PwaRegister from '@/components/pwa/PwaRegister'
import '@/styles/theme.css'
import '@/styles/globals.css'

export const metadata: Metadata = {
  title: 'NTG Reach',
  description: 'Sales CRM for NTG Reach — CRM Platform',
  applicationName: 'NTG Reach',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'NTG Reach',
  },
  icons: {
    apple: '/icons/apple-touch-icon.png',
  },
  formatDetection: {
    telephone: false,
  },
}

export const viewport: Viewport = {
  themeColor: '#d10707',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        {children}
        <PwaRegister />
      </body>
    </html>
  )
}

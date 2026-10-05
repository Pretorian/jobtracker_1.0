import './globals.css'
import A11yAudit from '@/components/A11yAudit'

export const metadata = {
  title: 'JobTracker - AI-Powered Job Application Tracker',
  description: 'Track your job search with AI-powered parsing and follow-up reminders',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}
        <A11yAudit />
      </body>
    </html>
  )
}

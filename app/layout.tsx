import type { Metadata } from 'next'
import '../src/index.css'

export const metadata: Metadata = {
  title: 'Lead Reports',
  description: 'Automated Lead Report Generation',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}

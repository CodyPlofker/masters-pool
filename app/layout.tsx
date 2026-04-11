import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Masters Pool 2026 — Cody vs Jeremy',
  description: 'Masters golf pool tracker',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col" style={{ backgroundColor: 'var(--masters-cream)' }}>
        <header style={{ backgroundColor: 'var(--masters-green)' }} className="px-4 py-3">
          <div className="max-w-5xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">⛳</span>
              <div>
                <div className="text-white font-bold text-lg leading-tight" style={{ fontFamily: 'Georgia, serif' }}>
                  Masters Pool 2026
                </div>
                <div className="text-xs" style={{ color: 'var(--masters-gold)' }}>
                  Cody vs Jeremy · April 10–13
                </div>
              </div>
            </div>
            <nav className="flex gap-4 text-sm">
              <a href="/" className="text-white hover:opacity-80 transition-opacity font-medium">
                Standings
              </a>
              <a href="/draft" className="text-white hover:opacity-80 transition-opacity font-medium">
                Draft
              </a>
              <a href="/game" className="text-white hover:opacity-80 transition-opacity font-medium">
                Family Game
              </a>
              <a href="/admin" className="opacity-50 text-white hover:opacity-70 transition-opacity text-xs pt-0.5">
                Admin
              </a>
            </nav>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="text-center py-4 text-xs text-gray-400" style={{ borderTop: '1px solid #e0d9cc' }}>
          Live scores via ESPN · Refreshes every 60s during tournament
        </footer>
      </body>
    </html>
  )
}

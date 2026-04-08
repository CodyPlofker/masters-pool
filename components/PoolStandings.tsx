'use client'

import { useEffect, useState, useCallback } from 'react'
import { ScoreBadge } from './ScoreBadge'
import { TIER_LABELS } from '@/lib/supabase'

type PoolData = {
  pool: {
    cody: { score: number; picks: any[] }
    jeremy: { score: number; picks: any[] }
  }
  updatedAt: string
}

export function PoolStandings() {
  const [data, setData] = useState<PoolData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const fetchScores = useCallback(async () => {
    try {
      const res = await fetch('/api/scores', { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to fetch')
      const json = await res.json()
      setData(json)
      setLastUpdated(new Date())
      setError(null)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchScores()
    const interval = setInterval(fetchScores, 60_000)
    return () => clearInterval(interval)
  }, [fetchScores])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="text-4xl mb-3 animate-pulse">⛳</div>
          <p className="text-gray-500">Loading scores...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-10 text-red-600">
        <p>Error loading scores: {error}</p>
        <button onClick={fetchScores} className="mt-3 underline text-sm">Try again</button>
      </div>
    )
  }

  if (!data) return null

  const { cody, jeremy } = data.pool
  const codyWinning = cody.score > jeremy.score
  const tied = cody.score === jeremy.score
  const noPicks = cody.picks.length === 0 && jeremy.picks.length === 0

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">

      {/* Scoreboard */}
      <div className="rounded-2xl overflow-hidden shadow-md" style={{ border: '1px solid #d4c9b0' }}>
        <div className="text-white text-center py-2 text-xs font-semibold tracking-widest uppercase"
          style={{ backgroundColor: 'var(--masters-green)' }}>
          Pool Standings
        </div>
        <div className="grid grid-cols-2 divide-x" style={{ backgroundColor: '#fff', borderColor: '#d4c9b0' }}>
          {(['cody', 'jeremy'] as const).map((person) => {
            const personData = data.pool[person]
            const isWinning = person === 'cody' ? codyWinning : !codyWinning
            const label = person === 'cody' ? 'Cody' : 'Jeremy'

            return (
              <div
                key={person}
                className={`py-6 px-4 text-center transition-all ${tied ? '' : isWinning ? 'bg-green-50' : ''}`}
              >
                <div className="text-sm font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--masters-green)' }}>
                  {label}
                  {!tied && isWinning && (
                    <span className="ml-2 text-xs" style={{ color: 'var(--masters-gold)' }}>▲ Leading</span>
                  )}
                </div>
                <div
                  className="text-5xl font-bold font-mono leading-none"
                  style={{ color: personData.score > 0 ? 'var(--score-red)' : 'var(--score-black)', fontFamily: 'Georgia, serif' }}
                >
                  {personData.score > 0 ? `+${personData.score}` : personData.score === 0 ? '0' : personData.score}
                </div>
                <div className="text-xs text-gray-400 mt-1">under par</div>
                <div className="text-xs text-gray-500 mt-2">{personData.picks.length} / 8 picks</div>
              </div>
            )
          })}
        </div>
        {tied && noPicks && (
          <div className="text-center py-2 text-xs text-gray-400 bg-white border-t" style={{ borderColor: '#d4c9b0' }}>
            Draft hasn't started yet · <a href="/draft" className="underline" style={{ color: 'var(--masters-green)' }}>Go to Draft</a>
          </div>
        )}
        {tied && !noPicks && (
          <div className="text-center py-2 text-xs text-gray-400 bg-white border-t" style={{ borderColor: '#d4c9b0' }}>
            Tied
          </div>
        )}
      </div>

      {/* Picks tables */}
      <div className="grid md:grid-cols-2 gap-5">
        {(['cody', 'jeremy'] as const).map((person) => {
          const personData = data.pool[person]
          const label = person === 'cody' ? 'Cody' : 'Jeremy'

          return (
            <div key={person} className="rounded-xl overflow-hidden shadow-sm" style={{ border: '1px solid #d4c9b0' }}>
              <div className="px-4 py-2.5 flex items-center justify-between"
                style={{ backgroundColor: 'var(--masters-green)' }}>
                <span className="text-white font-bold text-sm">{label}'s Team</span>
                <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded"
                  style={{ backgroundColor: 'var(--masters-gold)', color: '#1a1a1a' }}>
                  {personData.score > 0 ? `+${personData.score}` : personData.score} pts
                </span>
              </div>

              <div className="divide-y bg-white" style={{ borderColor: '#ece6d9' }}>
                {personData.picks.length === 0 ? (
                  <div className="px-4 py-6 text-center text-sm text-gray-400">No picks yet</div>
                ) : (
                  personData.picks
                    .sort((a: any, b: any) => a.tier - b.tier)
                    .map((pick: any) => {
                      const live = pick.live
                      const isMC = live?.status === 'cut' || live?.status === 'wd'
                      const contribution = pick.contribution

                      return (
                        <div key={pick.id} className={`px-4 py-3 flex items-center justify-between ${isMC ? 'opacity-50' : ''}`}>
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-sm truncate" style={{ fontFamily: 'Georgia, serif' }}>
                              {pick.player?.name}
                            </div>
                            <div className="text-xs text-gray-400 mt-0.5">
                              <span className="inline-block px-1.5 py-0.5 rounded text-xs mr-1.5"
                                style={{ backgroundColor: '#eef7f0', color: 'var(--masters-green)', fontFamily: 'system-ui' }}>
                                T{pick.tier}
                              </span>
                              {live ? (
                                <>
                                  {live.position && <span className="mr-1.5">{live.position}</span>}
                                  <span>Thru {live.thru}</span>
                                </>
                              ) : (
                                <span>Not yet on leaderboard</span>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-col items-end ml-3 gap-0.5">
                            <ScoreBadge score={live?.total_score ?? null} status={live?.status} />
                            {!isMC && live && (
                              <span className="text-xs font-mono" style={{ color: contribution > 0 ? 'var(--score-red)' : '#aaa' }}>
                                {contribution > 0 ? `+${contribution} pts` : '0 pts'}
                              </span>
                            )}
                          </div>
                        </div>
                      )
                    })
                )}
              </div>
            </div>
          )
        })}
      </div>

      {lastUpdated && (
        <p className="text-center text-xs text-gray-400">
          Last updated {lastUpdated.toLocaleTimeString()} · Auto-refreshes every 60s
          <button onClick={fetchScores} className="ml-3 underline">Refresh now</button>
        </p>
      )}
    </div>
  )
}

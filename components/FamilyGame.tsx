'use client'

import { useEffect, useState, useCallback } from 'react'

type ActiveGolfer = {
  espn_id: string
  name: string
  position: string
  numericPos: number | null
  total_score: number
  status: string
}

type GamePick = {
  id: string
  player_name: string
  round: number
  golfer_espn_id: string
  golfer_name: string
  starting_position: number
  direction: 'long' | 'short'
  current_position: number | null
  live_status: string | null
  score: number
}

type PlayerEntry = {
  name: string
  total: number
  picks: GamePick[]
}

type GameData = {
  activeGolfers: ActiveGolfer[]
  leaderboard: PlayerEntry[]
  allPicks: GamePick[]
  updatedAt: string
}

function fmtScore(n: number) {
  if (n > 0) return `+${n}`
  if (n === 0) return '0'
  return `${n}`
}

function ordinal(n: number) {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

export function FamilyGame() {
  const [data, setData] = useState<GameData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  // Form state
  const [playerName, setPlayerName] = useState('')
  const [selectedRound, setSelectedRound] = useState<3 | 4>(3)
  const [selectedGolfer, setSelectedGolfer] = useState('')
  const [direction, setDirection] = useState<'long' | 'short'>('long')
  const [submitting, setSubmitting] = useState(false)
  const [submitMsg, setSubmitMsg] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/game', { cache: 'no-store' })
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
    fetchData()
    const interval = setInterval(fetchData, 60_000)
    return () => clearInterval(interval)
  }, [fetchData])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!playerName.trim() || !selectedGolfer) return
    setSubmitting(true)
    setSubmitMsg(null)
    try {
      const res = await fetch('/api/game/picks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player_name: playerName.trim(),
          round: selectedRound,
          golfer_espn_id: selectedGolfer,
          direction,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setSubmitMsg(`Error: ${json.error}`)
      } else {
        setSubmitMsg('Pick locked in!')
        setSelectedGolfer('')
        setDirection('long')
        await fetchData()
      }
    } catch (e: any) {
      setSubmitMsg(`Error: ${e.message}`)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="text-4xl mb-3 animate-pulse">📈</div>
          <p className="text-gray-500">Loading game...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-10 text-red-600">
        <p>Error: {error}</p>
        <button onClick={fetchData} className="mt-3 underline text-sm">Try again</button>
      </div>
    )
  }

  if (!data) return null

  const { activeGolfers, leaderboard, allPicks } = data

  // Build a lookup: player_name + round → picks
  function picksFor(name: string, round: number) {
    return allPicks.filter(
      (p) => p.player_name === name.trim().toLowerCase() && p.round === round
    )
  }

  const allPlayerNames = [...new Set(allPicks.map((p) => p.player_name))].sort()

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">

      {/* Leaderboard */}
      <div className="rounded-2xl overflow-hidden shadow-md" style={{ border: '1px solid #d4c9b0' }}>
        <div
          className="text-white text-center py-2 text-xs font-semibold tracking-widest uppercase"
          style={{ backgroundColor: 'var(--masters-green)' }}
        >
          The Climbers — Family Leaderboard
        </div>
        {leaderboard.length === 0 ? (
          <div className="bg-white py-8 text-center text-sm text-gray-400">
            No picks yet — be the first to submit below
          </div>
        ) : (
          <div className="bg-white divide-y" style={{ borderColor: '#ece6d9' }}>
            {leaderboard.map((entry, i) => (
              <div key={entry.name} className="px-5 py-3 flex items-center gap-4">
                <div
                  className="text-lg font-bold w-6 text-center"
                  style={{ color: i === 0 ? 'var(--masters-gold)' : '#aaa', fontFamily: 'Georgia, serif' }}
                >
                  {i + 1}
                </div>
                <div className="flex-1">
                  <div className="font-semibold capitalize" style={{ fontFamily: 'Georgia, serif' }}>
                    {entry.name}
                  </div>
                  <div className="text-xs text-gray-400">{entry.picks.length} pick{entry.picks.length !== 1 ? 's' : ''}</div>
                </div>
                <div
                  className="text-2xl font-bold font-mono"
                  style={{ color: entry.total > 0 ? 'var(--score-red)' : entry.total < 0 ? '#c00' : '#aaa', fontFamily: 'Georgia, serif' }}
                >
                  {fmtScore(entry.total)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* All picks by round */}
      {[3, 4].map((round) => {
        const roundPicks = allPicks.filter((p) => p.round === round)
        if (roundPicks.length === 0 && round === 4) return null
        return (
          <div key={round} className="rounded-xl overflow-hidden shadow-sm" style={{ border: '1px solid #d4c9b0' }}>
            <div className="px-4 py-2.5" style={{ backgroundColor: 'var(--masters-green)' }}>
              <span className="text-white font-bold text-sm">Round {round} Picks</span>
            </div>
            {roundPicks.length === 0 ? (
              <div className="bg-white py-6 text-center text-sm text-gray-400">No picks yet for Round {round}</div>
            ) : (
              <div className="bg-white divide-y" style={{ borderColor: '#ece6d9' }}>
                {roundPicks.map((pick) => {
                  const moved = pick.current_position !== null
                    ? pick.starting_position - pick.current_position
                    : null
                  const isShort = pick.direction === 'short'
                  return (
                    <div key={pick.id} className="px-4 py-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold capitalize text-sm" style={{ fontFamily: 'Georgia, serif' }}>
                            {pick.player_name}
                          </span>
                          <span
                            className="text-xs px-1.5 py-0.5 rounded font-semibold"
                            style={{
                              backgroundColor: isShort ? '#fff0f0' : '#eef7f0',
                              color: isShort ? '#c00' : 'var(--masters-green)',
                            }}
                          >
                            {isShort ? '↓ SHORT' : '↑ LONG'}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {pick.golfer_name}
                          {' · '}
                          Started {ordinal(pick.starting_position)}
                          {pick.current_position !== null && (
                            <> → Now {ordinal(pick.current_position)}
                              {moved !== null && moved !== 0 && (
                                <span style={{ color: moved > 0 ? 'var(--masters-green)' : '#c00' }}>
                                  {' '}({moved > 0 ? `↑${moved}` : `↓${Math.abs(moved)}`})
                                </span>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                      <div
                        className="text-lg font-bold font-mono"
                        style={{ color: pick.score > 0 ? 'var(--masters-green)' : pick.score < 0 ? '#c00' : '#aaa' }}
                      >
                        {fmtScore(pick.score)}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}

      {/* Submit form */}
      <div className="rounded-xl overflow-hidden shadow-sm" style={{ border: '1px solid #d4c9b0' }}>
        <div className="px-4 py-2.5" style={{ backgroundColor: 'var(--masters-green)' }}>
          <span className="text-white font-bold text-sm">Make Your Picks</span>
          <span className="text-xs ml-2" style={{ color: 'var(--masters-gold)' }}>3 per round · Long or Short</span>
        </div>
        <form onSubmit={handleSubmit} className="bg-white px-4 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Your Name</label>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="e.g. Mom, Dad, Grandpa..."
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2"
                style={{ borderColor: '#d4c9b0' }}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Round</label>
              <select
                value={selectedRound}
                onChange={(e) => setSelectedRound(Number(e.target.value) as 3 | 4)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none"
                style={{ borderColor: '#d4c9b0' }}
              >
                <option value={3}>Round 3 (Saturday)</option>
                <option value={4}>Round 4 (Sunday)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">
              Golfer — pick who will move
            </label>
            <select
              value={selectedGolfer}
              onChange={(e) => setSelectedGolfer(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none"
              style={{ borderColor: '#d4c9b0' }}
              required
            >
              <option value="">Choose a golfer...</option>
              {activeGolfers.map((g) => (
                <option key={g.espn_id} value={g.espn_id}>
                  {g.numericPos ? ordinal(g.numericPos) : '–'} — {g.name}
                  {g.total_score !== 0 ? ` (${g.total_score > 0 ? '+' : ''}${g.total_score})` : ' (E)'}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Direction</label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setDirection('long')}
                className="flex-1 py-2 rounded-lg text-sm font-semibold border-2 transition-all"
                style={{
                  borderColor: direction === 'long' ? 'var(--masters-green)' : '#d4c9b0',
                  backgroundColor: direction === 'long' ? '#eef7f0' : 'white',
                  color: direction === 'long' ? 'var(--masters-green)' : '#666',
                }}
              >
                ↑ Long (climbs)
              </button>
              <button
                type="button"
                onClick={() => setDirection('short')}
                className="flex-1 py-2 rounded-lg text-sm font-semibold border-2 transition-all"
                style={{
                  borderColor: direction === 'short' ? '#c00' : '#d4c9b0',
                  backgroundColor: direction === 'short' ? '#fff0f0' : 'white',
                  color: direction === 'short' ? '#c00' : '#666',
                }}
              >
                ↓ Short (falls) — 2× penalty if wrong
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={submitting || !playerName.trim() || !selectedGolfer}
              className="px-6 py-2 rounded-lg text-sm font-semibold text-white transition-opacity disabled:opacity-40"
              style={{ backgroundColor: 'var(--masters-green)' }}
            >
              {submitting ? 'Locking in...' : 'Lock In Pick'}
            </button>
            {submitMsg && (
              <span
                className="text-sm font-medium"
                style={{ color: submitMsg.startsWith('Error') ? '#c00' : 'var(--masters-green)' }}
              >
                {submitMsg}
              </span>
            )}
          </div>
        </form>
      </div>

      {/* How it works */}
      <div className="rounded-xl px-4 py-4 text-xs text-gray-500 space-y-1" style={{ backgroundColor: '#f8f8f8', border: '1px solid #e8e0d0' }}>
        <div className="font-semibold text-gray-700 mb-2">How scoring works</div>
        <div><strong>Long:</strong> Score = (start pos − end pos) / start pos × 100. e.g. 60th → 20th = +66.7 pts</div>
        <div><strong>Short:</strong> Same formula reversed. e.g. short 60th, falls to 80th = +33.3 pts. But if they climb instead, penalty is 2×.</div>
        <div className="mt-1 text-gray-400">3 picks per person per round. Cumulative across R3 + R4.</div>
      </div>

      {lastUpdated && (
        <p className="text-center text-xs text-gray-400">
          Last updated {lastUpdated.toLocaleTimeString()} · Auto-refreshes every 60s
          <button onClick={fetchData} className="ml-3 underline">Refresh now</button>
        </p>
      )}
    </div>
  )
}

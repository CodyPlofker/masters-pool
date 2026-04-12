'use client'

import { useEffect, useState, useCallback } from 'react'

type ActiveGolfer = {
  espn_id: string
  name: string
  position: string
  numericPos: number | null
  total_score: number
  today: number
  status: string
}

type GamePick = {
  id: string
  player_name: string
  round: number
  golfer_espn_id: string
  golfer_name: string
  starting_position: number
  direction: 'long' | 'short' | null
  current_position: number | null
  live_status: string | null
  live_total: number | null
  live_today: number | null
  score: number
}

type PlayerEntry = {
  name: string
  r3total: number
  r4today: number | null
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
  if (n === 0) return 'E'
  return `${n}`
}

function ordinal(n: number) {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

export function FamilyGameR3() {
  const [data, setData] = useState<GameData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  // Form state
  const [playerName, setPlayerName] = useState('')
  const [selectedGolfer, setSelectedGolfer] = useState('')
  const [direction, setDirection] = useState<'long' | 'short'>('long')
  const [submitting, setSubmitting] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

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

  const normalizedName = playerName.trim().toLowerCase()
  const myR3Picks = data
    ? data.allPicks.filter((p) => p.player_name === normalizedName && p.round === 3)
    : []
  const myLongs = myR3Picks.filter((p) => p.direction === 'long').length
  const myShorts = myR3Picks.filter((p) => p.direction === 'short').length
  const longDisabled = myLongs >= 2
  const shortDisabled = myShorts >= 1
  const picksDone = myR3Picks.length >= 3

  useEffect(() => {
    if (direction === 'long' && longDisabled && !shortDisabled) setDirection('short')
    if (direction === 'short' && shortDisabled && !longDisabled) setDirection('long')
  }, [direction, longDisabled, shortDisabled])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!playerName.trim() || !selectedGolfer) return
    setSubmitting(true)
    setMsg(null)
    try {
      const res = await fetch('/api/game/picks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player_name: playerName.trim(), round: 3, golfer_espn_id: selectedGolfer, direction }),
      })
      const json = await res.json()
      if (!res.ok) {
        setMsg(`Error: ${json.error}`)
      } else {
        setMsg('Pick locked in!')
        setSelectedGolfer('')
        await fetchData()
      }
    } catch (e: any) {
      setMsg(`Error: ${e.message}`)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <div className="flex items-center justify-center py-20"><div className="text-4xl animate-pulse">⛳</div></div>
  if (error) return <div className="text-center py-10 text-red-600"><p>{error}</p><button onClick={fetchData} className="mt-3 underline text-sm">Retry</button></div>
  if (!data) return null

  const { activeGolfers, leaderboard, allPicks } = data
  const r3Picks = allPicks.filter((p) => p.round === 3)

  // Group R3 picks by player
  const byPlayer = new Map<string, GamePick[]>()
  for (const pick of r3Picks) {
    const arr = byPlayer.get(pick.player_name) || []
    arr.push(pick)
    byPlayer.set(pick.player_name, arr)
  }
  const playerGroups = [...byPlayer.entries()]
    .map(([name, picks]) => ({ name, picks, subtotal: Math.round(picks.reduce((s, p) => s + p.score, 0) * 10) / 10 }))
    .sort((a, b) => b.subtotal - a.subtotal)

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">

      {/* Leaderboard */}
      <div className="rounded-2xl overflow-hidden shadow-md" style={{ border: '1px solid #d4c9b0' }}>
        <div className="text-white text-center py-2 text-xs font-semibold tracking-widest uppercase" style={{ backgroundColor: 'var(--masters-green)' }}>
          Round 3 — The Climbers
        </div>
        {leaderboard.filter(e => e.picks.some(p => p.round === 3)).length === 0 ? (
          <div className="bg-white py-8 text-center text-sm text-gray-400">No picks yet</div>
        ) : (
          <div className="bg-white divide-y" style={{ borderColor: '#ece6d9' }}>
            {leaderboard.filter(e => e.picks.some(p => p.round === 3)).map((entry, i) => (
              <div key={entry.name} className="px-5 py-3 flex items-center gap-4">
                <div className="text-lg font-bold w-6 text-center" style={{ color: i === 0 ? 'var(--masters-gold)' : '#aaa', fontFamily: 'Georgia, serif' }}>{i + 1}</div>
                <div className="flex-1">
                  <div className="font-semibold capitalize" style={{ fontFamily: 'Georgia, serif' }}>{entry.name}</div>
                  <div className="text-xs text-gray-400">{entry.picks.filter(p => p.round === 3).length} picks</div>
                </div>
                <div className="text-xl font-bold font-mono" style={{ color: entry.r3total > 0 ? 'var(--masters-green)' : entry.r3total < 0 ? '#c00' : '#aaa', fontFamily: 'Georgia, serif' }}>
                  {fmtScore(entry.r3total)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Picks by player */}
      {playerGroups.length > 0 && (
        <div className="rounded-xl overflow-hidden shadow-sm" style={{ border: '1px solid #d4c9b0' }}>
          <div className="px-4 py-2.5" style={{ backgroundColor: 'var(--masters-green)' }}>
            <span className="text-white font-bold text-sm">All Picks</span>
          </div>
          <div className="bg-white">
            {playerGroups.map((group, gi) => (
              <div key={group.name} style={{ borderTop: gi > 0 ? '1px solid #d4c9b0' : 'none' }}>
                <div className="px-4 py-2 flex items-center justify-between" style={{ backgroundColor: '#f8f5ee' }}>
                  <span className="font-semibold capitalize text-sm" style={{ fontFamily: 'Georgia, serif' }}>{group.name}</span>
                  <span className="text-sm font-bold font-mono" style={{ color: group.subtotal > 0 ? 'var(--masters-green)' : group.subtotal < 0 ? '#c00' : '#aaa' }}>
                    {fmtScore(group.subtotal)}
                  </span>
                </div>
                <div className="divide-y" style={{ borderColor: '#f0ebdf' }}>
                  {group.picks.map((pick) => {
                    const moved = pick.current_position !== null ? pick.starting_position - pick.current_position : null
                    const isShort = pick.direction === 'short'
                    return (
                      <div key={pick.id} className="px-4 py-2.5 flex items-center gap-3">
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold flex-shrink-0"
                          style={{ backgroundColor: isShort ? '#fff0f0' : '#eef7f0', color: isShort ? '#c00' : 'var(--masters-green)' }}>
                          {isShort ? '↓ SHORT' : '↑ LONG'}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{pick.golfer_name}</div>
                          <div className="text-xs text-gray-400">
                            {ordinal(pick.starting_position)} → {pick.current_position ? ordinal(pick.current_position) : '–'}
                            {moved !== null && moved !== 0 && (
                              <span style={{ color: moved > 0 ? 'var(--masters-green)' : '#c00' }}> ({moved > 0 ? `↑${moved}` : `↓${Math.abs(moved)}`})</span>
                            )}
                          </div>
                        </div>
                        <span className="text-sm font-bold font-mono flex-shrink-0" style={{ color: pick.score > 0 ? 'var(--masters-green)' : pick.score < 0 ? '#c00' : '#aaa' }}>
                          {fmtScore(pick.score)}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pick form */}
      <div className="rounded-xl overflow-hidden shadow-sm" style={{ border: '1px solid #d4c9b0' }}>
        <div className="px-4 py-2.5" style={{ backgroundColor: 'var(--masters-green)' }}>
          <span className="text-white font-bold text-sm">Make Your Picks</span>
          <span className="text-xs ml-2" style={{ color: 'var(--masters-gold)' }}>2 longs + 1 short · 3 picks total</span>
        </div>
        <form onSubmit={handleSubmit} className="bg-white px-4 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Your Name</label>
              <input type="text" value={playerName} onChange={(e) => setPlayerName(e.target.value)}
                placeholder="e.g. Mom, Dad..." className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none"
                style={{ borderColor: '#d4c9b0' }} required />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Remaining</label>
              <div className="text-sm pt-2">
                {picksDone ? (
                  <span className="text-gray-400">All 3 picks locked ✓</span>
                ) : normalizedName ? (
                  <span style={{ color: 'var(--masters-green)' }}>{2 - myLongs} long{2 - myLongs !== 1 ? 's' : ''} · {1 - myShorts} short</span>
                ) : (
                  <span className="text-gray-300">enter name first</span>
                )}
              </div>
            </div>
          </div>

          {!picksDone && (
            <>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Golfer</label>
                <select value={selectedGolfer} onChange={(e) => setSelectedGolfer(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none" style={{ borderColor: '#d4c9b0' }} required>
                  <option value="">Choose a golfer...</option>
                  {activeGolfers.map((g) => (
                    <option key={g.espn_id} value={g.espn_id}>
                      {g.numericPos ? ordinal(g.numericPos) : '–'} — {g.name} ({fmtScore(g.total_score)})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Direction</label>
                <div className="flex gap-3">
                  <button type="button" onClick={() => setDirection('long')} disabled={longDisabled}
                    className="flex-1 py-2 rounded-lg text-sm font-semibold border-2 transition-all disabled:opacity-30"
                    style={{ borderColor: direction === 'long' ? 'var(--masters-green)' : '#d4c9b0', backgroundColor: direction === 'long' ? '#eef7f0' : 'white', color: direction === 'long' ? 'var(--masters-green)' : '#666' }}>
                    ↑ Long (climbs)
                  </button>
                  <button type="button" onClick={() => setDirection('short')} disabled={shortDisabled}
                    className="flex-1 py-2 rounded-lg text-sm font-semibold border-2 transition-all disabled:opacity-30"
                    style={{ borderColor: direction === 'short' ? '#c00' : '#d4c9b0', backgroundColor: direction === 'short' ? '#fff0f0' : 'white', color: direction === 'short' ? '#c00' : '#666' }}>
                    ↓ Short (2× penalty if wrong)
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button type="submit" disabled={submitting || !playerName.trim() || !selectedGolfer}
                  className="px-6 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-40"
                  style={{ backgroundColor: 'var(--masters-green)' }}>
                  {submitting ? 'Locking...' : 'Lock In Pick'}
                </button>
                {msg && (
                  <span className="text-sm font-medium" style={{ color: msg.startsWith('Error') ? '#c00' : 'var(--masters-green)' }}>{msg}</span>
                )}
              </div>
            </>
          )}
        </form>
      </div>

      {/* Rules */}
      <div className="rounded-xl px-4 py-3 text-xs text-gray-500" style={{ backgroundColor: '#f8f8f8', border: '1px solid #e8e0d0' }}>
        <strong className="text-gray-700">Scoring:</strong> % position change × 100. 60th→20th = +66.7 pts. Shorts pay same formula reversed but 2× penalty if wrong.
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

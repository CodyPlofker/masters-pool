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

type R4Info = {
  target: number | null
  setBy: string | null
  pickedIds: string[]
  submitters: string[]
}

type GameData = {
  activeGolfers: ActiveGolfer[]
  leaderboard: PlayerEntry[]
  allPicks: GamePick[]
  r4: R4Info
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

export function FamilyGameR4() {
  const [data, setData] = useState<GameData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  // Form state
  const [playerName, setPlayerName] = useState('')
  const [selections, setSelections] = useState<string[]>(['', '', ''])
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

  if (loading) return <div className="flex items-center justify-center py-20"><div className="text-4xl animate-pulse">⛳</div></div>
  if (error) return <div className="text-center py-10 text-red-600"><p>{error}</p><button onClick={fetchData} className="mt-3 underline text-sm">Retry</button></div>
  if (!data) return null

  const { activeGolfers, leaderboard, allPicks, r4 } = data
  const target = r4.target
  const normalizedName = playerName.trim().toLowerCase()
  const alreadySubmitted = normalizedName ? r4.submitters.includes(normalizedName) : false

  // Available golfers: active + not already picked by anyone in R4
  const availableGolfers = activeGolfers.filter((g) => !r4.pickedIds.includes(g.espn_id))

  // Running sum of current selections
  const selectedGolfers = selections
    .filter(Boolean)
    .map((id) => availableGolfers.find((g) => g.espn_id === id))
    .filter(Boolean) as ActiveGolfer[]

  const runningSum = selectedGolfers.reduce((s, g) => s + g.total_score, 0)
  const allSelected = selections.every(Boolean)
  const sumMatches = target === null || runningSum === target

  // For slot N: filter to golfers that could make the target work
  function getOptionsForSlot(slotIdx: number) {
    const otherIds = selections.filter((id, i) => i !== slotIdx && id)
    const otherSum = otherIds.reduce((s, id) => {
      const g = availableGolfers.find((g) => g.espn_id === id)
      return s + (g?.total_score ?? 0)
    }, 0)
    const remainingSlots = selections.filter((id, i) => i !== slotIdx && !id).length

    return availableGolfers.filter((g) => {
      if (otherIds.includes(g.espn_id)) return false
      if (target === null) return true
      // Last unfilled slot — must land exactly on target
      if (remainingSlots === 0) return otherSum + g.total_score === target
      return true
    })
  }

  const handleSlotChange = (slotIdx: number, espnId: string) => {
    const next = [...selections]
    next[slotIdx] = espnId
    setSelections(next)
    setMsg(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!playerName.trim() || !allSelected) return
    if (!sumMatches) {
      setMsg(`Your picks sum to ${fmtScore(runningSum)}, target is ${fmtScore(target!)}`)
      return
    }
    setSubmitting(true)
    setMsg(null)
    try {
      const res = await fetch('/api/game/picks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player_name: playerName.trim(),
          round: 4,
          picks: selections.map((id) => ({ golfer_espn_id: id })),
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setMsg(`Error: ${json.error}`)
      } else {
        setMsg(target === null ? `Locked! Target set to ${fmtScore(json.sum)}` : 'Picks locked in!')
        setSelections(['', '', ''])
        await fetchData()
      }
    } catch (e: any) {
      setMsg(`Error: ${e.message}`)
    } finally {
      setSubmitting(false)
    }
  }

  const r4Picks = allPicks.filter((p) => p.round === 4)
  const byPlayer = new Map<string, GamePick[]>()
  for (const pick of r4Picks) {
    const arr = byPlayer.get(pick.player_name) || []
    arr.push(pick)
    byPlayer.set(pick.player_name, arr)
  }
  const r4PlayerGroups = [...byPlayer.entries()]
    .map(([name, picks]) => ({
      name,
      picks,
      r4today: picks.reduce((s, p) => s + (p.live_today ?? 0), 0),
      r4sum: picks.reduce((s, p) => s + (p.live_total ?? 0), 0),
    }))
    .sort((a, b) => a.r4today - b.r4today) // lower today = better

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">

      {/* Target banner */}
      {target !== null && (
        <div className="rounded-xl px-4 py-3 flex items-center justify-between" style={{ backgroundColor: '#eef7f0', border: '1px solid #b8dfc4' }}>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--masters-green)' }}>Target Sum (set by {r4.setBy})</div>
            <div className="text-3xl font-bold font-mono mt-0.5" style={{ color: 'var(--masters-green)', fontFamily: 'Georgia, serif' }}>
              {fmtScore(target)}
            </div>
          </div>
          <div className="text-xs text-gray-500 text-right">
            Pick 3 golfers whose<br />combined score equals this
          </div>
        </div>
      )}

      {/* R4 leaderboard */}
      <div className="rounded-2xl overflow-hidden shadow-md" style={{ border: '1px solid #d4c9b0' }}>
        <div className="text-white text-center py-2 text-xs font-semibold tracking-widest uppercase" style={{ backgroundColor: 'var(--masters-green)' }}>
          Sunday — Lowest R4 Score Wins
        </div>
        {r4PlayerGroups.length === 0 ? (
          <div className="bg-white py-8 text-center text-sm text-gray-400">
            {target === null ? 'Waiting for leader to set target…' : 'No picks yet'}
          </div>
        ) : (
          <div className="bg-white divide-y" style={{ borderColor: '#ece6d9' }}>
            {r4PlayerGroups.map((entry, i) => (
              <div key={entry.name} className="px-5 py-3 flex items-center gap-4">
                <div className="text-lg font-bold w-6 text-center" style={{ color: i === 0 ? 'var(--masters-gold)' : '#aaa', fontFamily: 'Georgia, serif' }}>{i + 1}</div>
                <div className="flex-1">
                  <div className="font-semibold capitalize" style={{ fontFamily: 'Georgia, serif' }}>{entry.name}</div>
                  <div className="text-xs text-gray-400">sum going in: {fmtScore(entry.r4sum)}</div>
                </div>
                <div className="text-xl font-bold font-mono" style={{ color: entry.r4today < 0 ? 'var(--masters-green)' : entry.r4today > 0 ? '#c00' : '#aaa', fontFamily: 'Georgia, serif' }}>
                  {fmtScore(entry.r4today)} today
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Picks detail */}
      {r4PlayerGroups.length > 0 && (
        <div className="rounded-xl overflow-hidden shadow-sm" style={{ border: '1px solid #d4c9b0' }}>
          <div className="px-4 py-2.5" style={{ backgroundColor: 'var(--masters-green)' }}>
            <span className="text-white font-bold text-sm">All Picks</span>
          </div>
          <div className="bg-white">
            {r4PlayerGroups.map((group, gi) => (
              <div key={group.name} style={{ borderTop: gi > 0 ? '1px solid #d4c9b0' : 'none' }}>
                <div className="px-4 py-2 flex items-center justify-between" style={{ backgroundColor: '#f8f5ee' }}>
                  <span className="font-semibold capitalize text-sm" style={{ fontFamily: 'Georgia, serif' }}>{group.name}</span>
                  <span className="text-sm font-bold font-mono" style={{ color: group.r4today < 0 ? 'var(--masters-green)' : group.r4today > 0 ? '#c00' : '#aaa' }}>
                    {fmtScore(group.r4today)} today
                  </span>
                </div>
                <div className="divide-y" style={{ borderColor: '#f0ebdf' }}>
                  {group.picks.map((pick) => (
                    <div key={pick.id} className="px-4 py-2.5 flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium" style={{ fontFamily: 'Georgia, serif' }}>{pick.golfer_name}</div>
                        <div className="text-xs text-gray-400">
                          {pick.current_position ? ordinal(pick.current_position) : '–'}
                          {pick.live_total !== null && <> · Total {fmtScore(pick.live_total)}</>}
                        </div>
                      </div>
                      <div className="text-sm font-bold font-mono" style={{ color: (pick.live_today ?? 0) < 0 ? 'var(--masters-green)' : (pick.live_today ?? 0) > 0 ? '#c00' : '#aaa' }}>
                        {pick.live_today !== null ? fmtScore(pick.live_today) : '—'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pick form */}
      <div className="rounded-xl overflow-hidden shadow-sm" style={{ border: '1px solid #d4c9b0' }}>
        <div className="px-4 py-2.5 flex items-center justify-between" style={{ backgroundColor: 'var(--masters-green)' }}>
          <span className="text-white font-bold text-sm">Make Your R4 Picks</span>
          {!r4.setBy && <span className="text-xs" style={{ color: 'var(--masters-gold)' }}>Leader picks first — sets the target</span>}
        </div>
        <form onSubmit={handleSubmit} className="bg-white px-4 py-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Your Name</label>
            <input type="text" value={playerName} onChange={(e) => setPlayerName(e.target.value)}
              placeholder="e.g. Mom, Dad..." className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none"
              style={{ borderColor: '#d4c9b0' }} required />
          </div>

          {alreadySubmitted ? (
            <div className="text-sm text-gray-400 py-2">Your R4 picks are locked in ✓</div>
          ) : (
            <>
              {/* Running sum */}
              <div className="flex items-center justify-between px-3 py-2.5 rounded-lg" style={{ backgroundColor: '#f8f5ee' }}>
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Your sum</span>
                <div className="flex items-center gap-3">
                  <span className="text-xl font-bold font-mono" style={{ color: allSelected && sumMatches ? 'var(--masters-green)' : '#333', fontFamily: 'Georgia, serif' }}>
                    {selectedGolfers.length > 0 ? fmtScore(runningSum) : '—'}
                  </span>
                  {target !== null && selectedGolfers.length > 0 && !allSelected && (
                    <span className="text-xs text-gray-400">
                      need {fmtScore(target - runningSum)} across {3 - selectedGolfers.length} more pick{3 - selectedGolfers.length !== 1 ? 's' : ''}
                    </span>
                  )}
                  {target !== null && allSelected && (
                    <span className="text-xs font-semibold" style={{ color: sumMatches ? 'var(--masters-green)' : '#c00' }}>
                      {sumMatches ? '✓ matches target' : `✗ need ${fmtScore(target)}`}
                    </span>
                  )}
                  {target === null && <span className="text-xs text-gray-400">your sum becomes the target</span>}
                </div>
              </div>

              {/* 3 slots */}
              {[0, 1, 2].map((slotIdx) => {
                const opts = getOptionsForSlot(slotIdx)
                const isLastSlot = selections.filter((id, i) => i !== slotIdx && id).length === 2
                return (
                  <div key={slotIdx}>
                    <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">
                      Pick {slotIdx + 1}
                      {target !== null && isLastSlot && (
                        <span className="ml-2 font-normal normal-case text-gray-400">
                          ({opts.length} golfer{opts.length !== 1 ? 's' : ''} complete the target)
                        </span>
                      )}
                    </label>
                    <select value={selections[slotIdx]} onChange={(e) => handleSlotChange(slotIdx, e.target.value)}
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none" style={{ borderColor: '#d4c9b0' }}>
                      <option value="">Choose a golfer...</option>
                      {opts.map((g) => (
                        <option key={g.espn_id} value={g.espn_id}>
                          {g.numericPos ? ordinal(g.numericPos) : '–'} — {g.name} ({fmtScore(g.total_score)})
                        </option>
                      ))}
                    </select>
                  </div>
                )
              })}

              <div className="flex items-center gap-3">
                <button type="submit" disabled={submitting || !playerName.trim() || !allSelected || !sumMatches}
                  className="px-6 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-40"
                  style={{ backgroundColor: 'var(--masters-green)' }}>
                  {submitting ? 'Locking...' : target === null ? 'Set Target & Lock In' : 'Lock In Picks'}
                </button>
                {msg && (
                  <span className="text-sm font-medium" style={{ color: msg.startsWith('Error') || msg.includes('sum to') ? '#c00' : 'var(--masters-green)' }}>
                    {msg}
                  </span>
                )}
              </div>
            </>
          )}
        </form>
      </div>

      {/* Rules */}
      <div className="rounded-xl px-4 py-3 text-xs text-gray-500" style={{ backgroundColor: '#f8f8f8', border: '1px solid #e8e0d0' }}>
        <strong className="text-gray-700">Rules:</strong> Family game leader picks first — their 3 golfers' combined score going into R4 becomes the target everyone must match. Pick 3 golfers that sum to the same number. Lowest combined R4 strokes wins.
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

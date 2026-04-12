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

// ── R3 Pick Form ─────────────────────────────────────────────────────────────
function R3PickForm({ data, onSuccess }: { data: GameData; onSuccess: () => void }) {
  const [playerName, setPlayerName] = useState('')
  const [selectedGolfer, setSelectedGolfer] = useState('')
  const [direction, setDirection] = useState<'long' | 'short'>('long')
  const [submitting, setSubmitting] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const { activeGolfers, allPicks } = data
  const normalizedName = playerName.trim().toLowerCase()
  const myR3Picks = normalizedName
    ? allPicks.filter((p) => p.player_name === normalizedName && p.round === 3)
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
        onSuccess()
      }
    } catch (e: any) {
      setMsg(`Error: ${e.message}`)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="rounded-xl overflow-hidden shadow-sm" style={{ border: '1px solid #d4c9b0' }}>
      <div className="px-4 py-2.5" style={{ backgroundColor: 'var(--masters-green)' }}>
        <span className="text-white font-bold text-sm">Make R3 Picks</span>
        <span className="text-xs ml-2" style={{ color: 'var(--masters-gold)' }}>2 longs + 1 short</span>
      </div>
      <form onSubmit={handleSubmit} className="bg-white px-4 py-4 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Your Name</label>
            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="e.g. Mom, Dad..."
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none"
              style={{ borderColor: '#d4c9b0' }}
              required
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Remaining</label>
            <div className="text-sm pt-2">
              {picksDone ? (
                <span className="text-gray-400">All picks locked</span>
              ) : (
                <span style={{ color: 'var(--masters-green)' }}>
                  {2 - myLongs} long{2 - myLongs !== 1 ? 's' : ''} · {1 - myShorts} short left
                </span>
              )}
            </div>
          </div>
        </div>

        {!picksDone && (
          <>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Golfer</label>
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
                  ↑ Long
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
                <span className="text-sm font-medium" style={{ color: msg.startsWith('Error') ? '#c00' : 'var(--masters-green)' }}>
                  {msg}
                </span>
              )}
            </div>
          </>
        )}
      </form>
    </div>
  )
}

// ── R4 Pick Form ─────────────────────────────────────────────────────────────
function R4PickForm({ data, onSuccess }: { data: GameData; onSuccess: () => void }) {
  const [playerName, setPlayerName] = useState('')
  const [selections, setSelections] = useState<string[]>(['', '', ''])
  const [submitting, setSubmitting] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const { activeGolfers, r4, allPicks } = data
  const normalizedName = playerName.trim().toLowerCase()
  const alreadySubmitted = normalizedName ? r4.submitters.includes(normalizedName) : false
  const target = r4.target

  // Available golfers for R4: not cut, not already picked by someone else
  const availableGolfers = activeGolfers.filter((g) => !r4.pickedIds.includes(g.espn_id))

  // Running sum of selected golfers' current total_score
  const selectedGolfers = selections
    .filter(Boolean)
    .map((id) => availableGolfers.find((g) => g.espn_id === id))
    .filter(Boolean) as ActiveGolfer[]

  const runningSum = selectedGolfers.reduce((s, g) => s + g.total_score, 0)
  const remaining = target !== null ? target - runningSum : null
  const allSelected = selections.every(Boolean)
  const sumMatches = target === null || runningSum === target

  // For each slot, filter golfers that could complete the target
  function getOptionsForSlot(slotIdx: number) {
    const otherSelected = selections.filter((id, i) => i !== slotIdx && id)
    const otherSum = otherSelected.reduce((s, id) => {
      const g = availableGolfers.find((g) => g.espn_id === id)
      return s + (g?.total_score ?? 0)
    }, 0)
    const filledSlots = otherSelected.length
    const remainingSlots = 3 - filledSlots - 1 // slots after this one

    return availableGolfers.filter((g) => {
      // Don't show golfers already selected in other slots
      if (otherSelected.includes(g.espn_id)) return false
      if (target === null) return true

      // If this is the last unfilled slot, score must land exactly on target
      if (remainingSlots === 0) {
        return otherSum + g.total_score === target
      }
      // Otherwise just show all (user can figure out the last slot)
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
      setMsg(`Your picks sum to ${fmtScore(runningSum)}, but target is ${fmtScore(target!)}`)
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
        onSuccess()
      }
    } catch (e: any) {
      setMsg(`Error: ${e.message}`)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="rounded-xl overflow-hidden shadow-sm" style={{ border: '1px solid #d4c9b0' }}>
      <div className="px-4 py-2.5 flex items-center justify-between" style={{ backgroundColor: 'var(--masters-green)' }}>
        <div>
          <span className="text-white font-bold text-sm">Sunday Picks — R4</span>
          {r4.setBy && (
            <span className="text-xs ml-2" style={{ color: 'var(--masters-gold)' }}>
              Target: {fmtScore(target!)} (set by {r4.setBy})
            </span>
          )}
          {!r4.setBy && (
            <span className="text-xs ml-2" style={{ color: 'var(--masters-gold)' }}>
              Leader picks first — sets the target sum
            </span>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white px-4 py-4 space-y-4">
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Your Name</label>
          <input
            type="text"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder="e.g. Mom, Dad..."
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none"
            style={{ borderColor: '#d4c9b0' }}
            required
          />
        </div>

        {alreadySubmitted ? (
          <div className="text-sm text-gray-400 py-2">Your R4 picks are locked in ✓</div>
        ) : (
          <>
            {/* Running sum indicator */}
            <div className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ backgroundColor: '#f8f5ee' }}>
              <span className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Your sum</span>
              <div className="flex items-center gap-3">
                <span className="text-lg font-bold font-mono" style={{ color: sumMatches && allSelected ? 'var(--masters-green)' : '#333' }}>
                  {selectedGolfers.length > 0 ? fmtScore(runningSum) : '—'}
                </span>
                {target !== null && selectedGolfers.length > 0 && !allSelected && remaining !== null && (
                  <span className="text-xs text-gray-400">
                    need {remaining > 0 ? `+${remaining}` : remaining === 0 ? 'E' : remaining} more across {3 - selectedGolfers.length} pick{3 - selectedGolfers.length !== 1 ? 's' : ''}
                  </span>
                )}
                {target !== null && allSelected && (
                  <span className="text-xs font-semibold" style={{ color: sumMatches ? 'var(--masters-green)' : '#c00' }}>
                    {sumMatches ? '✓ matches target' : `✗ target is ${fmtScore(target)}`}
                  </span>
                )}
                {target === null && (
                  <span className="text-xs text-gray-400">you go first — your sum becomes the target</span>
                )}
              </div>
            </div>

            {/* 3 pick slots */}
            {[0, 1, 2].map((slotIdx) => {
              const opts = getOptionsForSlot(slotIdx)
              return (
                <div key={slotIdx}>
                  <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">
                    Pick {slotIdx + 1}
                    {target !== null && slotIdx === 2 && selectedGolfers.length === 2 && (
                      <span className="ml-2 font-normal normal-case text-gray-400">
                        ({opts.length} golfer{opts.length !== 1 ? 's' : ''} hit the target)
                      </span>
                    )}
                  </label>
                  <select
                    value={selections[slotIdx]}
                    onChange={(e) => handleSlotChange(slotIdx, e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none"
                    style={{ borderColor: '#d4c9b0' }}
                  >
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
              <button
                type="submit"
                disabled={submitting || !playerName.trim() || !allSelected || !sumMatches}
                className="px-6 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-40"
                style={{ backgroundColor: 'var(--masters-green)' }}
              >
                {submitting ? 'Locking...' : target === null ? 'Set Target & Lock In' : 'Lock In Picks'}
              </button>
              {msg && (
                <span className="text-sm font-medium" style={{ color: msg.startsWith('Error') || msg.startsWith('Your picks sum') ? '#c00' : 'var(--masters-green)' }}>
                  {msg}
                </span>
              )}
            </div>
          </>
        )}
      </form>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export function FamilyGame() {
  const [data, setData] = useState<GameData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

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

  const { leaderboard, allPicks, r4 } = data

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">

      {/* Overall leaderboard */}
      <div className="rounded-2xl overflow-hidden shadow-md" style={{ border: '1px solid #d4c9b0' }}>
        <div className="text-white text-center py-2 text-xs font-semibold tracking-widest uppercase" style={{ backgroundColor: 'var(--masters-green)' }}>
          The Climbers — Family Leaderboard
        </div>
        {leaderboard.length === 0 ? (
          <div className="bg-white py-8 text-center text-sm text-gray-400">No picks yet</div>
        ) : (
          <div className="bg-white divide-y" style={{ borderColor: '#ece6d9' }}>
            {leaderboard.map((entry, i) => (
              <div key={entry.name} className="px-5 py-3 flex items-center gap-4">
                <div className="text-lg font-bold w-6 text-center" style={{ color: i === 0 ? 'var(--masters-gold)' : '#aaa', fontFamily: 'Georgia, serif' }}>
                  {i + 1}
                </div>
                <div className="flex-1">
                  <div className="font-semibold capitalize" style={{ fontFamily: 'Georgia, serif' }}>{entry.name}</div>
                  <div className="text-xs text-gray-400">
                    R3: {fmtScore(entry.r3total)}
                    {entry.r4today !== null && <> · R4 today: {fmtScore(entry.r4today)}</>}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xl font-bold font-mono" style={{ color: entry.r3total > 0 ? 'var(--masters-green)' : entry.r3total < 0 ? '#c00' : '#aaa', fontFamily: 'Georgia, serif' }}>
                    {fmtScore(entry.r3total)}
                  </div>
                  {entry.r4today !== null && (
                    <div className="text-xs font-semibold" style={{ color: entry.r4today < 0 ? 'var(--masters-green)' : entry.r4today > 0 ? '#c00' : '#aaa' }}>
                      R4: {fmtScore(entry.r4today)}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* R4 picks display */}
      {r4.submitters.length > 0 && (
        <div className="rounded-xl overflow-hidden shadow-sm" style={{ border: '1px solid #d4c9b0' }}>
          <div className="px-4 py-2.5 flex items-center justify-between" style={{ backgroundColor: 'var(--masters-green)' }}>
            <span className="text-white font-bold text-sm">Round 4 Picks</span>
            {r4.target !== null && (
              <span className="text-xs px-2 py-0.5 rounded font-semibold" style={{ backgroundColor: 'var(--masters-gold)', color: '#1a1a1a' }}>
                Target: {fmtScore(r4.target)}
              </span>
            )}
          </div>
          <div className="bg-white divide-y" style={{ borderColor: '#ece6d9' }}>
            {r4.submitters.map((playerName) => {
              const playerR4Picks = allPicks.filter((p) => p.player_name === playerName && p.round === 4)
              const r4sum = playerR4Picks.reduce((s, p) => s + (p.live_total ?? 0), 0)
              const r4today = playerR4Picks.reduce((s, p) => s + (p.live_today ?? 0), 0)
              return (
                <div key={playerName}>
                  <div className="px-4 py-2 flex items-center justify-between" style={{ backgroundColor: '#f8f5ee' }}>
                    <span className="font-semibold capitalize text-sm" style={{ fontFamily: 'Georgia, serif' }}>{playerName}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-400">sum: {fmtScore(r4sum)}</span>
                      <span className="text-sm font-bold font-mono" style={{ color: r4today < 0 ? 'var(--masters-green)' : r4today > 0 ? '#c00' : '#aaa' }}>
                        Today: {fmtScore(r4today)}
                      </span>
                    </div>
                  </div>
                  <div className="divide-y" style={{ borderColor: '#f0ebdf' }}>
                    {playerR4Picks.map((pick) => (
                      <div key={pick.id} className="px-4 py-2.5 flex items-center justify-between">
                        <div>
                          <div className="text-sm font-medium" style={{ fontFamily: 'Georgia, serif' }}>{pick.golfer_name}</div>
                          <div className="text-xs text-gray-400">
                            {pick.current_position ? ordinal(pick.current_position) : '–'}
                            {pick.live_total !== null && <> · Total: {fmtScore(pick.live_total)}</>}
                          </div>
                        </div>
                        <div className="text-sm font-bold font-mono" style={{ color: (pick.live_today ?? 0) < 0 ? 'var(--masters-green)' : (pick.live_today ?? 0) > 0 ? '#c00' : '#aaa' }}>
                          {pick.live_today !== null ? fmtScore(pick.live_today) : '—'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* R3 picks display */}
      {(() => {
        const r3Picks = allPicks.filter((p) => p.round === 3)
        if (r3Picks.length === 0) return null
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
          <div className="rounded-xl overflow-hidden shadow-sm" style={{ border: '1px solid #d4c9b0' }}>
            <div className="px-4 py-2.5" style={{ backgroundColor: 'var(--masters-green)' }}>
              <span className="text-white font-bold text-sm">Round 3 Picks</span>
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
                        <div key={pick.id} className="px-4 py-2 flex items-center gap-2.5">
                          <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold flex-shrink-0"
                            style={{ backgroundColor: isShort ? '#fff0f0' : '#eef7f0', color: isShort ? '#c00' : 'var(--masters-green)' }}>
                            {isShort ? '↓ S' : '↑ L'}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium truncate">{pick.golfer_name}</div>
                            <div className="text-[10px] text-gray-400">
                              {ordinal(pick.starting_position)} → {pick.current_position ? ordinal(pick.current_position) : '–'}
                              {moved !== null && moved !== 0 && (
                                <span style={{ color: moved > 0 ? 'var(--masters-green)' : '#c00' }}> ({moved > 0 ? `↑${moved}` : `↓${Math.abs(moved)}`})</span>
                              )}
                            </div>
                          </div>
                          <span className="text-sm font-bold font-mono" style={{ color: pick.score > 0 ? 'var(--masters-green)' : pick.score < 0 ? '#c00' : '#aaa' }}>
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
        )
      })()}

      {/* Forms */}
      <R3PickForm data={data} onSuccess={fetchData} />
      <R4PickForm data={data} onSuccess={fetchData} />

      {/* How it works */}
      <div className="rounded-xl px-4 py-4 text-xs text-gray-500 space-y-1.5" style={{ backgroundColor: '#f8f8f8', border: '1px solid #e8e0d0' }}>
        <div className="font-semibold text-gray-700 mb-1">How scoring works</div>
        <div><strong>R3 (long/short):</strong> % position change × 100. Shorts 2× penalty if wrong.</div>
        <div><strong>R4 (sum match):</strong> The family game leader picks 3 golfers first — their combined score going in becomes the target everyone must match. Lowest combined R4 strokes wins.</div>
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

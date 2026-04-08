'use client'

import { useEffect, useState, useCallback } from 'react'
import { TIER_LABELS, PICKS_PER_TIER, getDraftSchedule } from '@/lib/supabase'

type Player = {
  id: string
  name: string
  espn_id: string | null
  world_rank: number | null
  tier: number
  is_liv: boolean
}

type DraftState = {
  current_pick_order: number
  current_drafter: 'cody' | 'jeremy'
  current_tier: number
  is_complete: boolean
  first_drafter: 'cody' | 'jeremy'
}

type Pick = {
  id: string
  drafted_by: 'cody' | 'jeremy'
  tier: number
  pick_order: number
  player: Player
}

export function DraftBoard() {
  const [draftState, setDraftState] = useState<DraftState | null>(null)
  const [availablePlayers, setAvailablePlayers] = useState<Player[]>([])
  const [allPicks, setAllPicks] = useState<Pick[]>([])
  const [loading, setLoading] = useState(true)
  const [picking, setPicking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const loadDraftData = useCallback(async () => {
    try {
      const [stateRes, picksRes] = await Promise.all([
        fetch('/api/draft'),
        fetch('/api/scores'),
      ])
      const state: DraftState = await stateRes.json()
      const scoresData = await picksRes.json()

      setDraftState(state)

      // Collect all picks from both sides
      const picks = [
        ...(scoresData.pool?.cody?.picks || []),
        ...(scoresData.pool?.jeremy?.picks || []),
      ].sort((a, b) => a.pick_order - b.pick_order)
      setAllPicks(picks)

      if (!state.is_complete) {
        const playersRes = await fetch(`/api/players?tier=${state.current_tier}`)
        const players = await playersRes.json()
        setAvailablePlayers(players)
      }

      setError(null)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadDraftData()
  }, [loadDraftData])

  async function makePick(playerId: string, playerName: string) {
    if (picking) return
    setPicking(true)
    setError(null)
    setSuccessMsg(null)

    try {
      const res = await fetch('/api/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player_id: playerId }),
      })
      const result = await res.json()

      if (!res.ok) {
        setError(result.error || 'Pick failed')
        return
      }

      setSuccessMsg(`${draftState?.current_drafter === 'cody' ? 'Cody' : 'Jeremy'} picked ${playerName}!`)
      setTimeout(() => setSuccessMsg(null), 3000)
      await loadDraftData()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setPicking(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="text-4xl mb-3 animate-pulse">⛳</div>
          <p className="text-gray-500">Loading draft...</p>
        </div>
      </div>
    )
  }

  if (!draftState) return null

  const schedule = getDraftSchedule(draftState.first_drafter)
  const currentPickIndex = draftState.current_pick_order - 1

  if (draftState.is_complete) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <div className="text-5xl mb-4">🏆</div>
          <h2 className="text-2xl font-bold mb-2" style={{ fontFamily: 'Georgia, serif', color: 'var(--masters-green)' }}>
            Draft Complete!
          </h2>
          <p className="text-gray-500">All picks are in. <a href="/" className="underline" style={{ color: 'var(--masters-green)' }}>View standings →</a></p>
        </div>
        <DraftSummary picks={allPicks} />
      </div>
    )
  }

  const currentSlot = schedule[currentPickIndex]
  const drafterName = draftState.current_drafter === 'cody' ? 'Cody' : 'Jeremy'
  const totalPicks = schedule.length

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">

      {/* Current pick banner */}
      <div className="rounded-xl p-5 text-white text-center shadow-md"
        style={{ background: `linear-gradient(135deg, var(--masters-green), var(--masters-green-light))` }}>
        <div className="text-xs uppercase tracking-widest mb-1 opacity-75">
          Pick {draftState.current_pick_order} of {totalPicks}
        </div>
        <div className="text-2xl font-bold mb-1" style={{ fontFamily: 'Georgia, serif' }}>
          {drafterName}'s Turn
        </div>
        <div className="text-sm opacity-90">
          {TIER_LABELS[draftState.current_tier]}
        </div>
        {/* Progress bar */}
        <div className="mt-3 h-1.5 bg-white/20 rounded-full overflow-hidden">
          <div
            className="h-full bg-white/70 rounded-full transition-all duration-500"
            style={{ width: `${((draftState.current_pick_order - 1) / totalPicks) * 100}%` }}
          />
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {successMsg && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm font-semibold">
          ✓ {successMsg}
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-5">
        {/* Available players */}
        <div className="md:col-span-2">
          <div className="rounded-xl overflow-hidden shadow-sm" style={{ border: '1px solid #d4c9b0' }}>
            <div className="px-4 py-3 font-semibold text-sm text-white"
              style={{ backgroundColor: 'var(--masters-green)' }}>
              Available — {TIER_LABELS[draftState.current_tier]}
            </div>
            <div className="divide-y bg-white max-h-[500px] overflow-y-auto" style={{ borderColor: '#ece6d9' }}>
              {availablePlayers.length === 0 ? (
                <div className="px-4 py-8 text-center text-gray-400 text-sm">
                  No players available in this tier. The field may not be seeded yet.{' '}
                  <a href="/admin" className="underline" style={{ color: 'var(--masters-green)' }}>Seed players →</a>
                </div>
              ) : (
                availablePlayers.map((player) => (
                  <div key={player.id} className="px-4 py-3 flex items-center justify-between hover:bg-green-50 transition-colors">
                    <div>
                      <div className="font-semibold text-sm" style={{ fontFamily: 'Georgia, serif' }}>
                        {player.name}
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        Rank #{player.world_rank ?? '?'}
                      </div>
                    </div>
                    <button
                      onClick={() => makePick(player.id, player.name)}
                      disabled={picking}
                      className="px-4 py-1.5 rounded-lg text-sm font-semibold text-white transition-all disabled:opacity-50"
                      style={{ backgroundColor: 'var(--masters-green)' }}
                    >
                      {picking ? '...' : 'Pick'}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Draft board sidebar */}
        <div className="rounded-xl overflow-hidden shadow-sm" style={{ border: '1px solid #d4c9b0' }}>
          <div className="px-4 py-3 font-semibold text-sm text-white"
            style={{ backgroundColor: 'var(--masters-green)' }}>
            Draft Board
          </div>
          <div className="divide-y bg-white" style={{ borderColor: '#ece6d9' }}>
            {schedule.map((slot, idx) => {
              const pick = allPicks.find((p) => p.pick_order === idx + 1)
              const isCurrent = idx === currentPickIndex
              const isPast = idx < currentPickIndex

              return (
                <div
                  key={idx}
                  className={`px-3 py-2 text-xs flex items-center gap-2 ${isCurrent ? 'bg-green-50' : ''}`}
                >
                  <span className="text-gray-400 w-4 text-right flex-shrink-0">{idx + 1}</span>
                  <span
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: slot.drafter === 'cody' ? '#005b2d' : '#c9a84c' }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className={`font-semibold truncate ${isCurrent ? 'text-green-800' : isPast ? 'text-gray-700' : 'text-gray-400'}`}>
                      {pick ? pick.player.name : isCurrent ? `${slot.drafter === 'cody' ? 'Cody' : 'Jeremy'} picks...` : '—'}
                    </div>
                    <div className="text-gray-400">T{slot.tier} · {slot.drafter === 'cody' ? 'Cody' : 'Jeremy'}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

function DraftSummary({ picks }: { picks: Pick[] }) {
  const codyPicks = picks.filter((p) => p.drafted_by === 'cody').sort((a, b) => a.tier - b.tier)
  const jeremyPicks = picks.filter((p) => p.drafted_by === 'jeremy').sort((a, b) => a.tier - b.tier)

  return (
    <div className="grid md:grid-cols-2 gap-5">
      {[{ label: 'Cody', picks: codyPicks }, { label: 'Jeremy', picks: jeremyPicks }].map(({ label, picks: personPicks }) => (
        <div key={label} className="rounded-xl overflow-hidden shadow-sm" style={{ border: '1px solid #d4c9b0' }}>
          <div className="px-4 py-2.5 font-bold text-sm text-white" style={{ backgroundColor: 'var(--masters-green)' }}>
            {label}'s Picks
          </div>
          <div className="divide-y bg-white" style={{ borderColor: '#ece6d9' }}>
            {personPicks.map((pick) => (
              <div key={pick.id} className="px-4 py-2.5 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-sm" style={{ fontFamily: 'Georgia, serif' }}>{pick.player.name}</div>
                  <div className="text-xs text-gray-400">{TIER_LABELS[pick.tier]}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

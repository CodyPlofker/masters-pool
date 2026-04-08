'use client'

import { useState, useEffect } from 'react'
import { TIER_LABELS } from '@/lib/supabase'

type Player = {
  id: string
  name: string
  world_rank: number | null
  tier: number
  is_liv: boolean
  in_field: boolean
}

export default function AdminPage() {
  const [adminKey, setAdminKey] = useState('')
  const [authed, setAuthed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [loadingPlayers, setLoadingPlayers] = useState(false)
  const [firstDrafter, setFirstDrafter] = useState<'cody' | 'jeremy'>('cody')
  const [draftState, setDraftState] = useState<any>(null)

  async function authenticate() {
    setLoading(true)
    try {
      // Verify key against a lightweight endpoint (no DB dependency)
      const res = await fetch('/api/admin/verify', {
        headers: { 'x-admin-key': adminKey },
      })
      if (res.ok) {
        setAuthed(true)
        fetchDraftState()
        // Load players (may fail if DB not initialized yet — that's fine)
        const playersRes = await fetch('/api/admin/players', {
          headers: { 'x-admin-key': adminKey },
        })
        if (playersRes.ok) setPlayers(await playersRes.json())
      } else {
        setMessage({ type: 'error', text: 'Invalid admin key' })
      }
    } catch {
      setMessage({ type: 'error', text: 'Connection error' })
    } finally {
      setLoading(false)
    }
  }

  async function fetchDraftState() {
    const res = await fetch('/api/draft')
    if (res.ok) setDraftState(await res.json())
  }

  async function initDb() {
    setLoading(true)
    setMessage(null)
    try {
      const res = await fetch('/api/admin/init', {
        method: 'POST',
        headers: { 'x-admin-key': adminKey },
      })
      const data = await res.json()
      if (res.ok) {
        setMessage({ type: 'success', text: 'Database tables created! Now seed players.' })
        fetchDraftState()
      } else {
        setMessage({ type: 'error', text: data.error || 'Init failed' })
      }
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message })
    } finally {
      setLoading(false)
    }
  }

  async function seedPlayers() {
    setLoading(true)
    setMessage(null)
    try {
      const res = await fetch('/api/admin/seed', {
        method: 'POST',
        headers: { 'x-admin-key': adminKey },
      })
      const data = await res.json()
      if (res.ok) {
        setMessage({
          type: 'success',
          text: `Seeded ${data.count} players! Tier breakdown: ${Object.entries(data.tierBreakdown || {}).map(([t, c]) => `T${t}:${c}`).join(', ')}`,
        })
        // Reload players
        setLoadingPlayers(true)
        const playersRes = await fetch('/api/admin/players', { headers: { 'x-admin-key': adminKey } })
        if (playersRes.ok) setPlayers(await playersRes.json())
        setLoadingPlayers(false)
        fetchDraftState()
      } else {
        setMessage({ type: 'error', text: data.error || 'Seed failed' })
      }
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message })
    } finally {
      setLoading(false)
    }
  }

  async function resetDraft() {
    if (!confirm(`Reset draft? This will clear all picks. ${firstDrafter === 'cody' ? 'Cody' : 'Jeremy'} will pick first.`)) return
    setLoading(true)
    setMessage(null)
    try {
      const res = await fetch('/api/admin/reset', {
        method: 'POST',
        headers: { 'x-admin-key': adminKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstDrafter }),
      })
      const data = await res.json()
      if (res.ok) {
        setMessage({ type: 'success', text: `Draft reset. ${firstDrafter === 'cody' ? 'Cody' : 'Jeremy'} picks first.` })
        fetchDraftState()
      } else {
        setMessage({ type: 'error', text: data.error })
      }
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message })
    } finally {
      setLoading(false)
    }
  }

  async function updatePlayerTier(playerId: string, newTier: number) {
    const res = await fetch('/api/admin/players', {
      method: 'PATCH',
      headers: { 'x-admin-key': adminKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: playerId, tier: newTier }),
    })
    if (res.ok) {
      setPlayers((prev) => prev.map((p) => p.id === playerId ? { ...p, tier: newTier } : p))
    }
  }

  async function toggleInField(playerId: string, current: boolean) {
    const res = await fetch('/api/admin/players', {
      method: 'PATCH',
      headers: { 'x-admin-key': adminKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: playerId, in_field: !current }),
    })
    if (res.ok) {
      setPlayers((prev) => prev.map((p) => p.id === playerId ? { ...p, in_field: !current } : p))
    }
  }

  const tierGroups = [1, 2, 3, 4, 5, 6, 7].map((tier) => ({
    tier,
    label: TIER_LABELS[tier],
    players: players.filter((p) => p.tier === tier && p.in_field),
  }))

  if (!authed) {
    return (
      <div className="max-w-md mx-auto px-4 py-16">
        <div className="rounded-xl p-6 shadow-sm" style={{ backgroundColor: '#fff', border: '1px solid #d4c9b0' }}>
          <h1 className="text-xl font-bold mb-4" style={{ fontFamily: 'Georgia, serif', color: 'var(--masters-green)' }}>
            Admin
          </h1>
          <div className="space-y-3">
            <input
              type="password"
              placeholder="Admin key"
              value={adminKey}
              onChange={(e) => setAdminKey(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && authenticate()}
              className="w-full border px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2"
              style={{ borderColor: '#d4c9b0', fontFamily: 'system-ui' }}
            />
            <button
              onClick={authenticate}
              disabled={loading}
              className="w-full py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
              style={{ backgroundColor: 'var(--masters-green)' }}
            >
              {loading ? 'Checking...' : 'Enter'}
            </button>
          </div>
          {message && (
            <p className="mt-3 text-sm text-red-600">{message.text}</p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      <h1 className="text-2xl font-bold" style={{ fontFamily: 'Georgia, serif', color: 'var(--masters-green)' }}>
        Admin
      </h1>

      {message && (
        <div
          className={`px-4 py-3 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}
        >
          {message.text}
        </div>
      )}

      {/* Draft state info */}
      {draftState && (
        <div className="rounded-xl p-4 text-sm" style={{ backgroundColor: '#fff', border: '1px solid #d4c9b0' }}>
          <div className="font-semibold mb-2" style={{ color: 'var(--masters-green)' }}>Draft Status</div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div><span className="text-gray-400">Status:</span> {draftState.is_complete ? '✅ Complete' : '🏌️ In Progress'}</div>
            <div><span className="text-gray-400">Pick:</span> {draftState.current_pick_order} / 16</div>
            <div><span className="text-gray-400">Current drafter:</span> {draftState.current_drafter}</div>
            <div><span className="text-gray-400">Current tier:</span> T{draftState.current_tier}</div>
            <div><span className="text-gray-400">First drafter:</span> {draftState.first_drafter}</div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="rounded-xl p-4 space-y-4" style={{ backgroundColor: '#fff', border: '1px solid #d4c9b0' }}>
        <div className="font-semibold" style={{ color: 'var(--masters-green)' }}>Actions</div>

        <div className="flex flex-wrap gap-3 items-end">
          <button
            onClick={initDb}
            disabled={loading}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50 opacity-70"
            style={{ backgroundColor: '#555' }}
          >
            {loading ? 'Loading...' : '① Initialize Database (first time only)'}
          </button>
          <button
            onClick={seedPlayers}
            disabled={loading}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
            style={{ backgroundColor: 'var(--masters-green)' }}
          >
            {loading ? 'Loading...' : '② Seed / Refresh Players from ESPN'}
          </button>
        </div>

        <div className="flex flex-wrap gap-3 items-end border-t pt-4" style={{ borderColor: '#ece6d9' }}>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">First drafter:</label>
            <select
              value={firstDrafter}
              onChange={(e) => setFirstDrafter(e.target.value as 'cody' | 'jeremy')}
              className="border rounded px-2 py-1 text-sm"
              style={{ borderColor: '#d4c9b0' }}
            >
              <option value="cody">Cody</option>
              <option value="jeremy">Jeremy</option>
            </select>
          </div>
          <button
            onClick={resetDraft}
            disabled={loading}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-red-600 text-white disabled:opacity-50 hover:bg-red-700"
          >
            ③ Reset Draft
          </button>
        </div>
      </div>

      {/* Player list by tier */}
      <div className="space-y-4">
        <div className="font-semibold" style={{ color: 'var(--masters-green)' }}>
          Player List ({players.filter(p => p.in_field).length} in field)
        </div>
        {loadingPlayers ? (
          <p className="text-sm text-gray-400">Loading...</p>
        ) : (
          tierGroups.map(({ tier, label, players: tierPlayers }) => (
            <div key={tier} className="rounded-xl overflow-hidden shadow-sm" style={{ border: '1px solid #d4c9b0' }}>
              <div className="px-4 py-2 text-sm font-semibold text-white flex items-center justify-between"
                style={{ backgroundColor: 'var(--masters-green)' }}>
                <span>Tier {tier} — {label}</span>
                <span className="opacity-70 text-xs">{tierPlayers.length} players</span>
              </div>
              <div className="divide-y bg-white" style={{ borderColor: '#ece6d9' }}>
                {tierPlayers.length === 0 ? (
                  <div className="px-4 py-3 text-sm text-gray-400">No players</div>
                ) : (
                  tierPlayers.map((player) => (
                    <div key={player.id} className="px-4 py-2.5 flex items-center gap-3 text-sm">
                      <span className="flex-1 font-medium" style={{ fontFamily: 'Georgia, serif' }}>{player.name}</span>
                      {player.is_liv && (
                        <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: '#fff3e0', color: '#e65100' }}>
                          LIV
                        </span>
                      )}
                      <span className="text-xs text-gray-400">#{player.world_rank ?? '?'}</span>
                      <select
                        value={player.tier}
                        onChange={(e) => updatePlayerTier(player.id, parseInt(e.target.value))}
                        className="border rounded px-1 py-0.5 text-xs"
                        style={{ borderColor: '#d4c9b0' }}
                      >
                        {[1,2,3,4,5,6,7].map(t => <option key={t} value={t}>T{t}</option>)}
                      </select>
                      <button
                        onClick={() => toggleInField(player.id, player.in_field)}
                        className="text-xs text-red-500 hover:text-red-700"
                      >
                        Remove
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

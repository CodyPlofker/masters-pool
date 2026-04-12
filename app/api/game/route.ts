import { NextResponse } from 'next/server'
import { fetchMastersLeaderboard } from '@/lib/espn'
import { query } from '@/lib/db'

function parsePosition(pos: string): number | null {
  if (!pos) return null
  const n = parseInt(pos.replace(/^T/, ''))
  return isNaN(n) ? null : n
}

function calcR3Score(pick: any, currentPos: number | null): number {
  if (currentPos === null) return 0
  const start = pick.starting_position
  const pctChange = (start - currentPos) / start

  if (pick.direction === 'long') {
    return Math.round(pctChange * 100 * 10) / 10
  } else {
    const shortGain = -pctChange
    if (shortGain >= 0) {
      return Math.round(shortGain * 100 * 10) / 10
    } else {
      return Math.round(shortGain * 100 * 2 * 10) / 10
    }
  }
}

export async function GET() {
  try {
    const [leaderboard, picks, r4Config] = await Promise.all([
      fetchMastersLeaderboard(),
      query`SELECT * FROM game_picks ORDER BY created_at ASC`,
      query<{ target_sum: number | null; set_by: string | null }>`
        SELECT target_sum, set_by FROM game_r4_config WHERE id = 1
      `.catch(() => [{ target_sum: null, set_by: null }]),
    ])

    const r4target = r4Config[0]?.target_sum ?? null
    const r4setBy = r4Config[0]?.set_by ?? null

    // Active golfers with live total_score, sorted by position
    const activeGolfers = leaderboard
      .filter((g) => g.status !== 'cut' && g.status !== 'wd')
      .map((g) => ({ ...g, numericPos: parsePosition(g.position) }))
      .sort((a, b) => {
        if (a.numericPos === null) return 1
        if (b.numericPos === null) return -1
        return a.numericPos - b.numericPos
      })

    // Golfers already picked in R4 (blocked)
    const r4PickedIds = new Set(
      picks
        .filter((p: any) => p.round === 4)
        .map((p: any) => p.golfer_espn_id)
    )

    // Enrich picks
    const enrichedPicks = picks.map((pick: any) => {
      const live = leaderboard.find(
        (g) => g.espn_id === pick.golfer_espn_id || g.name.toLowerCase() === pick.golfer_name.toLowerCase()
      )
      let score = 0
      if (pick.round === 3) {
        const currentPos = live ? parsePosition(live.position) : null
        score = calcR3Score(pick, currentPos)
      } else {
        // R4: score = today's strokes (lower is better, so negate for leaderboard sort)
        score = live?.today ?? 0
      }
      return {
        ...pick,
        current_position: live ? parsePosition(live.position) : null,
        live_status: live?.status ?? null,
        live_total: live?.total_score ?? null,
        live_today: live?.today ?? null,
        score,
      }
    })

    // Aggregate by player_name across all rounds
    // R3: higher score = better. R4: lower today = better — so for combined leaderboard,
    // we store R4 as negative-today so descending sort still works.
    const playerMap: Record<string, { name: string; r3total: number; r4today: number | null; picks: any[] }> = {}
    for (const pick of enrichedPicks) {
      const name = pick.player_name
      if (!playerMap[name]) playerMap[name] = { name, r3total: 0, r4today: null, picks: [] }
      if (pick.round === 3) {
        playerMap[name].r3total = Math.round((playerMap[name].r3total + pick.score) * 10) / 10
      } else {
        // Sum today's strokes for R4
        playerMap[name].r4today = (playerMap[name].r4today ?? 0) + (pick.live_today ?? 0)
      }
      playerMap[name].picks.push(pick)
    }

    // Build leaderboard — sort by R3 descending (higher = better), with R4 as separate field
    const leaderboardByPlayer = Object.values(playerMap).sort((a, b) => b.r3total - a.r3total)

    // Players who have already submitted R4 picks
    const r4submitters = new Set(
      picks.filter((p: any) => p.round === 4).map((p: any) => p.player_name)
    )

    return NextResponse.json({
      activeGolfers,
      leaderboard: leaderboardByPlayer,
      allPicks: enrichedPicks,
      r4: {
        target: r4target,
        setBy: r4setBy,
        pickedIds: [...r4PickedIds],
        submitters: [...r4submitters],
      },
      updatedAt: new Date().toISOString(),
    })
  } catch (err: any) {
    console.error(err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

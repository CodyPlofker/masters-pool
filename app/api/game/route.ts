import { NextResponse } from 'next/server'
import { fetchMastersLeaderboard } from '@/lib/espn'
import { query } from '@/lib/db'

function parsePosition(pos: string): number | null {
  if (!pos) return null
  const n = parseInt(pos.replace(/^T/, ''))
  return isNaN(n) ? null : n
}

function calcScore(pick: any, currentPos: number | null): number {
  if (currentPos === null) return 0
  const start = pick.starting_position
  const pctChange = (start - currentPos) / start  // positive = climbed

  if (pick.direction === 'long') {
    return Math.round(pctChange * 100 * 10) / 10
  } else {
    // short: profit if they fell (pctChange negative means they fell = good for short)
    const shortGain = -pctChange  // positive if they fell
    if (shortGain >= 0) {
      // They fell — short pays off
      return Math.round(shortGain * 100 * 10) / 10
    } else {
      // They climbed — short penalized 2x
      return Math.round(shortGain * 100 * 2 * 10) / 10
    }
  }
}

export async function GET() {
  try {
    const [leaderboard, picks] = await Promise.all([
      fetchMastersLeaderboard(),
      query`SELECT * FROM game_picks ORDER BY created_at ASC`,
    ])

    // Active golfers (non-cut, non-wd), sorted by numeric position
    const activeGolfers = leaderboard
      .filter((g) => g.status !== 'cut' && g.status !== 'wd')
      .map((g) => ({ ...g, numericPos: parsePosition(g.position) }))
      .sort((a, b) => {
        if (a.numericPos === null) return 1
        if (b.numericPos === null) return -1
        return a.numericPos - b.numericPos
      })

    // Enrich picks with live position and score
    const enrichedPicks = picks.map((pick: any) => {
      const live = leaderboard.find(
        (g) => g.espn_id === pick.golfer_espn_id || g.name.toLowerCase() === pick.golfer_name.toLowerCase()
      )
      const currentPos = live ? parsePosition(live.position) : null
      const score = calcScore(pick, currentPos)
      return {
        ...pick,
        current_position: currentPos,
        live_status: live?.status ?? null,
        score,
      }
    })

    // Aggregate by player_name
    const playerMap: Record<string, { name: string; total: number; picks: any[] }> = {}
    for (const pick of enrichedPicks) {
      const name = pick.player_name
      if (!playerMap[name]) playerMap[name] = { name, total: 0, picks: [] }
      playerMap[name].total = Math.round((playerMap[name].total + pick.score) * 10) / 10
      playerMap[name].picks.push(pick)
    }

    const leaderboardByPlayer = Object.values(playerMap).sort((a, b) => b.total - a.total)

    return NextResponse.json({
      activeGolfers,
      leaderboard: leaderboardByPlayer,
      allPicks: enrichedPicks,
      updatedAt: new Date().toISOString(),
    })
  } catch (err: any) {
    console.error(err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { fetchMastersLeaderboard } from '@/lib/espn'
import { query } from '@/lib/db'

function parsePosition(pos: string): number | null {
  if (!pos) return null
  const n = parseInt(pos.replace(/^T/, ''))
  return isNaN(n) ? null : n
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { player_name, round, golfer_espn_id, direction } = body

    if (!player_name || !round || !golfer_espn_id || !direction) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }
    if (!['long', 'short'].includes(direction)) {
      return NextResponse.json({ error: 'direction must be "long" or "short"' }, { status: 400 })
    }
    if (![3, 4].includes(round)) {
      return NextResponse.json({ error: 'round must be 3 or 4' }, { status: 400 })
    }

    const normalizedName = player_name.trim().toLowerCase()

    // Check max 3 picks per (player_name, round)
    const existing = await query`
      SELECT id FROM game_picks
      WHERE player_name = ${normalizedName} AND round = ${round}
    `
    if (existing.length >= 3) {
      return NextResponse.json({ error: 'You already have 3 picks for this round' }, { status: 400 })
    }

    // Look up golfer on live leaderboard for starting position
    const leaderboard = await fetchMastersLeaderboard()
    const golfer = leaderboard.find((g) => g.espn_id === golfer_espn_id)
    if (!golfer) {
      return NextResponse.json({ error: 'Golfer not found on leaderboard' }, { status: 404 })
    }
    if (golfer.status === 'cut' || golfer.status === 'wd') {
      return NextResponse.json({ error: 'Cannot pick a cut or withdrawn golfer' }, { status: 400 })
    }

    const startingPosition = parsePosition(golfer.position)
    if (startingPosition === null) {
      return NextResponse.json({ error: 'Could not determine golfer position' }, { status: 400 })
    }

    await query`
      INSERT INTO game_picks (player_name, round, golfer_espn_id, golfer_name, starting_position, direction)
      VALUES (${normalizedName}, ${round}, ${golfer_espn_id}, ${golfer.name}, ${startingPosition}, ${direction})
      ON CONFLICT (player_name, round, golfer_espn_id) DO NOTHING
    `

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error(err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { fetchMastersLeaderboard } from '@/lib/espn'
import { query } from '@/lib/db'

function parsePosition(pos: string): number | null {
  if (!pos) return null
  const n = parseInt(pos.replace(/^T/, ''))
  return isNaN(n) ? null : n
}

// ── Round 3 handler (long/short game) ───────────────────────────────────────
async function handleR3(body: any, normalizedName: string) {
  const { round, golfer_espn_id, direction } = body

  if (!['long', 'short'].includes(direction)) {
    return NextResponse.json({ error: 'direction must be "long" or "short"' }, { status: 400 })
  }

  const existing = await query<{ direction: string }>`
    SELECT direction FROM game_picks
    WHERE player_name = ${normalizedName} AND round = ${round}
  `
  const longCount = existing.filter((p) => p.direction === 'long').length
  const shortCount = existing.filter((p) => p.direction === 'short').length

  if (existing.length >= 3) {
    return NextResponse.json({ error: 'You already have 3 picks for this round' }, { status: 400 })
  }
  if (direction === 'long' && longCount >= 2) {
    return NextResponse.json({ error: 'You already have 2 long picks — only a short pick is allowed' }, { status: 400 })
  }
  if (direction === 'short' && shortCount >= 1) {
    return NextResponse.json({ error: 'You already have a short pick — only long picks are allowed' }, { status: 400 })
  }

  const leaderboard = await fetchMastersLeaderboard()
  const golfer = leaderboard.find((g) => g.espn_id === golfer_espn_id)
  if (!golfer) return NextResponse.json({ error: 'Golfer not found on leaderboard' }, { status: 404 })
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
}

// ── Round 4 handler (sum-match game) ────────────────────────────────────────
async function handleR4(body: any, normalizedName: string) {
  // Expects: { player_name, round:4, picks: [{golfer_espn_id}] } — exactly 3
  const { picks } = body

  if (!Array.isArray(picks) || picks.length !== 3) {
    return NextResponse.json({ error: 'R4 requires exactly 3 picks submitted together' }, { status: 400 })
  }

  // Check player hasn't already submitted for R4
  const existing = await query`
    SELECT id FROM game_picks WHERE player_name = ${normalizedName} AND round = 4
  `
  if (existing.length > 0) {
    return NextResponse.json({ error: 'You have already submitted your R4 picks' }, { status: 400 })
  }

  // Resolve all 3 golfers from live leaderboard
  const leaderboard = await fetchMastersLeaderboard()
  const resolvedPicks: { espn_id: string; name: string; total_score: number; position: number }[] = []

  for (const pick of picks) {
    const golfer = leaderboard.find((g) => g.espn_id === pick.golfer_espn_id)
    if (!golfer) return NextResponse.json({ error: `Golfer ${pick.golfer_espn_id} not found` }, { status: 404 })
    if (golfer.status === 'cut' || golfer.status === 'wd') {
      return NextResponse.json({ error: `${golfer.name} has been cut` }, { status: 400 })
    }
    const pos = parsePosition(golfer.position)
    if (pos === null) return NextResponse.json({ error: `Could not determine position for ${golfer.name}` }, { status: 400 })
    resolvedPicks.push({ espn_id: golfer.espn_id, name: golfer.name, total_score: golfer.total_score, position: pos })
  }

  const mySum = resolvedPicks.reduce((s, g) => s + g.total_score, 0)

  // Check for duplicate golfers within the submission
  const ids = resolvedPicks.map((g) => g.espn_id)
  if (new Set(ids).size !== 3) {
    return NextResponse.json({ error: 'All 3 picks must be different golfers' }, { status: 400 })
  }

  // Check no golfer is already picked by someone else in R4
  for (const g of resolvedPicks) {
    const taken = await query`
      SELECT player_name FROM game_picks WHERE round = 4 AND golfer_espn_id = ${g.espn_id}
    `
    if (taken.length > 0) {
      return NextResponse.json({ error: `${g.name} has already been picked by ${taken[0].player_name}` }, { status: 400 })
    }
  }

  // Get or set the target sum
  const config = await query<{ target_sum: number | null; set_by: string | null }>`
    SELECT target_sum, set_by FROM game_r4_config WHERE id = 1
  `
  const cfg = config[0]

  if (cfg.target_sum === null) {
    // First submitter — lock in the target
    await query`
      UPDATE game_r4_config
      SET target_sum = ${mySum}, set_by = ${normalizedName}, locked_at = now()
      WHERE id = 1
    `
  } else {
    // Validate against existing target
    if (mySum !== cfg.target_sum) {
      return NextResponse.json({
        error: `Your picks sum to ${mySum > 0 ? '+' : ''}${mySum}, but the target is ${cfg.target_sum > 0 ? '+' : ''}${cfg.target_sum}. Adjust your picks.`,
      }, { status: 400 })
    }
  }

  // Insert all 3 picks
  for (const g of resolvedPicks) {
    await query`
      INSERT INTO game_picks (player_name, round, golfer_espn_id, golfer_name, starting_position, direction)
      VALUES (${normalizedName}, ${4}, ${g.espn_id}, ${g.name}, ${g.position}, null)
    `
  }

  return NextResponse.json({ success: true, sum: mySum })
}

// ── Main handler ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { player_name, round } = body

    if (!player_name || !round) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }
    if (![3, 4].includes(round)) {
      return NextResponse.json({ error: 'round must be 3 or 4' }, { status: 400 })
    }

    const normalizedName = player_name.trim().toLowerCase()

    if (round === 3) return handleR3(body, normalizedName)
    return handleR4(body, normalizedName)
  } catch (err: any) {
    console.error(err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getDraftSchedule } from '@/lib/supabase'

export async function GET() {
  try {
    const rows = await query`SELECT * FROM draft_state WHERE id = 1`
    if (!rows.length) return NextResponse.json({ error: 'Draft state not found' }, { status: 500 })
    return NextResponse.json(rows[0])
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { player_id } = body

  if (!player_id) return NextResponse.json({ error: 'player_id required' }, { status: 400 })

  try {
    const stateRows = await query`SELECT * FROM draft_state WHERE id = 1`
    if (!stateRows.length) return NextResponse.json({ error: 'Draft state not found' }, { status: 500 })
    const state = stateRows[0]

    if (state.is_complete) return NextResponse.json({ error: 'Draft is already complete' }, { status: 400 })

    const schedule = getDraftSchedule(state.first_drafter)
    const pickIndex = state.current_pick_order - 1
    const currentSlot = schedule[pickIndex]

    if (!currentSlot) return NextResponse.json({ error: 'No more picks available' }, { status: 400 })

    // Verify player
    const playerRows = await query`SELECT * FROM players WHERE id = ${player_id}`
    if (!playerRows.length) return NextResponse.json({ error: 'Player not found' }, { status: 404 })
    const player = playerRows[0]

    if (player.tier !== currentSlot.tier) {
      return NextResponse.json(
        { error: `Player must be from tier ${currentSlot.tier}` },
        { status: 400 }
      )
    }

    // Check not already picked
    const existing = await query`SELECT id FROM picks WHERE player_id = ${player_id}`
    if (existing.length) return NextResponse.json({ error: 'Player already picked' }, { status: 400 })

    // Insert pick
    await query`
      INSERT INTO picks (player_id, drafted_by, tier, pick_order)
      VALUES (${player_id}, ${currentSlot.drafter}, ${currentSlot.tier}, ${state.current_pick_order})
    `

    // Advance state
    const nextPickOrder = state.current_pick_order + 1
    const isComplete = nextPickOrder > schedule.length
    const nextSlot = schedule[nextPickOrder - 1]

    await query`
      UPDATE draft_state SET
        current_pick_order = ${nextPickOrder},
        current_drafter = ${nextSlot?.drafter ?? currentSlot.drafter},
        current_tier = ${nextSlot?.tier ?? currentSlot.tier},
        is_complete = ${isComplete}
      WHERE id = 1
    `

    return NextResponse.json({
      success: true,
      pick: { player, drafter: currentSlot.drafter, tier: currentSlot.tier, order: state.current_pick_order },
      next: isComplete ? null : nextSlot,
      is_complete: isComplete,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

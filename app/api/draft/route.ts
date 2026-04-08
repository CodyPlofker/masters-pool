import { NextRequest, NextResponse } from 'next/server'
import { supabase, getDraftSchedule } from '@/lib/supabase'

export async function GET() {
  const { data, error } = await supabase.from('draft_state').select('*').eq('id', 1).single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { player_id } = body

  if (!player_id) {
    return NextResponse.json({ error: 'player_id required' }, { status: 400 })
  }

  // Get current draft state
  const { data: state, error: stateError } = await supabase
    .from('draft_state')
    .select('*')
    .eq('id', 1)
    .single()

  if (stateError || !state) {
    return NextResponse.json({ error: 'Draft state not found' }, { status: 500 })
  }

  if (state.is_complete) {
    return NextResponse.json({ error: 'Draft is already complete' }, { status: 400 })
  }

  // Build the full schedule
  const schedule = getDraftSchedule(state.first_drafter)
  const pickIndex = state.current_pick_order - 1 // 0-based
  const currentSlot = schedule[pickIndex]

  if (!currentSlot) {
    return NextResponse.json({ error: 'No more picks available' }, { status: 400 })
  }

  // Verify player exists in the correct tier and is available
  const { data: player, error: playerError } = await supabase
    .from('players')
    .select('*')
    .eq('id', player_id)
    .single()

  if (playerError || !player) {
    return NextResponse.json({ error: 'Player not found' }, { status: 404 })
  }

  if (player.tier !== currentSlot.tier) {
    return NextResponse.json(
      { error: `Player must be from tier ${currentSlot.tier} (${player.tier} given)` },
      { status: 400 }
    )
  }

  // Check player not already picked
  const { data: existingPick } = await supabase
    .from('picks')
    .select('id')
    .eq('player_id', player_id)
    .single()

  if (existingPick) {
    return NextResponse.json({ error: 'Player already picked' }, { status: 400 })
  }

  // Insert the pick
  const { error: pickError } = await supabase.from('picks').insert({
    player_id,
    drafted_by: currentSlot.drafter,
    tier: currentSlot.tier,
    pick_order: state.current_pick_order,
  })

  if (pickError) {
    return NextResponse.json({ error: pickError.message }, { status: 500 })
  }

  // Advance draft state
  const nextPickOrder = state.current_pick_order + 1
  const isComplete = nextPickOrder > schedule.length
  const nextSlot = schedule[nextPickOrder - 1]

  const { error: updateError } = await supabase
    .from('draft_state')
    .update({
      current_pick_order: nextPickOrder,
      current_drafter: nextSlot?.drafter || currentSlot.drafter,
      current_tier: nextSlot?.tier || currentSlot.tier,
      is_complete: isComplete,
    })
    .eq('id', 1)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    pick: { player, drafter: currentSlot.drafter, tier: currentSlot.tier, order: state.current_pick_order },
    next: isComplete ? null : nextSlot,
    is_complete: isComplete,
  })
}

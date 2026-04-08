import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { fetchMastersField, assignTier } from '@/lib/espn'

export async function POST(req: NextRequest) {
  const adminKey = req.headers.get('x-admin-key')
  if (adminKey !== process.env.ADMIN_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const field = await fetchMastersField()

    if (!field.length) {
      return NextResponse.json({ error: 'No players found from ESPN' }, { status: 500 })
    }

    // Clear existing players
    await supabase.from('picks').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await supabase.from('players').delete().neq('id', '00000000-0000-0000-0000-000000000000')

    // Reset draft state
    await supabase.from('draft_state').update({
      current_pick_order: 1,
      current_drafter: 'cody',
      current_tier: 1,
      tier_pick_index: 0,
      is_complete: false,
    }).eq('id', 1)

    const players = field.map((p) => ({
      name: p.name,
      espn_id: p.id,
      world_rank: p.worldRank,
      tier: assignTier(p.worldRank, p.isLiv),
      is_liv: p.isLiv,
      in_field: true,
    }))

    const { data, error } = await supabase.from('players').insert(players).select()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Count by tier
    const tierCounts: Record<number, number> = {}
    players.forEach((p) => {
      tierCounts[p.tier] = (tierCounts[p.tier] || 0) + 1
    })

    return NextResponse.json({
      success: true,
      count: players.length,
      tierBreakdown: tierCounts,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

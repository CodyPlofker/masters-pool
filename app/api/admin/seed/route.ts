import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { fetchMastersField, assignTier } from '@/lib/espn'

export async function POST(req: NextRequest) {
  if (req.headers.get('x-admin-key') !== process.env.ADMIN_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const field = await fetchMastersField()
    if (!field.length) return NextResponse.json({ error: 'No players found from ESPN' }, { status: 500 })

    // Clear existing data
    await query`DELETE FROM picks`
    await query`DELETE FROM players`
    await query`
      UPDATE draft_state SET
        current_pick_order = 1,
        current_drafter = 'cody',
        current_tier = 1,
        tier_pick_index = 0,
        is_complete = false
      WHERE id = 1
    `

    // Insert players one by one (neon tagged template doesn't support bulk inserts easily)
    for (const p of field) {
      const tier = assignTier(p.worldRank)
      await query`
        INSERT INTO players (name, espn_id, world_rank, tier, is_liv, in_field)
        VALUES (${p.name}, ${p.id}, ${p.worldRank}, ${tier}, false, true)
      `
    }

    const tierCounts: Record<number, number> = {}
    field.forEach((p) => {
      const t = assignTier(p.worldRank)
      tierCounts[t] = (tierCounts[t] || 0) + 1
    })

    return NextResponse.json({ success: true, count: field.length, tierBreakdown: tierCounts })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

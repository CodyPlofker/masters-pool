import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

export async function POST(req: NextRequest) {
  if (req.headers.get('x-admin-key') !== process.env.ADMIN_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const firstDrafter = body.firstDrafter || 'cody'

  try {
    await query`DELETE FROM picks`
    await query`
      UPDATE draft_state SET
        current_pick_order = 1,
        current_drafter = ${firstDrafter},
        current_tier = 1,
        tier_pick_index = 0,
        is_complete = false,
        first_drafter = ${firstDrafter}
      WHERE id = 1
    `
    return NextResponse.json({ success: true, firstDrafter })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

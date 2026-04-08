import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const adminKey = req.headers.get('x-admin-key')
  if (adminKey !== process.env.ADMIN_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const firstDrafter = body.firstDrafter || 'cody'

  // Clear picks only (keep players)
  await supabase.from('picks').delete().neq('id', '00000000-0000-0000-0000-000000000000')

  // Reset draft state
  await supabase.from('draft_state').update({
    current_pick_order: 1,
    current_drafter: firstDrafter,
    current_tier: 1,
    tier_pick_index: 0,
    is_complete: false,
    first_drafter: firstDrafter,
  }).eq('id', 1)

  return NextResponse.json({ success: true, firstDrafter })
}

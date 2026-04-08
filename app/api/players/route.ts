import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const tier = req.nextUrl.searchParams.get('tier')

  let query = supabase
    .from('players')
    .select('*')
    .eq('in_field', true)
    .order('world_rank', { ascending: true, nullsFirst: false })

  if (tier) {
    query = query.eq('tier', parseInt(tier))
  }

  // Exclude already-picked players
  const { data: pickedIds } = await supabase.from('picks').select('player_id')
  const ids = (pickedIds || []).map((p: any) => p.player_id)

  if (ids.length > 0) {
    query = query.not('id', 'in', `(${ids.join(',')})`)
  }

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

export async function GET(req: NextRequest) {
  if (req.headers.get('x-admin-key') !== process.env.ADMIN_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const rows = await query`SELECT * FROM players ORDER BY tier ASC, world_rank ASC NULLS LAST`
    return NextResponse.json(rows)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  if (req.headers.get('x-admin-key') !== process.env.ADMIN_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { id, tier, in_field } = body

  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  try {
    let rows: any[]
    if (tier !== undefined && in_field !== undefined) {
      rows = await query`UPDATE players SET tier = ${tier}, in_field = ${in_field} WHERE id = ${id} RETURNING *`
    } else if (tier !== undefined) {
      rows = await query`UPDATE players SET tier = ${tier} WHERE id = ${id} RETURNING *`
    } else if (in_field !== undefined) {
      rows = await query`UPDATE players SET in_field = ${in_field} WHERE id = ${id} RETURNING *`
    } else {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }
    return NextResponse.json(rows[0])
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

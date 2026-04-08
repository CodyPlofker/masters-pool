import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

export async function GET(req: NextRequest) {
  const tier = req.nextUrl.searchParams.get('tier')

  try {
    const rows = tier
      ? await query`
          SELECT * FROM players
          WHERE in_field = true
            AND tier = ${parseInt(tier)}
            AND id NOT IN (SELECT player_id FROM picks)
          ORDER BY world_rank ASC NULLS LAST
        `
      : await query`
          SELECT * FROM players
          WHERE in_field = true
            AND id NOT IN (SELECT player_id FROM picks)
          ORDER BY tier ASC, world_rank ASC NULLS LAST
        `

    return NextResponse.json(rows)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

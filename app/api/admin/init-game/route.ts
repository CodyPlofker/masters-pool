import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

export async function POST(req: NextRequest) {
  if (req.headers.get('x-admin-key') !== process.env.ADMIN_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await query`DROP TABLE IF EXISTS game_picks CASCADE`

    await query`
      CREATE TABLE IF NOT EXISTS game_picks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        player_name TEXT NOT NULL,
        round INT NOT NULL CHECK (round IN (3, 4)),
        golfer_espn_id TEXT NOT NULL,
        golfer_name TEXT NOT NULL,
        starting_position INT NOT NULL,
        direction TEXT NOT NULL CHECK (direction IN ('long', 'short')),
        created_at TIMESTAMPTZ DEFAULT now(),
        UNIQUE(player_name, round, golfer_espn_id)
      )
    `

    return NextResponse.json({ success: true, message: 'game_picks table created' })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

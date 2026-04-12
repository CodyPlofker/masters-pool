import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

export async function POST(req: NextRequest) {
  if (req.headers.get('x-admin-key') !== process.env.ADMIN_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await query`DROP TABLE IF EXISTS game_r4_config CASCADE`
    await query`DROP TABLE IF EXISTS game_picks CASCADE`

    await query`
      CREATE TABLE IF NOT EXISTS game_picks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        player_name TEXT NOT NULL,
        round INT NOT NULL CHECK (round IN (3, 4)),
        golfer_espn_id TEXT NOT NULL,
        golfer_name TEXT NOT NULL,
        starting_position INT NOT NULL,
        direction TEXT CHECK (direction IN ('long', 'short')),
        created_at TIMESTAMPTZ DEFAULT now(),
        UNIQUE(player_name, round, golfer_espn_id)
      )
    `

    await query`
      CREATE TABLE IF NOT EXISTS game_r4_config (
        id INT PRIMARY KEY DEFAULT 1,
        target_sum INT,
        set_by TEXT,
        locked_at TIMESTAMPTZ
      )
    `

    await query`
      INSERT INTO game_r4_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING
    `

    return NextResponse.json({ success: true, message: 'game_picks and game_r4_config tables created' })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

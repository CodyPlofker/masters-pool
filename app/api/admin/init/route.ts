import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

// One-time DB setup — creates tables and seeds draft_state row
export async function POST(req: NextRequest) {
  if (req.headers.get('x-admin-key') !== process.env.ADMIN_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Drop existing tables to apply fresh schema (safe — no important data yet)
    await query`DROP TABLE IF EXISTS picks CASCADE`
    await query`DROP TABLE IF EXISTS players CASCADE`
    await query`DROP TABLE IF EXISTS draft_state CASCADE`

    await query`
      CREATE TABLE IF NOT EXISTS players (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        espn_id TEXT,
        world_rank INT,
        tier INT NOT NULL CHECK (tier BETWEEN 1 AND 6),
        is_liv BOOLEAN DEFAULT false,
        in_field BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT now()
      )
    `

    await query`
      CREATE TABLE IF NOT EXISTS picks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        player_id UUID REFERENCES players(id) ON DELETE CASCADE,
        drafted_by TEXT NOT NULL CHECK (drafted_by IN ('cody', 'jeremy')),
        tier INT NOT NULL,
        pick_order INT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT now(),
        UNIQUE(player_id),
        UNIQUE(pick_order)
      )
    `

    await query`
      CREATE TABLE IF NOT EXISTS draft_state (
        id INT PRIMARY KEY DEFAULT 1,
        current_pick_order INT DEFAULT 1,
        current_drafter TEXT DEFAULT 'cody',
        current_tier INT DEFAULT 1,
        tier_pick_index INT DEFAULT 0,
        is_complete BOOLEAN DEFAULT false,
        first_drafter TEXT DEFAULT 'cody'
      )
    `

    await query`
      INSERT INTO draft_state (id) VALUES (1)
      ON CONFLICT (id) DO NOTHING
    `

    return NextResponse.json({ success: true, message: 'Tables created and draft state initialized' })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

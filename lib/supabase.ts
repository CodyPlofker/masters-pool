import { createClient, SupabaseClient } from '@supabase/supabase-js'

let _supabase: SupabaseClient | null = null

function getSupabase(): SupabaseClient {
  if (!_supabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !key) throw new Error('Supabase env vars not set')
    _supabase = createClient(url, key)
  }
  return _supabase
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    const client = getSupabase()
    const val = (client as any)[prop]
    return typeof val === 'function' ? val.bind(client) : val
  },
})

export type Player = {
  id: string
  name: string
  espn_id: string | null
  world_rank: number | null
  tier: number
  is_liv: boolean
  in_field: boolean
}

export type Pick = {
  id: string
  player_id: string
  drafted_by: 'cody' | 'jeremy'
  tier: number
  pick_order: number
  player?: Player
}

export type DraftState = {
  id: number
  current_pick_order: number
  current_drafter: 'cody' | 'jeremy'
  current_tier: number
  tier_pick_index: number
  is_complete: boolean
  first_drafter: 'cody' | 'jeremy'
}

export type LiveScore = {
  espn_id: string
  name: string
  position: string
  total_score: number // strokes to par (negative = under par)
  today: number
  thru: string
  status: 'active' | 'cut' | 'wd' | 'complete'
  rounds: number[]
}

export const TIER_LABELS: Record<number, string> = {
  1: 'Ranks 1–10',
  2: 'Ranks 11–20',
  3: 'Ranks 21–30',
  4: 'Ranks 31–40',
  5: 'Ranks 41–50',
  6: 'Ranks 51+',
  7: 'LIV Tour',
}

export const PICKS_PER_TIER: Record<number, number> = {
  1: 1,
  2: 1,
  3: 1,
  4: 1,
  5: 1,
  6: 2,
  7: 1,
}

// Snake draft order: for each tier, who picks first?
// Tier 1 → first_drafter, Tier 2 → second, Tier 3 → first, ...
// For Tier 6 (2 picks each): first-first, first-second, second-second, second-first (snake within)
export function getDraftSchedule(firstDrafter: 'cody' | 'jeremy'): Array<{ tier: number; drafter: 'cody' | 'jeremy' }> {
  const second = firstDrafter === 'cody' ? 'jeremy' : 'cody'
  const schedule: Array<{ tier: number; drafter: 'cody' | 'jeremy' }> = []

  const tiers = [1, 2, 3, 4, 5, 6, 7]
  tiers.forEach((tier, idx) => {
    const goesFirst = idx % 2 === 0 ? firstDrafter : second
    const goesSecond = goesFirst === 'cody' ? 'jeremy' : 'cody'
    const count = PICKS_PER_TIER[tier]

    if (count === 1) {
      schedule.push({ tier, drafter: goesFirst })
      schedule.push({ tier, drafter: goesSecond })
    } else {
      // Tier 6: 2 picks each — snake within tier
      // goesFirst picks 1, goesSecond picks 1, goesSecond picks 2, goesFirst picks 2
      schedule.push({ tier, drafter: goesFirst })
      schedule.push({ tier, drafter: goesSecond })
      schedule.push({ tier, drafter: goesSecond })
      schedule.push({ tier, drafter: goesFirst })
    }
  })

  return schedule
}

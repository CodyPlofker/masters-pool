import { NextResponse } from 'next/server'
import { fetchMastersLeaderboard } from '@/lib/espn'
import { supabase } from '@/lib/supabase'

export async function GET() {
  try {
    const [leaderboard, picksResult] = await Promise.all([
      fetchMastersLeaderboard(),
      supabase.from('picks').select('*, player:players(*)'),
    ])

    const picks = picksResult.data || []

    // Build pool scores
    const codyPicks = picks.filter((p: any) => p.drafted_by === 'cody')
    const jeremyPicks = picks.filter((p: any) => p.drafted_by === 'jeremy')

    function enrichPicks(playerPicks: any[]) {
      return playerPicks.map((pick: any) => {
        const live = leaderboard.find(
          (l) =>
            l.espn_id === pick.player?.espn_id ||
            l.name.toLowerCase() === pick.player?.name.toLowerCase()
        )
        const contribution =
          live && live.status !== 'cut' && live.status !== 'wd' && live.total_score < 0
            ? Math.abs(live.total_score)
            : 0

        return {
          ...pick,
          live: live || null,
          contribution,
        }
      })
    }

    const codyEnriched = enrichPicks(codyPicks)
    const jeremyEnriched = enrichPicks(jeremyPicks)

    const codyScore = codyEnriched.reduce((sum: number, p: any) => sum + p.contribution, 0)
    const jeremyScore = jeremyEnriched.reduce((sum: number, p: any) => sum + p.contribution, 0)

    return NextResponse.json({
      leaderboard,
      pool: {
        cody: { score: codyScore, picks: codyEnriched },
        jeremy: { score: jeremyScore, picks: jeremyEnriched },
      },
      updatedAt: new Date().toISOString(),
    })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to fetch scores' }, { status: 500 })
  }
}

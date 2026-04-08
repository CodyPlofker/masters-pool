import { NextResponse } from 'next/server'
import { fetchMastersLeaderboard } from '@/lib/espn'
import { query } from '@/lib/db'

export async function GET() {
  try {
    const [leaderboard, picks] = await Promise.all([
      fetchMastersLeaderboard(),
      query`
        SELECT p.*, pl.name as player_name, pl.espn_id, pl.world_rank, pl.tier, pl.is_liv
        FROM picks p
        JOIN players pl ON p.player_id = pl.id
        ORDER BY p.pick_order ASC
      `,
    ])

    function enrichPicks(playerPicks: any[]) {
      return playerPicks.map((pick) => {
        const live = leaderboard.find(
          (l) =>
            l.espn_id === pick.espn_id ||
            l.name.toLowerCase() === pick.player_name.toLowerCase()
        )
        const contribution =
          live && live.status !== 'cut' && live.status !== 'wd' && live.total_score < 0
            ? Math.abs(live.total_score)
            : 0

        return {
          id: pick.id,
          pick_order: pick.pick_order,
          tier: pick.tier,
          drafted_by: pick.drafted_by,
          player: {
            id: pick.player_id,
            name: pick.player_name,
            espn_id: pick.espn_id,
            world_rank: pick.world_rank,
            tier: pick.tier,
            is_liv: pick.is_liv,
          },
          live: live || null,
          contribution,
        }
      })
    }

    const codyPicks = enrichPicks(picks.filter((p) => p.drafted_by === 'cody'))
    const jeremyPicks = enrichPicks(picks.filter((p) => p.drafted_by === 'jeremy'))

    const codyScore = codyPicks.reduce((sum, p) => sum + p.contribution, 0)
    const jeremyScore = jeremyPicks.reduce((sum, p) => sum + p.contribution, 0)

    return NextResponse.json({
      leaderboard,
      pool: {
        cody: { score: codyScore, picks: codyPicks },
        jeremy: { score: jeremyScore, picks: jeremyPicks },
      },
      updatedAt: new Date().toISOString(),
    })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to fetch scores' }, { status: 500 })
  }
}

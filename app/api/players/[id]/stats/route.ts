import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const revalidate = 3600

type Finish = { event: string; date: string; position: string; score: string }
type PlayerStats = {
  name: string
  seasonWins: number | null
  seasonTop10: number | null
  scoringAvg: string | null
  recent: Finish[]
  trend: 'hot' | 'warm' | 'cold' | 'unknown'
  headline: string | null
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const rows = await query<{ espn_id: string | null; name: string }>`
      SELECT espn_id, name FROM players WHERE id = ${id}
    `
    if (!rows.length) return NextResponse.json({ error: 'Player not found' }, { status: 404 })
    const { espn_id, name } = rows[0]
    if (!espn_id) return NextResponse.json({ name, recent: [], trend: 'unknown', seasonWins: null, seasonTop10: null, scoringAvg: null, headline: null } satisfies PlayerStats)

    const res = await fetch(
      `https://site.web.api.espn.com/apis/common/v3/sports/golf/pga/athletes/${espn_id}/overview`,
      { next: { revalidate: 3600 } }
    )
    if (!res.ok) throw new Error(`ESPN ${res.status}`)
    const data = await res.json()

    // Season stats — prefer PGA TOUR split
    let seasonWins: number | null = null
    let seasonTop10: number | null = null
    let scoringAvg: string | null = null
    const splits = data?.statistics?.splits || []
    const pga = splits.find((s: any) => s.displayName === 'PGA TOUR') || splits[0]
    const labels: string[] = data?.statistics?.labels || []
    if (pga?.stats) {
      const idxWins = labels.indexOf('WINS')
      const idxTop = labels.indexOf('TOP10')
      const idxAvg = labels.indexOf('AVG')
      if (idxWins >= 0) seasonWins = parseInt(pga.stats[idxWins]) || 0
      if (idxTop >= 0) seasonTop10 = parseInt(pga.stats[idxTop]) || 0
      if (idxAvg >= 0) scoringAvg = pga.stats[idxAvg] || null
    }

    // Recent tournaments: find most recent PGA tour group with events
    const recent: Finish[] = []
    const tourneyGroups = data?.recentTournaments || []
    for (const group of tourneyGroups) {
      for (const ev of group.eventsStats || []) {
        const comp = ev?.competitions?.[0]?.competitors?.[0]
        if (!comp) continue
        const pos = comp?.status?.position?.displayName || comp?.status?.displayValue || '—'
        const score = comp?.score?.displayValue || '—'
        recent.push({
          event: ev.shortName || ev.name,
          date: ev.date,
          position: pos,
          score,
        })
      }
      if (recent.length >= 5) break
    }
    recent.sort((a, b) => (a.date < b.date ? 1 : -1))
    const last5 = recent.slice(0, 5)

    // Trend: hot if avg finish in last 5 <= 15, warm <= 40, cold otherwise
    const numericPositions = last5
      .map((f) => parseInt(f.position.replace(/[^\d]/g, '')))
      .filter((n) => !isNaN(n))
    let trend: PlayerStats['trend'] = 'unknown'
    if (numericPositions.length) {
      const avg = numericPositions.reduce((a, b) => a + b, 0) / numericPositions.length
      trend = avg <= 15 ? 'hot' : avg <= 40 ? 'warm' : 'cold'
    }

    const headline: string | null = data?.news?.[0]?.headline || null

    const payload: PlayerStats = {
      name,
      seasonWins,
      seasonTop10,
      scoringAvg,
      recent: last5,
      trend,
      headline,
    }
    return NextResponse.json(payload)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

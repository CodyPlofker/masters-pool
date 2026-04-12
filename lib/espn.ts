import { LiveScore } from './supabase'
import { lookupRank } from './world-rankings'

const ESPN_SCOREBOARD = 'https://site.api.espn.com/apis/site/v2/sports/golf/pga/scoreboard'

export type ESPNPlayer = {
  id: string
  name: string
  worldRank: number | null
}

async function fetchMastersEvent(): Promise<any | null> {
  try {
    // Try today first
    let res = await fetch(ESPN_SCOREBOARD, { cache: 'no-store' })
    let data = await res.json()
    let events = data.events || []
    let masters = events.find((e: any) =>
      (e.name || e.shortName || '').toLowerCase().includes('masters')
    )

    if (!masters) {
      // Try with explicit Masters dates (April 10, 2026)
      res = await fetch(`${ESPN_SCOREBOARD}?dates=20260410`, { cache: 'no-store' })
      data = await res.json()
      events = data.events || []
      masters = events.find((e: any) =>
        (e.name || e.shortName || '').toLowerCase().includes('masters')
      ) || events[0]
    }

    return masters || null
  } catch (err) {
    console.error('ESPN fetch error:', err)
    return null
  }
}

export async function fetchMastersLeaderboard(): Promise<LiveScore[]> {
  const masters = await fetchMastersEvent()
  if (!masters) return []

  const competition = masters.competitions?.[0]
  if (!competition) return []
  const competitors: any[] = competition.competitors || []
  const currentPeriod: number = competition?.status?.period ?? 0

  let scores: LiveScore[] = competitors.map((c: any) => {
    // Rounds — parse all round-level linescores
    const rawLinescores = c.linescores || []
    const allRoundStrokes = rawLinescores
      .map((l: any) => (l.value !== undefined ? parseInt(l.value) : NaN))
      .filter((n: number) => !isNaN(n))
    // Filter out 0 (unplayed rounds) for display — 0 strokes is impossible
    const rounds = allRoundStrokes.filter((n: number) => n > 0)

    // Total score to par
    let totalScore = 0
    const scoreValue = c.score?.value ?? c.score ?? '0'
    if (scoreValue === 'E' || scoreValue === 'Even' || scoreValue === '') {
      totalScore = 0
    } else {
      const parsed = parseInt(String(scoreValue))
      totalScore = isNaN(parsed) ? 0 : parsed
    }

    // Today score — try ESPN statistics first, then derive from round data
    let today = 0
    const stats = c.statistics || []
    const todayStat = stats.find((s: any) => s.name === 'today' || s.name === 'currentRound')
    if (todayStat) {
      const todayValue = todayStat.value ?? '0'
      if (todayValue !== 'E' && todayValue !== 'Even' && todayValue !== '') {
        const parsed = parseInt(String(todayValue))
        today = isNaN(parsed) ? 0 : parsed
      }
    } else if (currentPeriod > 0 && allRoundStrokes.length > 0) {
      // ESPN statistics unavailable — derive today's to-par from total and prior rounds
      const PAR = 72 // Augusta National
      const priorRounds = allRoundStrokes.slice(0, currentPeriod - 1).filter((r: number) => r > 0)
      const priorToPar = priorRounds.reduce((sum: number, r: number) => sum + (r - PAR), 0)
      today = totalScore - priorToPar
    }

    // Status
    let status: LiveScore['status'] = 'active'
    const statusStr = (c.status?.type?.name || '').toLowerCase()
    const statusDetail = (c.status?.type?.detail || '').toLowerCase()
    const statusId = c.status?.type?.id
    if (statusStr.includes('cut') || statusDetail.includes('cut') || statusId === '6') {
      status = 'cut'
    } else if (statusStr.includes('wd') || statusDetail.includes('withdraw') || statusId === '7') {
      status = 'wd'
    } else if (statusStr.includes('complete') || statusStr.includes('final') || statusId === '3') {
      status = 'complete'
    }

    // Thru — try ESPN status first, then derive from hole-level linescore data
    let thru = c.status?.thru?.toString() || c.status?.period?.toString() || ''
    if (!thru && currentPeriod > 0 && rawLinescores.length >= currentPeriod) {
      const currentRoundData = rawLinescores[currentPeriod - 1]
      const holeScores = currentRoundData?.linescores || []
      const holesPlayed = holeScores.length
      if (holesPlayed >= 18) {
        thru = 'F'
      } else if (holesPlayed > 0) {
        thru = String(holesPlayed)
      }
    }

    const pos = c.status?.position?.displayName || c.status?.position?.shortText || ''

    return {
      espn_id: c.athlete?.id || c.id || '',
      name: c.athlete?.displayName || c.athlete?.fullName || c.displayName || '',
      position: pos,
      total_score: totalScore,
      today,
      thru,
      status,
      rounds,
    }
  })

  // Masters cut rule: top 50 and ties after R2. ESPN's competitor-level status
  // is sometimes null during live rounds so we can't rely on it to detect cut
  // players. Once the tournament has reached R3 (period >= 3), compute each
  // golfer's R1+R2 stroke total from linescores and mark anyone outside the
  // top-50-and-ties as cut.
  if (currentPeriod >= 3) {
    const r2Totals = competitors
      .map((c: any, i: number) => {
        const ls = c.linescores || []
        const r1 = typeof ls[0]?.value === 'number' ? ls[0].value : 0
        const r2 = typeof ls[1]?.value === 'number' ? ls[1].value : 0
        return { index: i, total: r1 + r2, r1, r2, status: scores[i].status }
      })
      // Only players who actually finished R1 and R2 are eligible for cut math.
      // WD golfers keep their existing status untouched.
      .filter((x) => x.r1 > 0 && x.r2 > 0 && x.status !== 'wd')
      .sort((a, b) => a.total - b.total)

    if (r2Totals.length > 50) {
      const cutThreshold = r2Totals[49].total // 50th place
      const cutIndices = new Set(
        r2Totals.filter((x) => x.total > cutThreshold).map((x) => x.index),
      )
      scores = scores.map((s, i) =>
        cutIndices.has(i) ? { ...s, status: 'cut' as const, position: 'CUT' } : s,
      )
    }
  }

  // ESPN's competitor-level status is sometimes null (seen during active rounds),
  // leaving `position` empty. Derive leaderboard rank from total_score for any
  // active/complete golfer missing a position, using standard "T" tie notation.
  const needsRank = scores.filter(
    (s) => !s.position && s.status !== 'cut' && s.status !== 'wd',
  )
  if (needsRank.length > 0) {
    const sorted = [...needsRank].sort((a, b) => a.total_score - b.total_score)
    const rankById = new Map<string, string>()
    for (let i = 0; i < sorted.length; i++) {
      const rank = i + 1
      const score = sorted[i].total_score
      const tied =
        (i > 0 && sorted[i - 1].total_score === score) ||
        (i < sorted.length - 1 && sorted[i + 1].total_score === score)
      // For ties, everyone in the tie group shares the rank of the first tied player
      let displayRank = rank
      if (tied) {
        let firstInGroup = i
        while (firstInGroup > 0 && sorted[firstInGroup - 1].total_score === score) {
          firstInGroup--
        }
        displayRank = firstInGroup + 1
      }
      rankById.set(sorted[i].espn_id, tied ? `T${displayRank}` : `${displayRank}`)
    }
    scores = scores.map((s) => {
      if (s.position) return s
      const rank = rankById.get(s.espn_id)
      return rank ? { ...s, position: rank } : s
    })
  }

  return scores
}

export async function fetchMastersField(): Promise<ESPNPlayer[]> {
  const masters = await fetchMastersEvent()
  if (!masters) return []

  const competition = masters.competitions?.[0]
  if (!competition) return []
  const competitors: any[] = competition.competitors || []

  return competitors.map((c: any) => {
    const name = c.athlete?.displayName || c.athlete?.fullName || c.displayName || ''
    const id = c.athlete?.id || c.id || ''
    const worldRank = lookupRank(name)
    return { id, name, worldRank }
  })
}

export function assignTier(worldRank: number | null): number {
  if (worldRank === null) return 6
  if (worldRank <= 10) return 1
  if (worldRank <= 20) return 2
  if (worldRank <= 30) return 3
  if (worldRank <= 40) return 4
  if (worldRank <= 50) return 5
  return 6
}

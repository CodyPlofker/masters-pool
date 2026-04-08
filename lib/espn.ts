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

  return competitors.map((c: any) => {
    // Rounds
    const linescores = c.linescores || []
    const rounds = linescores
      .map((l: any) => (l.value !== undefined ? parseInt(l.value) : NaN))
      .filter((n: number) => !isNaN(n))

    // Total score to par
    let totalScore = 0
    const scoreValue = c.score?.value ?? c.score ?? '0'
    if (scoreValue === 'E' || scoreValue === 'Even' || scoreValue === '') {
      totalScore = 0
    } else {
      const parsed = parseInt(String(scoreValue))
      totalScore = isNaN(parsed) ? 0 : parsed
    }

    // Today score
    let today = 0
    const stats = c.statistics || []
    const todayStat = stats.find((s: any) => s.name === 'today' || s.name === 'currentRound')
    const todayValue = todayStat?.value ?? '0'
    if (todayValue !== 'E' && todayValue !== 'Even' && todayValue !== '') {
      const parsed = parseInt(String(todayValue))
      today = isNaN(parsed) ? 0 : parsed
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

    const thru = c.status?.thru?.toString() || c.status?.period?.toString() || ''
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

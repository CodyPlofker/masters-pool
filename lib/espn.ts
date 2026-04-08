import { LiveScore } from './supabase'

// ESPN API endpoints
const ESPN_LEADERBOARD = 'https://site.api.espn.com/apis/site/v2/sports/golf/pga/leaderboard'
const ESPN_MASTERS_SCOREBOARD = 'https://site.api.espn.com/apis/site/v2/sports/golf/leaderboard?league=pga'

export type ESPNPlayer = {
  id: string
  name: string
  worldRank: number | null
  isLiv: boolean
}

export async function fetchMastersLeaderboard(): Promise<LiveScore[]> {
  try {
    // Try the leaderboard endpoint first
    const res = await fetch(ESPN_LEADERBOARD, {
      next: { revalidate: 60 }, // cache for 60s
    })
    const data = await res.json()

    // ESPN returns events array; find the Masters
    const events = data.events || []
    const masters = events.find((e: any) =>
      e.name?.toLowerCase().includes('masters') ||
      e.shortName?.toLowerCase().includes('masters')
    ) || events[0] // fallback to first event if Masters not found by name

    if (!masters) return []

    const competition = masters.competitions?.[0]
    if (!competition) return []

    const competitors: any[] = competition.competitors || []

    return competitors.map((c: any) => {
      const stats = c.statistics || []
      const scoreStat = stats.find((s: any) => s.name === 'scoreToPar' || s.name === 'total')
      const todayStat = stats.find((s: any) => s.name === 'today' || s.name === 'currentRound')

      // Parse rounds
      const linescores = c.linescores || []
      const rounds = linescores.map((l: any) => {
        const v = parseInt(l.value)
        return isNaN(v) ? 0 : v
      })

      // Parse total score to par
      let totalScore = 0
      const scoreValue = c.score?.value || scoreStat?.value || '0'
      if (scoreValue === 'E' || scoreValue === 'Even') {
        totalScore = 0
      } else {
        const parsed = parseInt(scoreValue)
        totalScore = isNaN(parsed) ? 0 : parsed
      }

      // Parse today score
      let today = 0
      const todayValue = todayStat?.value || '0'
      if (todayValue !== 'E' && todayValue !== 'Even') {
        const parsed = parseInt(todayValue)
        today = isNaN(parsed) ? 0 : parsed
      }

      // Determine status
      let status: LiveScore['status'] = 'active'
      const statusStr = (c.status?.type?.name || '').toLowerCase()
      const statusDetail = (c.status?.type?.detail || '').toLowerCase()
      if (statusStr.includes('cut') || statusDetail.includes('cut') || c.status?.type?.id === '6') {
        status = 'cut'
      } else if (statusStr.includes('wd') || statusDetail.includes('withdraw') || c.status?.type?.id === '7') {
        status = 'wd'
      } else if (statusStr.includes('complete') || statusStr.includes('final') || c.status?.type?.id === '3') {
        status = 'complete'
      }

      // Thru
      const thru = c.status?.thru?.toString() || c.status?.period?.toString() || 'F'

      // Position
      const pos = c.status?.position?.displayName || c.status?.position?.shortText || ''

      return {
        espn_id: c.athlete?.id || c.id || '',
        name: c.athlete?.displayName || c.athlete?.shortName || c.displayName || '',
        position: pos,
        total_score: totalScore,
        today,
        thru,
        status,
        rounds,
      }
    })
  } catch (err) {
    console.error('ESPN leaderboard fetch error:', err)
    return []
  }
}

export async function fetchMastersField(): Promise<ESPNPlayer[]> {
  try {
    const res = await fetch(ESPN_LEADERBOARD, { cache: 'no-store' })
    const data = await res.json()

    const events = data.events || []
    const masters = events.find((e: any) =>
      e.name?.toLowerCase().includes('masters') ||
      e.shortName?.toLowerCase().includes('masters')
    ) || events[0]

    if (!masters) return []

    const competition = masters.competitions?.[0]
    if (!competition) return []

    const competitors: any[] = competition.competitors || []

    return competitors.map((c: any) => {
      // Try to get world rank from athlete info
      let worldRank: number | null = null
      const rankVal = c.athlete?.rank || c.rank
      if (rankVal) {
        const parsed = parseInt(rankVal)
        if (!isNaN(parsed)) worldRank = parsed
      }

      // LIV detection — check team/league info or use our known list
      const isLiv = isLivPlayer(c.athlete?.displayName || '')

      return {
        id: c.athlete?.id || c.id || '',
        name: c.athlete?.displayName || c.displayName || '',
        worldRank,
        isLiv,
      }
    })
  } catch (err) {
    console.error('ESPN field fetch error:', err)
    return []
  }
}

// Known LIV tour players (as of 2026 Masters)
// This list covers the main LIV players who typically qualify for Augusta
const LIV_PLAYERS = [
  'Brooks Koepka',
  'Dustin Johnson',
  'Phil Mickelson',
  'Bryson DeChambeau',
  'Patrick Reed',
  'Sergio Garcia',
  'Louis Oosthuizen',
  'Charl Schwartzel',
  'Henrik Stenson',
  'Talor Gooch',
  'Harold Varner III',
  'Matthew Wolff',
  'Joaquin Niemann',
  'Cameron Smith',
  'Marc Leishman',
  'Abraham Ancer',
  'Jason Kokrak',
  'Kevin Na',
  'Graeme McDowell',
  'Ian Poulter',
  'Lee Westwood',
  'Paul Casey',
  'Bubba Watson',
  'Pat Perez',
  'Charles Howell III',
  'Anirban Lahiri',
  'Dean Burmester',
  'Brendan Steele',
  'James Piot',
  'Adrian Meronk',
  'Carlos Ortiz',
  'David Puig',
  'Mito Pereira',
  'Danny Lee',
  'Peter Uihlein',
  'Thomas Pieters',
  'Tyrrell Hatton',
  'Jon Rahm',
  'Brendan Grace',
  'Caleb Surratt',
  'Jinichiro Kozuma',
  'Andy Ogletree',
  'Lucas Herbert',
  'Scott Vincent',
  'Anthony Kim',
  'Eugenio Chacarra',
  'Jediah Morgan',
  'John Catlin',
  'Martin Kaymer',
  'Sinho Noris',
  'Sam Horsfield',
  'Richard Bland',
  'Laurie Canter',
  'Matthew Jones',
  'Wade Ormsby',
  'Kieran Vincent',
  'Kalle Samooja',
  'Turk Pettit',
  'Paul Barjon',
]

function isLivPlayer(name: string): boolean {
  return LIV_PLAYERS.some(
    (liv) => liv.toLowerCase() === name.toLowerCase() || name.toLowerCase().includes(liv.toLowerCase().split(' ')[1])
  )
}

export function assignTier(worldRank: number | null, isLiv: boolean): number {
  if (isLiv) return 7
  if (worldRank === null) return 6
  if (worldRank <= 10) return 1
  if (worldRank <= 20) return 2
  if (worldRank <= 30) return 3
  if (worldRank <= 40) return 4
  if (worldRank <= 50) return 5
  return 6
}

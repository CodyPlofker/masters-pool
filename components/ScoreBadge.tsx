'use client'

type Props = {
  score: number | null
  status?: string
  size?: 'sm' | 'md' | 'lg'
}

export function ScoreBadge({ score, status, size = 'md' }: Props) {
  const sizes = {
    sm: 'text-xs px-1.5 py-0.5',
    md: 'text-sm px-2 py-0.5',
    lg: 'text-base px-3 py-1',
  }

  if (status === 'cut' || status === 'wd') {
    return (
      <span className={`${sizes[size]} rounded font-mono font-semibold bg-gray-100 text-gray-500`}>
        {status === 'cut' ? 'MC' : 'WD'}
      </span>
    )
  }

  if (score === null || score === undefined) {
    return <span className={`${sizes[size]} text-gray-400 font-mono`}>–</span>
  }

  if (score === 0) {
    return (
      <span className={`${sizes[size]} font-mono font-semibold`} style={{ color: 'var(--score-black)' }}>
        E
      </span>
    )
  }

  if (score < 0) {
    return (
      <span className={`${sizes[size]} font-mono font-semibold`} style={{ color: 'var(--score-red)' }}>
        {score}
      </span>
    )
  }

  return (
    <span className={`${sizes[size]} font-mono`} style={{ color: '#555' }}>
      +{score}
    </span>
  )
}

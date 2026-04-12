export default function GameHubPage() {
  return (
    <div className="max-w-lg mx-auto px-4 py-12 space-y-4">
      <div className="text-center mb-8">
        <div className="text-4xl mb-3">🏆</div>
        <h1 className="text-2xl font-bold" style={{ fontFamily: 'Georgia, serif', color: 'var(--masters-green)' }}>
          The Climbers
        </h1>
        <p className="text-sm text-gray-500 mt-1">Family Game · Masters 2026</p>
      </div>

      <a href="/game/r3"
        className="block rounded-xl p-5 text-white shadow-md transition-opacity hover:opacity-90"
        style={{ backgroundColor: 'var(--masters-green)' }}>
        <div className="text-xs font-semibold uppercase tracking-widest mb-1 opacity-70">Saturday</div>
        <div className="text-xl font-bold" style={{ fontFamily: 'Georgia, serif' }}>Round 3 — The Climbers</div>
        <div className="text-sm mt-1 opacity-80">Pick 2 longs + 1 short. Score by % position movement.</div>
      </a>

      <a href="/game/r4"
        className="block rounded-xl p-5 shadow-md transition-opacity hover:opacity-90"
        style={{ backgroundColor: 'var(--masters-gold)', color: '#1a1a1a' }}>
        <div className="text-xs font-semibold uppercase tracking-widest mb-1 opacity-60">Sunday</div>
        <div className="text-xl font-bold" style={{ fontFamily: 'Georgia, serif' }}>Round 4 — Sum Match</div>
        <div className="text-sm mt-1 opacity-70">Leader sets the target. Everyone picks 3 golfers to match. Lowest R4 strokes wins.</div>
      </a>
    </div>
  )
}

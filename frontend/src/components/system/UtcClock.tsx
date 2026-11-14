import { useEffect, useState } from "react"

export function UtcClock() {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  return (
    <div className="hidden items-baseline gap-2 sm:flex" aria-label="Coordinated Universal Time">
      <span className="text-[10px] tracking-[0.3em] text-muted">UTC</span>
      <time className="text-sm tabular-nums text-ink" dateTime={now.toISOString()}>
        {now.toISOString().slice(11, 19)}
      </time>
    </div>
  )
}

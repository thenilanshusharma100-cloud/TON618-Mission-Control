import { API_BASE } from "../api/client"
import { useHealth } from "../api/queries"
import { linkLabel, linkState } from "../lib/health"

function utcStamp(ms: number): string {
  if (!ms) return "—"
  return `${new Date(ms).toISOString().slice(11, 19)} UTC`
}

export function Dashboard() {
  const { data, isError, dataUpdatedAt } = useHealth()
  const state = linkState(data, isError)

  const cards = [
    {
      label: "API LINK",
      value: linkLabel(state),
      detail: `${API_BASE}/health · poll 10 s`,
      tone:
        state === "online"
          ? "text-signal"
          : state === "degraded"
            ? "text-amber"
            : state === "offline"
              ? "text-alert"
              : "text-muted",
    },
    {
      label: "DATABASE",
      value: data ? (data.database === "ok" ? "SQLITE READY" : "FAULT") : "—",
      detail: "SELECT 1 connectivity probe",
      tone: data?.database === "ok" ? "text-signal" : "text-alert",
    },
    {
      label: "UNIT SYSTEM",
      value: data?.units ?? "—",
      detail: "internal calculations · Pint",
      tone: data ? "text-ink" : "text-muted",
    },
  ]

  return (
    <div>
      <div className="flex items-center gap-3 text-[10px] tracking-[0.34em] text-signal">
        <span className="h-px w-8 bg-signal" aria-hidden="true" />
        GROUND SEGMENT
      </div>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">System Status</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        Live telemetry from the mission-control backend. Status refreshes every ten seconds.
      </p>

      <section className="mt-8 grid gap-4 md:grid-cols-3" aria-label="Subsystem status">
        {cards.map((card) => (
          <article key={card.label} className="border border-edge bg-panel p-5">
            <p className="text-[10px] tracking-[0.28em] text-muted">{card.label}</p>
            <p className={`mt-3 text-lg tracking-[0.08em] ${card.tone}`}>{card.value}</p>
            <p className="mt-2 text-[11px] text-muted">{card.detail}</p>
          </article>
        ))}
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[2fr_1fr]">
        <section className="border border-dashed border-edge bg-panel/40 p-8">
          <p className="text-[10px] tracking-[0.3em] text-muted">MISSION PACKAGES</p>
          <p className="mt-4 text-sm text-ink">No mission packages loaded.</p>
          <p className="mt-2 max-w-xl text-xs leading-relaxed text-muted">
            The catalog is empty. Seed the catalog to begin operations; the first package is the
            EarthWatch-01 Earth-observation mission.
          </p>
        </section>

        <section className="border border-edge bg-panel p-5" aria-label="Link telemetry">
          <p className="text-[10px] tracking-[0.28em] text-muted">LINK TELEMETRY</p>
          <dl className="mt-4 space-y-3 text-xs">
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-muted">API BASE</dt>
              <dd className="text-ink">{API_BASE}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-muted">VERSION</dt>
              <dd className="text-ink">{data?.version ?? "—"}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-muted">LAST SYNC</dt>
              <dd className="tabular-nums text-ink">{utcStamp(dataUpdatedAt)}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-muted">POLL CYCLE</dt>
              <dd className="text-ink">10 s</dd>
            </div>
          </dl>
        </section>
      </div>
    </div>
  )
}

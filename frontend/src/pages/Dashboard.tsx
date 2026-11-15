import { Link } from "react-router-dom"

import { API_BASE } from "../api/client"
import { useHealth, useMissions } from "../api/queries"
import { linkLabel, linkState } from "../lib/health"
import { formatMass, formatPower, formatUsd } from "../lib/missions"

function utcStamp(ms: number): string {
  if (!ms) return "—"
  return `${new Date(ms).toISOString().slice(11, 19)} UTC`
}

export function Dashboard() {
  const { data, isError, dataUpdatedAt } = useHealth()
  const missions = useMissions()
  const missionList = missions.data ?? []
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
        <section className="border border-edge bg-panel p-5" aria-label="Mission packages">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-[10px] tracking-[0.3em] text-muted">MISSION PACKAGES</p>
            <span className="text-[10px] text-muted">{missionList.length} LOADED</span>
          </div>

          {missions.isLoading ? (
            <p className="mt-4 text-xs text-muted">Acquiring mission catalog…</p>
          ) : missions.isError ? (
            <p className="mt-4 text-xs text-alert">
              Mission catalog unavailable. Check the API link.
            </p>
          ) : missionList.length === 0 ? (
            <>
              <p className="mt-4 text-sm text-ink">No mission packages loaded.</p>
              <p className="mt-2 text-xs text-muted">
                Seed the catalog to begin operations; the first package is the EarthWatch-01
                Earth-observation mission.
              </p>
            </>
          ) : (
            <div className="mt-4 space-y-4">
              {missionList.map((mission) => (
                <article key={mission.slug} className="border border-edge bg-panel-2 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-lg tracking-[0.08em] text-ink">{mission.name}</h2>
                    <span className="border border-signal/40 bg-signal/10 px-2 py-0.5 text-[10px] tracking-[0.2em] text-signal">
                      CATALOG READY
                    </span>
                  </div>
                  <p className="mt-2 max-w-2xl text-xs leading-relaxed text-muted">
                    {mission.summary}
                  </p>

                  <dl className="mt-4 grid grid-cols-3 gap-3 text-xs">
                    <div className="border border-edge/70 bg-panel px-3 py-2">
                      <dt className="text-[9px] tracking-[0.2em] text-muted">MASS LIMIT</dt>
                      <dd className="mt-1 text-ink">{formatMass(mission.max_mass_kg)}</dd>
                    </div>
                    <div className="border border-edge/70 bg-panel px-3 py-2">
                      <dt className="text-[9px] tracking-[0.2em] text-muted">COST LIMIT</dt>
                      <dd className="mt-1 text-ink">{formatUsd(mission.max_cost_usd)}</dd>
                    </div>
                    <div className="border border-edge/70 bg-panel px-3 py-2">
                      <dt className="text-[9px] tracking-[0.2em] text-muted">POWER MARGIN</dt>
                      <dd className="mt-1 text-ink">
                        ≥ {formatPower(mission.min_power_margin_w)}
                      </dd>
                    </div>
                  </dl>

                  <p className="mt-3 text-[10px] tracking-[0.08em] text-muted">
                    {mission.required_categories.length} required subsystems · {mission.difficulty}
                  </p>
                  <p className="mt-1 text-[10px] leading-relaxed text-muted/80">
                    {mission.budget_rationale}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link
                      to="/designer"
                      className="inline-block border border-signal px-4 py-2 text-[10px] tracking-[0.2em] text-signal transition-colors hover:bg-signal hover:text-void"
                    >
                      OPEN DESIGN CONSOLE →
                    </Link>
                    <Link
                      to="/orbit"
                      className="inline-block border border-amber/60 px-4 py-2 text-[10px] tracking-[0.2em] text-amber transition-colors hover:bg-amber hover:text-void"
                    >
                      OPEN ORBIT PLANNER →
                    </Link>
                    <Link
                      to="/simulation"
                      className="inline-block border border-signal/60 px-4 py-2 text-[10px] tracking-[0.2em] text-signal transition-colors hover:bg-signal hover:text-void"
                    >
                      OPEN SIMULATION →
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}
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

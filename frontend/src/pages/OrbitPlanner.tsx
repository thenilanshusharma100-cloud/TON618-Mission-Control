import { useState } from "react"

import { useOrbitAnalysis } from "../api/queries"
import { OrbitConfigPanel } from "../components/orbit/OrbitConfigPanel"
import { OrbitScene } from "../components/orbit/OrbitScene"
import {
  DEFAULT_ALTITUDE_KM,
  clampAltitude,
  clampInclination,
  formatAngle,
  formatEpoch,
  formatKilometres,
  formatPeriod,
  formatPrecession,
  formatScientific,
  formatVelocity,
} from "../lib/orbit"

function MetricCard({
  label,
  value,
  detail,
  tone = "text-ink",
}: {
  label: string
  value: string
  detail: string
  tone?: string
}) {
  return (
    <div className="border border-edge bg-panel px-3 py-3">
      <p className="text-[9px] tracking-[0.2em] text-muted">{label}</p>
      <p className={`mt-2 text-base leading-tight tracking-tight tabular-nums ${tone}`}>
        {value}
      </p>
      <p className="mt-2 text-[8px] leading-relaxed tracking-[0.08em] text-muted/80">
        {detail}
      </p>
    </div>
  )
}

export function OrbitPlanner() {
  const [altitudeKm, setAltitudeKm] = useState(DEFAULT_ALTITUDE_KM)
  const [inclinationDeg, setInclinationDeg] = useState(0)

  const orbitQuery = useOrbitAnalysis(altitudeKm, inclinationDeg)
  const analysis = orbitQuery.data

  const inputsMatch =
    analysis !== undefined &&
    Math.abs(analysis.altitude_km - altitudeKm) < 1e-6 &&
    Math.abs(analysis.inclination_deg - inclinationDeg) < 1e-6

  const isSunSynchronous = Boolean(inputsMatch && analysis?.sun_synchronous.is_sun_synchronous)
  const requiredInclination = analysis?.sun_synchronous.required_inclination_deg
  const recalculating = orbitQuery.isFetching
  const waiting = analysis === undefined && !orbitQuery.isError

  const handleAltitude = (km: number) => setAltitudeKm(clampAltitude(km))
  const handleInclination = (deg: number) => setInclinationDeg(clampInclination(deg))
  const handleApplySso = () => {
    if (!analysis || !inputsMatch || recalculating) return
    setInclinationDeg(analysis.sun_synchronous.required_inclination_deg)
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-edge pb-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3 text-[10px] tracking-[0.34em] text-signal">
            <span className="h-px w-8 bg-signal" aria-hidden="true" />
            MISSION PLANNING · EARTHWATCH-01
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">Orbit Planner</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            Earth-centred circular low-Earth orbit. Steady-state elements and J2 nodal
            precession are computed by the backend from the seeded NASA reference constants.
          </p>
        </div>

        <div className="text-right">
          <span className="border border-signal/40 bg-signal/10 px-2 py-1 text-[9px] tracking-[0.2em] text-signal">
            EARTH · CIRCULAR LEO
          </span>
          <p className="mt-2 text-[9px] tracking-[0.16em] text-muted">
            REFERENCE EPOCH {formatEpoch(analysis?.epoch_utc)}
          </p>
        </div>
      </div>

      {orbitQuery.isError ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border border-alert/50 bg-alert/5 px-4 py-3">
          <p className="text-[11px] text-alert">
            ORBIT ENGINE UNAVAILABLE —{" "}
            {orbitQuery.error instanceof Error
              ? orbitQuery.error.message
              : "The analysis request failed."}
          </p>
          <button
            type="button"
            onClick={() => void orbitQuery.refetch()}
            className="border border-alert/60 px-3 py-1.5 text-[9px] tracking-[0.2em] text-alert transition-colors hover:bg-alert hover:text-void"
          >
            RETRY
          </button>
        </div>
      ) : null}

      <div className="mt-4 grid gap-4 xl:grid-cols-[290px_minmax(0,1fr)_350px]">
        <OrbitConfigPanel
          altitudeKm={altitudeKm}
          inclinationDeg={inclinationDeg}
          requiredInclinationDeg={requiredInclination}
          isSunSynchronous={isSunSynchronous}
          onAltitude={handleAltitude}
          onInclination={handleInclination}
          onApplySso={handleApplySso}
        />

        <div className="min-w-0 space-y-4">
          <OrbitScene
            altitudeKm={altitudeKm}
            inclinationDeg={inclinationDeg}
            radiusM={analysis?.radius_m}
            earthRadiusM={analysis?.constants.equatorial_radius_m}
            isSunSynchronous={isSunSynchronous}
          />

          <section className="grid grid-cols-2 gap-2 md:grid-cols-3" aria-label="Orbital metrics">
            <MetricCard
              label="ORBITAL RADIUS"
              value={analysis ? formatKilometres(analysis.radius_m) : "—"}
              detail={analysis ? `R_E + ${analysis.altitude_km.toFixed(0)} KM` : "AWAITING ENGINE"}
            />
            <MetricCard
              label="ORBITAL VELOCITY"
              value={analysis ? formatVelocity(analysis.velocity_m_s) : "—"}
              detail="CIRCULAR · v = √(μ/r)"
            />
            <MetricCard
              label="ORBITAL PERIOD"
              value={analysis ? `${analysis.period_s.toFixed(1)} s` : "—"}
              detail={
                analysis
                  ? `${formatPeriod(analysis.period_s)} · ${analysis.orbits_per_day.toFixed(3)} ORBITS/DAY`
                  : "AWAITING ENGINE"
              }
            />
            <MetricCard
              label="SPECIFIC ORBITAL ENERGY"
              value={analysis ? `${formatScientific(analysis.specific_energy_j_kg)} J/kg` : "—"}
              detail="ε = −μ / 2r"
            />
            <MetricCard
              label="ANGULAR MOMENTUM / MASS"
              value={analysis ? `${formatScientific(analysis.angular_momentum_m2_s)} m²/s` : "—"}
              detail="h = √(μr)"
            />
            <MetricCard
              label="J2 NODAL PRECESSION"
              value={analysis ? formatPrecession(analysis.nodal_precession_rad_s) : "—"}
              detail={
                analysis
                  ? `SSO TARGET ${formatPrecession(analysis.sun_synchronous.target_rate_rad_s)}`
                  : "AWAITING ENGINE"
              }
              tone={isSunSynchronous ? "text-signal" : "text-amber"}
            />
          </section>

          <div className="flex items-center justify-between gap-3 border border-edge bg-panel px-4 py-2 text-[9px] tracking-[0.14em]">
            <span className="text-muted">
              {waiting
                ? "COMPUTING ORBIT…"
                : recalculating
                  ? "RECOMPUTING WITH LATEST INPUTS…"
                  : "SI SERVICE · μ, r AND J2 FROM SEEDED NASA NSSDCA DATA"}
            </span>
            <span className="text-muted/70">
              {analysis ? `${analysis.orbits_per_day.toFixed(2)} REV/DAY` : "—"}
            </span>
          </div>
        </div>

        <aside className="space-y-3" aria-label="Orbit analysis">
          <section className="border border-edge bg-panel p-4">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-[10px] tracking-[0.3em] text-muted">SUN-SYNCHRONOUS</p>
              <span
                className={`border px-2 py-0.5 text-[8px] tracking-[0.16em] ${
                  isSunSynchronous
                    ? "border-signal/50 bg-signal/10 text-signal"
                    : "border-amber/50 bg-amber/10 text-amber"
                }`}
              >
                {isSunSynchronous ? "LOCKED" : "NOT SSO"}
              </span>
            </div>

            <dl className="mt-3 space-y-2 text-[10px]">
              <div className="flex items-baseline justify-between gap-3 border-b border-edge/60 pb-2">
                <dt className="text-muted">CURRENT INCLINATION</dt>
                <dd className="tabular-nums text-ink">{formatAngle(inclinationDeg)}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3 border-b border-edge/60 pb-2">
                <dt className="text-muted">REQUIRED INCLINATION</dt>
                <dd className="tabular-nums text-amber">
                  {requiredInclination === undefined ? "—" : formatAngle(requiredInclination, 3)}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3 border-b border-edge/60 pb-2">
                <dt className="text-muted">DELTA</dt>
                <dd className="tabular-nums text-ink">
                  {analysis
                    ? `${analysis.sun_synchronous.inclination_delta_deg >= 0 ? "+" : ""}${analysis.sun_synchronous.inclination_delta_deg.toFixed(3)}°`
                    : "—"}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3 border-b border-edge/60 pb-2">
                <dt className="text-muted">TARGET NODAL RATE</dt>
                <dd className="tabular-nums text-ink">
                  {analysis
                    ? formatPrecession(analysis.sun_synchronous.target_rate_rad_s)
                    : "—"}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-muted">CURRENT NODAL RATE</dt>
                <dd className="tabular-nums text-ink">
                  {analysis ? formatPrecession(analysis.nodal_precession_rad_s) : "—"}
                </dd>
              </div>
            </dl>

            <p className="mt-3 text-[10px] leading-relaxed text-muted/80">
              The solver finds the inclination whose J2 precession matches one eastward
              revolution per 365.2422-day mean tropical year. A 1 % rate tolerance defines
              the badge.
            </p>
          </section>

          {analysis ? (
            <section className="border border-edge bg-panel p-4">
              <p className="text-[10px] tracking-[0.3em] text-muted">REFERENCE CONSTANTS</p>
              <dl className="mt-3 space-y-2 text-[10px]">
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-muted">μ</dt>
                  <dd className="tabular-nums text-ink">
                    {formatScientific(analysis.constants.gravitational_parameter_m3_s2, 4)} m³/s²
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-muted">R_E</dt>
                  <dd className="tabular-nums text-ink">
                    {formatKilometres(analysis.constants.equatorial_radius_m)}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-muted">J2</dt>
                  <dd className="tabular-nums text-ink">
                    {analysis.constants.j2.toExponential(5)}
                  </dd>
                </div>
              </dl>
              <p className="mt-3 border-t border-edge/60 pt-2 text-[9px] leading-relaxed text-muted">
                PUBLISHED REFERENCE · NASA NSSDCA
              </p>
              <a
                href={analysis.constants.source_url}
                target="_blank"
                rel="noreferrer"
                className="mt-1 block text-[10px] text-signal underline-offset-2 hover:underline"
              >
                {analysis.constants.source_title} ↗
              </a>
              <p className="mt-1 text-[8px] tracking-[0.1em] text-muted/70">
                RETRIEVED {analysis.constants.retrieved_on} · LOADED FROM SEEDED DATABASE
              </p>
            </section>
          ) : null}

          <section className="border border-edge bg-panel p-4">
            <p className="text-[10px] tracking-[0.3em] text-muted">PLANNER DOMAIN</p>
            <ul className="mt-3 space-y-1.5 text-[9px] leading-relaxed text-muted">
              <li>ALTITUDE · 160–2000 KM</li>
              <li>INCLINATION · 0–180 DEG</li>
              <li>ECCENTRICITY · 0 (CIRCULAR)</li>
              <li>GRAVITY · TWO-BODY + J2</li>
              <li>EPOCH · STEADY-STATE SNAPSHOT</li>
            </ul>
            <p className="mt-3 text-[9px] leading-relaxed text-muted/70">
              Not a propagated ephemeris, flight-dynamics product or collision-avoidance tool.
            </p>
          </section>
        </aside>
      </div>

      <section className="mt-4 grid gap-4 lg:grid-cols-3" aria-label="Orbit model documentation">
        <div className="border border-edge bg-panel p-4">
          <p className="text-[10px] tracking-[0.3em] text-muted">EQUATIONS · SI UNITS</p>
          <ul className="mt-3 space-y-1.5 text-[10px] leading-relaxed text-ink">
            <li>r = R_E + h</li>
            <li>v = √(μ / r)</li>
            <li>T = 2π √(r³ / μ)</li>
            <li>ε = −μ / (2r)</li>
            <li>h = √(μ r)</li>
            <li>n = √(μ / r³)</li>
            <li>Ω̇ = −(3/2) J2 (R_E / r)² n cos i</li>
            <li>i_SSO = arccos[−(2/3) Ω̇_target / (J2 (R_E / r)² n)]</li>
          </ul>
        </div>

        <div className="border border-edge bg-panel p-4">
          <p className="text-[10px] tracking-[0.3em] text-muted">MODEL ASSUMPTIONS</p>
          <ul className="mt-3 space-y-2 text-[10px] leading-relaxed text-muted">
            {(analysis?.assumptions ?? []).map((assumption) => (
              <li key={assumption} className="border-l border-signal/40 pl-2">
                {assumption}
              </li>
            ))}
            {!analysis ? <li className="text-muted/60">AWAITING ENGINE</li> : null}
          </ul>
        </div>

        <div className="border border-edge bg-panel p-4">
          <p className="text-[10px] tracking-[0.3em] text-muted">LIMITATIONS</p>
          <ul className="mt-3 space-y-2 text-[10px] leading-relaxed text-muted">
            {(analysis?.limitations ?? []).map((limitation) => (
              <li key={limitation} className="border-l border-amber/40 pl-2">
                {limitation}
              </li>
            ))}
            {!analysis ? <li className="text-muted/60">AWAITING ENGINE</li> : null}
          </ul>
        </div>
      </section>
    </div>
  )
}

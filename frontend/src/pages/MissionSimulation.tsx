import { useCallback, useEffect, useRef, useState } from "react"
import { Link } from "react-router-dom"
import { postJson } from "../api/client"
import { useOrbitAnalysis } from "../api/queries"
import {
  missionStatusLabel,
  SIMULATION_SCORE_MAX,
  type SimulationRequest,
  type SimulationResponse,
} from "../lib/simulation"

const MISSION_SLUG = "earthwatch-01"
const BASELINE_DESIGN_ID = 1
const BASELINE_DESIGN_NAME = "EarthWatch-01 Baseline"
const DEFAULT_ALTITUDE_KM = 550
const DEFAULT_INCLINATION_DEG = 97.5928772417652
const ORBIT_ALTITUDE_KEY = "orbit_altitude_km"
const ORBIT_INCLINATION_KEY = "orbit_inclination_deg"

type OrbitSelection = {
  altitudeKm: number
  inclinationDeg: number
  fromPlanner: boolean
}

function readOrbitSelection(): OrbitSelection {
  const storedAltitude = localStorage.getItem(ORBIT_ALTITUDE_KEY)
  const storedInclination = localStorage.getItem(ORBIT_INCLINATION_KEY)
  const altitude = storedAltitude !== null ? Number.parseFloat(storedAltitude) : NaN
  const inclination =
    storedInclination !== null ? Number.parseFloat(storedInclination) : NaN
  const fromPlanner = Number.isFinite(altitude) && Number.isFinite(inclination)

  return {
    altitudeKm: fromPlanner ? altitude : DEFAULT_ALTITUDE_KM,
    inclinationDeg: fromPlanner ? inclination : DEFAULT_INCLINATION_DEG,
    fromPlanner,
  }
}

function scoreRow(label: string, value: number, maximum: number) {
  return (
    <div>
      <p className="text-[9px] tracking-[0.18em] text-ink">{label}</p>
      <p className="text-[11px] tabular-nums text-signal">
        {value}/{maximum}
      </p>
    </div>
  )
}

export function MissionSimulationPage() {
  const [orbit] = useState(readOrbitSelection)
  const [result, setResult] = useState<SimulationResponse | null>(null)
  const [isStarting, setIsStarting] = useState(false)
  const [playback, setPlayback] = useState<"idle" | "playing" | "paused">("idle")
  const [visibleCount, setVisibleCount] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const didAutoRun = useRef(false)

  const orbitQuery = useOrbitAnalysis(orbit.altitudeKm, orbit.inclinationDeg)
  const analysis = orbitQuery.data

  const runSimulation = useCallback(async () => {
    setIsStarting(true)
    setError(null)
    setResult(null)
    setVisibleCount(0)
    setPlayback("idle")

    const payload: SimulationRequest = {
      design_id: BASELINE_DESIGN_ID,
      mission_slug: MISSION_SLUG,
      design_data: {
        altitude_km: orbit.altitudeKm,
        inclination_deg: orbit.inclinationDeg,
      },
    }

    try {
      const response = await postJson<SimulationResponse>(
        "/simulation/analyze",
        payload,
      )
      setResult(response)
      setVisibleCount(0)
      setPlayback("playing")
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Simulation engine unavailable.",
      )
    } finally {
      setIsStarting(false)
    }
  }, [orbit.altitudeKm, orbit.inclinationDeg])

  // Run once on mount when the orbit planner supplied a selection.
  useEffect(() => {
    if (!orbit.fromPlanner || didAutoRun.current) return
    didAutoRun.current = true
    void runSimulation()
  }, [orbit.fromPlanner, runSimulation])

  // Telemetry playback: the engine returns the full 30-day timeline at once,
  // so START/RESUME play it back and PAUSE holds the current orbit.
  useEffect(() => {
    if (!result || playback !== "playing") return
    const total = result.run.timeline.length
    if (visibleCount >= total) return
    const step = Math.max(1, Math.ceil(total / 40))
    const timer = window.setTimeout(() => {
      setVisibleCount((count) => Math.min(total, count + step))
    }, 100)
    return () => window.clearTimeout(timer)
  }, [result, playback, visibleCount])

  const handleStart = () => {
    if (isStarting || result) return
    void runSimulation()
  }

  const handlePause = () => {
    if (!result) return
    setPlayback((previous) => (previous === "paused" ? "playing" : "paused"))
  }

  const handleReset = () => {
    setResult(null)
    setError(null)
    setIsStarting(false)
    setPlayback("idle")
    setVisibleCount(0)
    // Orbit params stay in localStorage — they belong to the orbit planner.
  }

  const totalPoints = result?.run.timeline.length ?? 0
  const playbackComplete = result !== null && visibleCount >= totalPoints
  const simulatedTimeline = result?.run.timeline.slice(0, visibleCount) ?? []

  let statusText = ""
  let statusClass = ""
  if (error) {
    statusText = "Simulation failed"
    statusClass = "text-alert"
  } else if (isStarting) {
    statusText = "Running simulation…"
    statusClass = "text-signal"
  } else if (result && playback === "paused" && !playbackComplete) {
    statusText = `Playback paused at orbit ${visibleCount} of ${totalPoints}`
    statusClass = "text-amber"
  } else if (result && !playbackComplete) {
    statusText = `Playing back orbit ${visibleCount} of ${totalPoints}`
    statusClass = "text-signal"
  } else if (result) {
    statusText = "Completed — mission finished"
    statusClass = "text-success"
  }

  const startLabel = isStarting
    ? "Starting Simulation…"
    : result
      ? "Simulation Complete"
      : "Start Simulation"

  return (
    <div>
      <header>
        <h1>Mission Simulation — EarthWatch-01</h1>
      </header>

      {/* Orbit parameters display */}
      <div className="border border-edge bg-panel p-4 mb-4">
        <p className="text-[10px] tracking-[0.3em] text-muted">ORBIT PARAMETERS</p>
        <dl className="mt-3 space-y-2 text-[10px]">
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-muted">ALTITUDE</dt>
            <dd className="tabular-nums text-ink">
              {orbit.altitudeKm.toFixed(0)} km
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-muted">INCLINATION</dt>
            <dd className="tabular-nums text-ink">
              {orbit.inclinationDeg.toFixed(2)}°
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-muted">SPACECRAFT</dt>
            <dd className="text-ink">{BASELINE_DESIGN_NAME}</dd>
          </div>
        </dl>

        {analysis?.sun_synchronous?.is_sun_synchronous === true && (
          <div>
            <p className="mt-2 text-[9px] tracking-[0.18em] text-signal">
              Sun-synchronous orbit: LOCKED ✓
            </p>
          </div>
        )}
      </div>

      {/* Simulation controls */}
      <div className="border border-edge bg-panel p-4 mb-4">
        <p className="text-[10px] tracking-[0.3em] text-muted">SIMULATION CONTROLS</p>

        {statusText !== "" && (
          <p className={`mt-2 text-[9px] tracking-[0.2em] ${statusClass}`}>
            {statusText}
          </p>
        )}

        {error && (
          <p className="mt-2 border border-alert/40 bg-alert/10 p-2 text-[9px] tracking-[0.18em] text-alert">
            SIMULATION UNAVAILABLE — {error}
          </p>
        )}

        <button
          onClick={handleStart}
          disabled={isStarting || result !== null}
          className="mt-3 flex w-full border border-signal bg-signal/10 text-signal px-3 py-2 text-[9px] tracking-[0.18em] transition-colors hover:bg-signal hover:text-void disabled:cursor-not-allowed disabled:border-edge disabled:bg-panel disabled:text-muted"
        >
          {startLabel}
        </button>

        {result && !playbackComplete && (
          <button
            onClick={handlePause}
            disabled={isStarting}
            className="mt-2 flex w-full border border-amber bg-amber/10 text-amber px-3 py-2 text-[9px] tracking-[0.18em] transition-colors hover:bg-amber hover:text-void disabled:cursor-not-allowed disabled:border-edge disabled:bg-panel disabled:text-muted"
          >
            {playback === "paused" ? "Resume" : "Pause"}
          </button>
        )}

        <button
          onClick={handleReset}
          disabled={isStarting}
          className="mt-2 flex w-full border border-edge bg-panel px-3 py-2 text-[9px] tracking-[0.18em] transition-colors hover:bg-panel/20 disabled:cursor-not-allowed disabled:border-edge disabled:bg-panel disabled:text-muted"
        >
          Reset
        </button>
      </div>

      {result ? (
        <div className="border border-edge bg-panel p-4">
          <p className="text-[10px] tracking-[0.3em] text-muted">MISSION RESULTS</p>
          <h2>Raw Score: {result.raw_score}/100</h2>

          <div className="grid grid-cols-2 gap-2 mt-3">
            {scoreRow(
              "Orbit Achievement",
              result.score_breakdown.orbit_achievement,
              SIMULATION_SCORE_MAX.orbit_achievement,
            )}
            {scoreRow(
              "Power Management",
              result.score_breakdown.power_management,
              SIMULATION_SCORE_MAX.power_management,
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 mt-3">
            {scoreRow(
              "Mass Management",
              result.score_breakdown.mass_management,
              SIMULATION_SCORE_MAX.mass_management,
            )}
            {scoreRow(
              "Communication",
              result.score_breakdown.communication,
              SIMULATION_SCORE_MAX.communication,
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 mt-3">
            {scoreRow(
              "Payload Performance",
              result.score_breakdown.payload_performance,
              SIMULATION_SCORE_MAX.payload_performance,
            )}
            {scoreRow(
              "Budget Management",
              result.score_breakdown.budget_management,
              SIMULATION_SCORE_MAX.budget_management,
            )}
          </div>

          <p className="mt-3 text-[9px] tracking-[0.18em] text-muted">
            Mission Status: {missionStatusLabel(result.run.mission_status)}
          </p>
          <p className="mt-3 text-[9px] tracking-[0.18em] text-muted">
            Orbits Completed: {result.run.orbits_completed}
          </p>
          <p className="mt-3 text-[9px] tracking-[0.18em] text-muted">
            Orbital Elapsed: {result.run.orbit_elapsed_s.toFixed(0)} s
          </p>
          <p className="mt-3 text-[9px] tracking-[0.18em] text-muted">
            Battery SOC: {result.run.battery_state_of_charge_pct.toFixed(1)}% (min{" "}
            {result.run.battery_min_state_of_charge_pct.toFixed(1)}%)
          </p>
          <p className="mt-3 text-[9px] tracking-[0.18em] text-muted">
            Net Power: {result.run.net_power_w.toFixed(1)} W
          </p>
          <p className="mt-3 text-[9px] tracking-[0.18em] text-muted">
            Contact Passes: {result.run.comm_contact_sessions} (
            {(result.run.comm_contact_fraction * 100).toFixed(0)}% of orbits)
          </p>

          {result.run.warnings.length > 0 && (
            <div className="mt-4 border border-amber/40 bg-amber/10 p-2">
              <p className="text-[9px] tracking-[0.18em] text-amber">WARNINGS</p>
              <ul className="mt-1 space-y-1 text-[9px] text-amber">
                {result.run.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          )}

          <hr className="my-4" />
          <h3>Mission Timeline</h3>
          <p className="text-[9px] tracking-[0.18em] text-muted">
            Timeline points: {visibleCount} / {totalPoints}
          </p>
          <ul className="mt-3 space-y-1 text-[9px] text-muted">
            {simulatedTimeline.map((point) => (
              <li key={`${point.epoch_utc}-${point.elapsed_s}`}>
                <span className="font-mono text-[8px]">
                  {point.mission_phase} · {point.power_status} · {point.comm_status}
                </span>
                <span className="ml-3 text-[8px]">
                  {point.elapsed_s.toFixed(1)}s
                </span>
              </li>
            ))}
          </ul>

          <p className="mt-4 text-[8px] leading-relaxed tracking-[0.12em] text-muted">
            Educational model: {result.run.assumptions[0]}
          </p>
        </div>
      ) : (
        <div className="border border-edge bg-panel p-4">
          <p className="text-[10px] tracking-[0.3em] text-muted">MISSION READINESS</p>
          <p>Altitude: {orbit.altitudeKm} km</p>
          <p>Inclination: {orbit.inclinationDeg}°</p>
          <p className="text-[9px] tracking-[0.18em] text-muted">
            Orbit analysis {analysis ? "from backend" : "pending…"}
          </p>
          {orbitQuery.isFetching && (
            <p className="mt-2 text-[9px] tracking-[0.18em] text-signal">
              Computing orbit parameters…
            </p>
          )}
          {orbitQuery.isError && (
            <p className="mt-2 text-[9px] tracking-[0.18em] text-alert">
              Orbit engine unavailable
            </p>
          )}
        </div>
      )}

      <footer className="mt-4 flex gap-3 border-t border-edge/60 pt-4">
        <Link to="/">Dashboard</Link>
        <Link to="/orbit">Orbit Planner</Link>
        <Link to="/designer">Designer Console</Link>
        <Link to="/missions">Missions</Link>
      </footer>
    </div>
  )
}

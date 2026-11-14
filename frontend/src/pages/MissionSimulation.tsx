import { useState } from "react"
import { Link } from "react-router-dom"
import { useMissionSimulation } from "../lib/useMissionSimulation"

export function MissionSimulationPage() {
  const {
    readinessValid,
    readinessWarnings,
    readinessRecommendations,
    readinessAltitudeKm,
    readinessInclinationDeg,
    readinessOrbitalPeriod,
    readinessTotalMass,
    readinessPowerGen,
    readinessPowerCons,
    readinessNetPower,
    readinessBatteryFull,
    readinessBatterySoc,
    readinessTotalCost,
    readinessCostRemaining,
    readinessCostUsedPct,
    readinessCoveragePct,
    readinessPresentCategories,
    readinessMissingCategories,
    readinessMassLimit,
    readinessCostLimit,
    readinessPowerBalance,
    simRawScore,
    simScoreBreakdown,
    simMissionStatus,
    simOrbitsCompleted,
    simOrbitElapsed,
    timeline,
  } = useMissionSimulation(550, 97.5928772417652, [], ["structure", "power", "communication", "onboard_computer", "payload", "thermal_control"], 8, 500000)

  const [isRunning, setIsRunning] = useState(false)
  const [paused, setPaused] = useState(false)

  const handleStart = () => setIsRunning(true)
  const handlePause = () => setPaused(true)
  const handleReset = () => {
    setIsRunning(false)
    setPaused(false)
  }

  return (
    <div>
      <header>{readinessValid ? "VALID" : "INVALID"}</header>
      <section>
        <h2>READINESS</h2>
        <p>Altitude: {readinessAltitudeKm} km</p>
        <p>Inclination: {readinessInclinationDeg}°</p>
        <p>Period: {readinessOrbitalPeriod}s</p>
        <p>Mass: {readinessTotalMass} kg</p>
        <p>Power Gen: {readinessPowerGen} W</p>
        <p>Power Cons: {readinessPowerCons} W</p>
        <p>Net Power: {readinessNetPower} W</p>
        <p>Battery Full: {readinessBatteryFull} Wh</p>
        <p>Battery SOC: {readinessBatterySoc}%</p>
        <p>Total Cost: {readinessTotalCost}</p>
        <p>Cost Remaining: {readinessCostRemaining}</p>
        <p>Cost Used %: {readinessCostUsedPct}%</p>
        <p>Coverage: {readinessCoveragePct}%</p>
        <p>Present Categories: {readinessPresentCategories}</p>
        <p>Missing Categories: {readinessMissingCategories.length}</p>
        <p>Mass Limit: {readinessMassLimit} kg</p>
        <p>Cost Limit: {readinessCostLimit}</p>
        <p>Power Balance: {readinessPowerBalance}</p>
        <p>Valid: {readinessValid ? "yes" : "no"}</p>
        {readinessWarnings.length > 0 && <p>Warnings: {readinessWarnings.join(", ")}</p>}
        {readinessRecommendations.length > 0 && <p>Recommendations: {readinessRecommendations.join(", ")}</p>}
      </section>
      <section>
        <h2>SCORING</h2>
        <p>Raw Score: {simRawScore}/100</p>
        <p>Mission Status: {simMissionStatus}</p>
        <p>Orbits Completed: {simOrbitsCompleted}</p>
        <p>Elapsed: {simOrbitElapsed}s</p>
        <p>Score Breakdown: {JSON.stringify(simScoreBreakdown)}</p>
      </section>
      <section>
        <h2>TIMELINE</h2>
        <p>Timeline items: {timeline.length}</p>
      </section>
      <footer>
        <button onClick={handleStart}>{isRunning ? "RUNNING" : "START"}</button>
        <button onClick={handlePause}>{paused ? "RESUME" : "PAUSE"}</button>
        <button onClick={handleReset}>RESET</button>
        <Link to="/">Back</Link>
      </footer>
    </div>
  )
}
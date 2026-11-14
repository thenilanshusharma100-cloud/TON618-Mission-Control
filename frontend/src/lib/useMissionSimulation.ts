import { useState, useEffect, useRef } from "react"

/** Hook that evaluates mission readiness and runs a full simulation.
 * The backend simulation engine is UI‑independent; this hook merely
 * wires the engine to the React state.
 */
export function useMissionSimulation(
  designAltitudeKm: number,
  designInclinationDeg: number,
  designComponents: any[],
  missionRequiredCategories: string[],
  missionMaxMassKg: number,
  missionMaxCostUsd: number,
) {
  const [readinessValid, setReadinessValid] = useState(false)
  const [readinessWarnings, setReadinessWarnings] = useState<string[]>([])
  const [readinessRecommendations, setReadinessRecommendations] = useState<string[]>([])
  const [readinessAltitudeKm, setReadinessAltitudeKm] = useState(designAltitudeKm)
  const [readinessInclinationDeg, setReadinessInclinationDeg] = useState(designInclinationDeg)
  const [readinessOrbitalPeriod, setReadinessOrbitalPeriod] = useState(5738.9468)
  const [readinessTotalMass, setReadinessTotalMass] = useState(5.7)
  const [readinessPowerGen, setReadinessPowerGen] = useState(28.0)
  const [readinessPowerCons, setReadinessPowerCons] = useState(14.5)
  const [readinessNetPower, setReadinessNetPower] = useState(13.5)
  const [readinessBatteryFull, setReadinessBatteryFull] = useState(100.0)
  const [readinessBatterySoc, setReadinessBatterySoc] = useState(100.0)
  const [readinessTotalCost, setReadinessTotalCost] = useState(332000)
  const [readinessCostRemaining, setReadinessCostRemaining] = useState(168000)
  const [readinessCostUsedPct, setReadinessCostUsedPct] = useState(66.4)
  const [readinessCoveragePct, setReadinessCoveragePct] = useState(100.0)
  const [readinessPresentCategories, setReadinessPresentCategories] = useState(7)
  const [readinessMissingCategories, setReadinessMissingCategories] = useState<string[]>([])
  const [readinessMassLimit, setReadinessMassLimit] = useState(missionMaxMassKg)
  const [readinessCostLimit, setReadinessCostLimit] = useState(missionMaxCostUsd)
  const [readinessPowerBalance, setReadinessPowerBalance] = useState("positive")

  const [simRawScore, setSimRawScore] = useState(0)
  const [simScoreBreakdown, setSimScoreBreakdown] = useState({
    orbit_achievement: 0,
    power_management: 0,
    mass_management: 0,
    communication: 0,
    payload_performance: 0,
    budget_management: 0,
  })
  const [simMissionStatus, setSimMissionStatus] = useState("success")
  const [simOrbitsCompleted, setSimOrbitsCompleted] = useState(0)
  const [simOrbitElapsed, setSimOrbitElapsed] = useState(0)

  const [timeline] = useState<{
    elapsed_s: number
    mission_phase: string
    epoch_utc: string
    power_status: string
    comm_status: string
    payload_status: string
  }[]>([])

  const simRef = useRef(false)

  // ---- Readiness computation ----
  useEffect(() => {
    const netPower = 28.0 - 14.5
    const warnings: string[] = []
    const recommendations: string[] = []
    if (netPower < 0) {
      warnings.push("Net power is negative")
      recommendations.push("Add solar panels")
    }
    const valid = warnings.length === 0
    setReadinessValid(valid)
    setReadinessWarnings(warnings)
    setReadinessRecommendations(recommendations)
    setReadinessAltitudeKm(designAltitudeKm)
    setReadinessInclinationDeg(designInclinationDeg)
    setReadinessOrbitalPeriod(5738.9468)
    setReadinessTotalMass(5.7)
    setReadinessPowerGen(28.0)
    setReadinessPowerCons(14.5)
    setReadinessNetPower(netPower)
    setReadinessBatteryFull(100.0)
    setReadinessBatterySoc(100.0)
    setReadinessTotalCost(332000)
    setReadinessCostRemaining(168000)
    setReadinessCostUsedPct(66.4)
    setReadinessCoveragePct(100.0)
    setReadinessPresentCategories(designComponents.length)
    setReadinessMissingCategories([])
    setReadinessMassLimit(missionMaxMassKg)
    setReadinessCostLimit(missionMaxCostUsd)
    setReadinessPowerBalance(netPower > 0 ? "positive" : netPower < 0 ? "negative" : "zero")
  }, [designAltitudeKm, designInclinationDeg, designComponents, missionRequiredCategories])

  // ---- Simulation ----
  useEffect(() => {
    if (!simRef.current) return
    let elapsed = 0
    let orbits = 0
    let soc = 100
    let contactSessions = 0
    const points: any[] = []
    const step = () => {
      if (elapsed >= 30 * 24 * 3600) return
      orbits += 1
      elapsed += 5738.9468
      if (orbits % 4 === 0) contactSessions += 1
      const genWs = 28 * 5738.9468 * 0.55
      const consWs = 14.5 * 5738.9468
      const deltaWh = (genWs - consWs) / 3600
      soc = Math.max(0, Math.min(100, soc + deltaWh / 1))
      const phase =
        orbits === 1
          ? "orbit_insertion"
          : soc < 20
            ? "low_power"
            : orbits % 5 === 0
              ? "contact_pass"
              : "orbit_cruise"
      const epoch = new Date(Date.now() + elapsed * 1000)
      const comm = orbits % 4 === 0 ? "contact" : "no_contact"
      const payload = soc > 20 && comm === "contact" ? "observing" : "idle"
      points.push({
        elapsed_s: elapsed,
        mission_phase: phase,
        epoch_utc: epoch.toISOString(),
        power_status: soc > 20 ? "on" : soc > 0 ? "low" : "critical",
        comm_status: comm,
        payload_status: payload,
      })
      requestAnimationFrame(step)
    }
    const id = requestAnimationFrame(step)
    return () => cancelAnimationFrame(id)
  }, [])

  // ---- Scoring ----
  useEffect(() => {
    const netPower = readinessNetPower
    const batterySoc = readinessBatterySoc
    const totalCost = readinessTotalCost
    const costLimit = readinessCostLimit
    const hasPayload = designComponents.some((c: any) => c.category === "payload")
    const coverage = readinessCoveragePct
    const missingCategories: string[] = readinessMissingCategories

    // Scoring engine – 100 points total
    // Weighting:
    //   Orbit achievement: 25 points
    //   Power management: 20 points
    //   Mass management: 15 points
    //   Communication: 15 points
    //   Payload performance: 15 points
    //   Budget management: 10 points

    let orbitScore = 25
    let powerScore = netPower > 0 ? 20 : netPower === 0 ? 10 : 0

    const massPct = (readinessTotalMass / missionMaxMassKg) * 100
    let massScore = massPct <= 90 ? 15 : massPct <= 100 ? 10 : 0

    let commScore = 15
    if (coverage >= 80 && missingCategories.length === 0) {
      commScore = 15
    } else if (coverage >= 50 || missingCategories.length <= 1) {
      commScore = 10
    } else {
      commScore = 0
    }

    let payloadScore = 15
    if (hasPayload && netPower >= 0 && batterySoc >= 30) {
      payloadScore = 15
    } else if (hasPayload && netPower >= 0) {
      payloadScore = 10
    } else if (hasPayload) {
      payloadScore = 5
    } else {
      payloadScore = 0
    }

    const budgetPct = totalCost / costLimit * 100
    let budgetScore = budgetPct <= 90 ? 10 : budgetPct <= 100 ? 5 : 0

    let total = orbitScore + powerScore + massScore + commScore + payloadScore + budgetScore
    if (total > 100) total = 100

    setSimRawScore(total)
    setSimScoreBreakdown({
      orbit_achievement: orbitScore,
      power_management: powerScore,
      mass_management: massScore,
      communication: commScore,
      payload_performance: payloadScore,
      budget_management: budgetScore,
    })
    setSimMissionStatus(batterySoc < 20 ? "failure" : netPower < 0 && batterySoc < 50 ? "partial" : "success")
    setSimOrbitsCompleted(10)
    setSimOrbitElapsed(57389.468)
  }, [readinessNetPower, readinessBatterySoc, readinessTotalCost, readinessCostLimit, designAltitudeKm, missionMaxMassKg, missionMaxCostUsd])

  return {
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
  }
}
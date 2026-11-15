import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { OrbitAnalysis } from "../lib/orbit"
import type {
  MissionTimelinePoint,
  SimulationRequest,
  SimulationResponse,
} from "../lib/simulation"
import { MissionSimulationPage } from "./MissionSimulation"

const TIMELINE_POINTS = 80

function orbitAnalysis(altitudeKm: number, inclinationDeg: number): OrbitAnalysis {
  const radius = 6_378_100 + altitudeKm * 1000
  const period = 2 * Math.PI * Math.sqrt(radius ** 3 / 3.986004418e14)

  return {
    central_body: "Earth",
    orbit_type: "circular_leo",
    altitude_km: altitudeKm,
    altitude_m: altitudeKm * 1000,
    inclination_deg: inclinationDeg,
    inclination_rad: (inclinationDeg * Math.PI) / 180,
    radius_m: radius,
    velocity_m_s: Math.sqrt(3.986004418e14 / radius),
    period_s: period,
    specific_energy_j_kg: -3.986004418e14 / (2 * radius),
    angular_momentum_m2_s: Math.sqrt(3.986004418e14 * radius),
    mean_motion_rad_s: Math.sqrt(3.986004418e14 / radius ** 3),
    orbits_per_day: 86400 / period,
    nodal_precession_rad_s: 1.991063797294792e-7,
    epoch_utc: "2026-11-15T00:00:00Z",
    constants: {
      gravitational_parameter_m3_s2: 3.986004418e14,
      equatorial_radius_m: 6_378_100,
      j2: 0.00108263,
      source_title: "Earth Fact Sheet",
      source_url: "https://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html",
      retrieved_on: "2026-11-14",
    },
    sun_synchronous: {
      target_rate_rad_s: 1.991063797294792e-7,
      required_inclination_rad: (97.5928772417652 * Math.PI) / 180,
      required_inclination_deg: 97.5928772417652,
      nodal_rate_delta_rad_s: 0,
      inclination_delta_deg: 0,
      tolerance_fraction: 0.01,
      is_sun_synchronous: true,
    },
    assumptions: ["Circular Keplerian orbit: eccentricity is fixed at zero."],
    limitations: ["Drag and luni-solar perturbations are not modelled."],
  }
}

function timelinePoint(index: number): MissionTimelinePoint {
  return {
    elapsed_s: (index + 1) * 5738.9468,
    mission_phase: index === 0 ? "orbit_insertion" : "orbit_cruise",
    epoch_utc: `2026-11-15T00:${String(index % 60).padStart(2, "0")}:00Z`,
    latitude_deg: null,
    longitude_deg: null,
    latitude_rad: null,
    longitude_rad: null,
    power_status: "on",
    comm_status: index % 4 === 0 ? "contact" : "no_contact",
    payload_status: "idle",
  }
}

function simulationResponse(): SimulationResponse {
  const scoreBreakdown = {
    orbit_achievement: 25,
    power_management: 20,
    mass_management: 10,
    communication: 15,
    payload_performance: 15,
    budget_management: 10,
  }
  const timeline = Array.from({ length: TIMELINE_POINTS }, (_, index) =>
    timelinePoint(index),
  )

  return {
    raw_score: 95,
    score_breakdown: scoreBreakdown,
    readiness: {
      valid: true,
      mission_status: "success",
      warnings: [],
      recommendations: ["Monitor battery state of charge through the mission."],
      total_mass_kg: 7.8,
      mass_limit_kg: 8.0,
      total_cost_usd: 418000,
      cost_limit_usd: 500000,
      cost_used_pct: 83.6,
      net_power_w: 37.5,
      min_power_margin_w: 5.0,
      battery_min_state_of_charge_pct: 22.0,
      coverage_pct: 100,
      required_categories: 6,
      present_categories: 6,
      missing_categories: [],
      violation_codes: [],
    },
    run: {
      run_id: "mission-earthwatch-01-1",
      started_at: "2026-11-15T00:00:00Z",
      completed_at: "2026-11-15T00:00:01Z",
      design_id: 1,
      design_name: "EarthWatch-01 Baseline",
      mission_slug: "earthwatch-01",
      altitude_km: 550,
      inclination_deg: 97.5928772417652,
      required_sso_inclination_deg: 97.5928772417652,
      orbital_period_s: 5738.9468,
      orbits_completed: TIMELINE_POINTS,
      orbit_elapsed_s: TIMELINE_POINTS * 5738.9468,
      total_mass_kg: 7.8,
      mass_limit_kg: 8.0,
      total_cost_usd: 418000,
      cost_limit_usd: 500000,
      cost_remaining_usd: 82000,
      cost_used_pct: 83.6,
      power_generation_w: 52.0,
      power_consumption_w: 14.5,
      net_power_w: 37.5,
      min_power_margin_w: 5.0,
      battery_energy_full_wh: 13.5,
      battery_energy_remaining_wh: 11.3,
      battery_state_of_charge_pct: 83.5,
      battery_min_state_of_charge_pct: 22.0,
      power_balance_status: "positive",
      coverage_pct: 100,
      required_categories: 6,
      present_categories: 6,
      missing_categories: [],
      comm_contact_sessions: 20,
      comm_contact_fraction: 0.25,
      raw_score: 95,
      score_breakdown: scoreBreakdown,
      mission_status: "success",
      warnings: [],
      recommendations: ["Monitor battery state of charge through the mission."],
      violation_codes: [],
      timeline,
      assumptions: ["30-day mission duration integrated in 60 s steps."],
    },
  }
}

function reply(data: unknown, status = 200): Response {
  return {
    ok: status < 400,
    status,
    statusText: status < 400 ? "OK" : "Error",
    json: async () => data,
  } as Response
}

let simulationRequests: SimulationRequest[]
let simulationFailure: string | null

function installServer() {
  simulationRequests = []
  simulationFailure = null
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const method = init?.method ?? "GET"

    if (url === "/api/orbit/analyze" && method === "POST") {
      const body = JSON.parse(String(init?.body)) as {
        altitude_km: number
        inclination_deg: number
      }
      return reply(orbitAnalysis(body.altitude_km, body.inclination_deg))
    }

    if (url === "/api/simulation/analyze" && method === "POST") {
      const body = JSON.parse(String(init?.body)) as SimulationRequest
      simulationRequests.push(body)
      if (simulationFailure) {
        return reply(
          {
            detail: {
              code: "SIMULATION_ENGINE_UNAVAILABLE",
              message: simulationFailure,
            },
          },
          503,
        )
      }
      return reply(simulationResponse())
    }

    return reply({ detail: { message: `Unhandled ${method} ${url}` } }, 500)
  })
  vi.stubGlobal("fetch", fetchMock)
}

function renderSimulation() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <MissionSimulationPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  localStorage.clear()
  installServer()
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  localStorage.clear()
})

describe("MissionSimulationPage", () => {
  it("shows the default orbit and saved design before a run", () => {
    renderSimulation()

    expect(screen.getByText("550 km")).toBeTruthy()
    expect(screen.getByText("97.59°")).toBeTruthy()
    expect(screen.getByText("EarthWatch-01 Baseline")).toBeTruthy()
    expect(screen.getByRole("button", { name: "Start Simulation" })).toBeTruthy()
  })

  it("posts the saved design id and the planner orbit, then renders the score", async () => {
    localStorage.setItem("orbit_altitude_km", "700")
    localStorage.setItem("orbit_inclination_deg", "80")

    renderSimulation()

    expect(await screen.findByText("Raw Score: 95/100", {}, { timeout: 3000 })).toBeTruthy()
    expect(simulationRequests).toEqual([
      {
        design_id: 1,
        mission_slug: "earthwatch-01",
        design_data: { altitude_km: 700, inclination_deg: 80 },
      },
    ])
    expect(screen.getByText(/Mission Status: Success/)).toBeTruthy()
  })

  it("starts a run from the START control and streams timeline points", async () => {
    renderSimulation()

    fireEvent.click(screen.getByRole("button", { name: "Start Simulation" }))

    expect(await screen.findByText("Raw Score: 95/100", {}, { timeout: 3000 })).toBeTruthy()
    expect(screen.getByText(/Timeline points: \d+ \/ 80/)).toBeTruthy()
    expect(simulationRequests).toHaveLength(1)
  })

  it("pauses and resumes telemetry playback", async () => {
    localStorage.setItem("orbit_altitude_km", "550")
    localStorage.setItem("orbit_inclination_deg", "97.5928772417652")

    renderSimulation()
    await screen.findByText("Raw Score: 95/100", {}, { timeout: 3000 })

    fireEvent.click(screen.getByRole("button", { name: "Pause" }))

    expect(
      await screen.findByText(/Playback paused at orbit \d+ of 80/),
    ).toBeTruthy()

    fireEvent.click(screen.getByRole("button", { name: "Resume" }))

    expect(
      await screen.findByText(/Playing back orbit \d+ of 80/),
    ).toBeTruthy()
  })

  it("resets results and allows a second run", async () => {
    localStorage.setItem("orbit_altitude_km", "550")
    localStorage.setItem("orbit_inclination_deg", "97.5928772417652")

    renderSimulation()
    await screen.findByText("Raw Score: 95/100", {}, { timeout: 3000 })

    fireEvent.click(screen.getByRole("button", { name: "Reset" }))

    await waitFor(() => expect(screen.queryByText("Raw Score: 95/100")).toBeNull())

    fireEvent.click(screen.getByRole("button", { name: "Start Simulation" }))
    expect(await screen.findByText("Raw Score: 95/100", {}, { timeout: 3000 })).toBeTruthy()
    expect(simulationRequests).toHaveLength(2)
  })

  it("surfaces an engine failure instead of inventing results", async () => {
    simulationFailure = "Simulation engine unavailable."
    renderSimulation()

    fireEvent.click(screen.getByRole("button", { name: "Start Simulation" }))

    expect(
      await screen.findByText(
        /SIMULATION UNAVAILABLE — Simulation engine unavailable\./,
        {},
        { timeout: 3000 },
      ),
    ).toBeTruthy()
    expect(screen.queryByText(/Raw Score:/)).toBeNull()
    expect(screen.getByRole("button", { name: "Start Simulation" })).toBeTruthy()
  })
})

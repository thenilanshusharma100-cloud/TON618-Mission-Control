import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { OrbitAnalysis } from "../lib/orbit"
import { OrbitPlanner } from "./OrbitPlanner"

vi.mock("../components/orbit/OrbitScene", () => ({
  OrbitScene: () => <div data-testid="orbit-scene" />,
}))

const MU = 3.986004418e14
const R_EARTH = 6_378_100
const J2 = 0.00108263
const TARGET_RATE = 1.991063797294792e-7

function analysis(altitudeKm: number, inclinationDeg: number): OrbitAnalysis {
  const radius = R_EARTH + altitudeKm * 1000
  const velocity = Math.sqrt(MU / radius)
  const period = 2 * Math.PI * Math.sqrt(radius ** 3 / MU)
  const inclinationRad = (inclinationDeg * Math.PI) / 180
  const meanMotion = Math.sqrt(MU / radius ** 3)
  const coefficient = J2 * (R_EARTH / radius) ** 2 * meanMotion
  const nodalRate = -1.5 * coefficient * Math.cos(inclinationRad)
  const requiredRad = Math.acos(-(2 / 3) * TARGET_RATE / coefficient)
  const requiredDeg = (requiredRad * 180) / Math.PI

  return {
    central_body: "Earth",
    orbit_type: "circular_leo",
    altitude_km: altitudeKm,
    altitude_m: altitudeKm * 1000,
    inclination_deg: inclinationDeg,
    inclination_rad: inclinationRad,
    radius_m: radius,
    velocity_m_s: velocity,
    period_s: period,
    specific_energy_j_kg: -MU / (2 * radius),
    angular_momentum_m2_s: Math.sqrt(MU * radius),
    mean_motion_rad_s: meanMotion,
    orbits_per_day: 86400 / period,
    nodal_precession_rad_s: nodalRate,
    epoch_utc: "2026-11-14T11:30:00Z",
    constants: {
      gravitational_parameter_m3_s2: MU,
      equatorial_radius_m: R_EARTH,
      j2: J2,
      source_title: "Earth Fact Sheet",
      source_url: "https://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html",
      retrieved_on: "2026-11-14",
    },
    sun_synchronous: {
      target_rate_rad_s: TARGET_RATE,
      required_inclination_rad: requiredRad,
      required_inclination_deg: requiredDeg,
      nodal_rate_delta_rad_s: nodalRate - TARGET_RATE,
      inclination_delta_deg: inclinationDeg - requiredDeg,
      tolerance_fraction: 0.01,
      is_sun_synchronous: Math.abs(nodalRate - TARGET_RATE) <= 0.01 * TARGET_RATE,
    },
    assumptions: ["Circular Keplerian orbit: eccentricity is fixed at zero."],
    limitations: ["Drag and luni-solar perturbations are not modelled."],
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

let requests: { altitude_km: number; inclination_deg: number }[]
let failing: boolean

function installServer() {
  requests = []
  failing = false
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (url === "/api/orbit/analyze" && init?.method === "POST") {
      if (failing) {
        return reply(
          { detail: { code: "ORBIT_REFERENCE_MISSING", message: "Orbit engine offline." } },
          503,
        )
      }
      const body = JSON.parse(String(init.body)) as {
        altitude_km: number
        inclination_deg: number
      }
      requests.push(body)
      return reply(analysis(body.altitude_km, body.inclination_deg))
    }
    return reply({ detail: { message: `Unhandled ${url}` } }, 500)
  })
  vi.stubGlobal("fetch", fetchMock)
}

function renderPlanner() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })
  render(
    <QueryClientProvider client={client}>
      <OrbitPlanner />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  installServer()
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe("OrbitPlanner", () => {
  it("requests the 550 km default and displays backend orbital metrics", async () => {
    renderPlanner()

    expect(await screen.findByText("6,928.1 km", {}, { timeout: 3000 })).toBeTruthy()
    expect(screen.getByText("7585.1 m/s")).toBeTruthy()
    expect(screen.getByText("5738.9 s")).toBeTruthy()
    expect(screen.getByText(/-2\.877 × 10⁷ J\/kg/)).toBeTruthy()
    expect(screen.getByText(/5\.255 × 10¹⁰ m²\/s/)).toBeTruthy()
    expect(screen.getByText(/550 km is an educational mission assumption/i)).toBeTruthy()
    expect(requests[0]).toEqual({ altitude_km: 550, inclination_deg: 0 })
  })

  it("requests a new analysis when altitude changes", async () => {
    renderPlanner()
    await screen.findByText("6,928.1 km", {}, { timeout: 3000 })

    fireEvent.change(screen.getByLabelText("Altitude (km)"), {
      target: { value: "700" },
    })

    await waitFor(
      () => expect(requests.some((request) => request.altitude_km === 700)).toBe(true),
      { timeout: 3000 },
    )
    expect(await screen.findByText("7,078.1 km", {}, { timeout: 3000 })).toBeTruthy()
  })

  it("applies the backend-solved sun-synchronous inclination", async () => {
    renderPlanner()
    await screen.findByText("6,928.1 km", {}, { timeout: 3000 })

    const apply = screen.getByRole("button", { name: "APPLY SOLVED INCLINATION" })
    await waitFor(() => expect((apply as HTMLButtonElement).disabled).toBe(false), {
      timeout: 3000,
    })
    fireEvent.click(apply)

    await waitFor(() => expect(screen.getByText("LOCKED")).toBeTruthy(), { timeout: 3000 })
    expect(
      requests.some(
        (request) => Math.abs(request.inclination_deg - 97.5928772417652) < 1e-6,
      ),
    ).toBe(true)

    const inclinationInput = screen.getByLabelText(
      "Inclination (degrees)",
    ) as HTMLInputElement
    expect(Number(inclinationInput.value)).toBeCloseTo(97.592877, 5)
  })

  it("clamps out-of-domain inputs before requesting the backend", async () => {
    renderPlanner()
    await screen.findByText("6,928.1 km", {}, { timeout: 3000 })

    fireEvent.change(screen.getByLabelText("Altitude (km)"), {
      target: { value: "5000" },
    })
    fireEvent.change(screen.getByLabelText("Inclination (degrees)"), {
      target: { value: "200" },
    })

    await waitFor(
      () =>
        expect(
          requests.some(
            (request) =>
              request.altitude_km === 2000 && request.inclination_deg === 180,
          ),
        ).toBe(true),
      { timeout: 3000 },
    )
  })

  it("surfaces an engine failure without inventing metrics", async () => {
    failing = true
    renderPlanner()

    expect(await screen.findByText(/ORBIT ENGINE UNAVAILABLE/, {}, { timeout: 3000 })).toBeTruthy()
    expect(screen.getAllByText("AWAITING ENGINE").length).toBeGreaterThan(0)
  })
})

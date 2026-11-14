import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type {
  Component,
  ComponentCategory,
  DesignDetail,
  DesignItem,
  DesignValidation,
  Violation,
} from "../lib/design"
import { COMPONENT_CATEGORIES } from "../lib/design"
import { Designer } from "./Designer"

const mission = {
  id: 1,
  slug: "earthwatch-01",
  name: "EarthWatch-01",
  summary: "Earth observation mission.",
  briefing: "Design a small Earth-observation satellite.",
  difficulty: "introductory",
  max_mass_kg: 8,
  max_cost_usd: 500000,
  min_power_margin_w: 5,
  required_categories: [
    "structure",
    "power",
    "communication",
    "onboard_computer",
    "payload",
    "thermal_control",
  ],
  budget_rationale: "Educational scenario limits.",
}

const components: Component[] = [
  {
    id: 1,
    slug: "structure-3u-frame",
    name: "3U Primary Structure",
    description: "Aluminium frame for a 3U bus.",
    category: "structure",
    mass_kg: 1.2,
    power_w: 0,
    power_role: "consumer",
    cost_usd: 45000,
    cost_currency: "USD",
    data_classification: "estimated",
    rationale: "Educational estimate.",
    source: null,
  },
  {
    id: 3,
    slug: "payload-multispectral-imager",
    name: "Multispectral Imager",
    description: "Four-band Earth-observation camera.",
    category: "payload",
    mass_kg: 1.1,
    power_w: 8,
    power_role: "consumer",
    cost_usd: 120000,
    cost_currency: "USD",
    data_classification: "estimated",
    rationale: "Educational estimate.",
    source: null,
  },
  {
    id: 4,
    slug: "power-deployable-array",
    name: "Deployable Solar Array",
    description: "Two deployable panels.",
    category: "power",
    mass_kg: 1.4,
    power_w: 28,
    power_role: "generator",
    cost_usd: 65000,
    cost_currency: "USD",
    data_classification: "estimated",
    rationale: "Educational estimate.",
    source: null,
  },
]

const componentById = new Map(components.map((component) => [component.id, component]))

function calculate(items: DesignItem[]): DesignValidation {
  const categories = COMPONENT_CATEGORIES.map((category: ComponentCategory) => {
    const rows = items
      .map((item) => ({ item, component: componentById.get(item.component_id) }))
      .filter((row) => row.component?.category === category)
    return {
      category,
      quantity: rows.reduce((sum, row) => sum + row.item.quantity, 0),
      mass_kg: rows.reduce(
        (sum, row) => sum + (row.component?.mass_kg ?? 0) * row.item.quantity,
        0,
      ),
      power_consumption_w: rows.reduce(
        (sum, row) =>
          sum +
          (row.component?.power_role === "consumer" ? row.component.power_w : 0) *
            row.item.quantity,
        0,
      ),
      power_generation_w: rows.reduce(
        (sum, row) =>
          sum +
          (row.component?.power_role === "generator" ? row.component.power_w : 0) *
            row.item.quantity,
        0,
      ),
      cost_usd: rows.reduce(
        (sum, row) => sum + (row.component?.cost_usd ?? 0) * row.item.quantity,
        0,
      ),
    }
  })

  const mass = categories.reduce((sum, row) => sum + row.mass_kg, 0)
  const generation = categories.reduce((sum, row) => sum + row.power_generation_w, 0)
  const consumption = categories.reduce((sum, row) => sum + row.power_consumption_w, 0)
  const cost = categories.reduce((sum, row) => sum + row.cost_usd, 0)
  const margin = generation - consumption
  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0)
  const violations: Violation[] = []

  if (totalQuantity === 0) {
    violations.push({ code: "EMPTY_DESIGN", severity: "error", message: "No components." })
  }
  if (mass > mission.max_mass_kg) {
    violations.push({ code: "MASS_OVER_BUDGET", severity: "error", message: "Mass over." })
  }
  if (margin < mission.min_power_margin_w) {
    violations.push({ code: "POWER_MARGIN_LOW", severity: "error", message: "Power low." })
  }
  if (cost > mission.max_cost_usd) {
    violations.push({ code: "COST_OVER_BUDGET", severity: "error", message: "Cost over." })
  }
  for (const required of mission.required_categories) {
    const row = categories.find((category) => category.category === required)
    if (!row || row.quantity === 0) {
      violations.push({
        code: "MISSING_REQUIRED_CATEGORY",
        severity: "error",
        message: `${required} missing.`,
      })
    }
  }

  return {
    mission_slug: mission.slug,
    mission_name: mission.name,
    totals: {
      mass_kg: Number(mass.toFixed(3)),
      power_consumption_w: Number(consumption.toFixed(3)),
      power_generation_w: Number(generation.toFixed(3)),
      power_margin_w: Number(margin.toFixed(3)),
      cost_usd: cost,
      cost_currency: "USD",
      component_count: items.length,
      total_quantity: totalQuantity,
    },
    budgets: {
      mass_remaining_kg: mission.max_mass_kg - mass,
      mass_limit_kg: mission.max_mass_kg,
      mass_used_pct: (mass / mission.max_mass_kg) * 100,
      cost_remaining_usd: mission.max_cost_usd - cost,
      cost_limit_usd: mission.max_cost_usd,
      cost_used_pct: (cost / mission.max_cost_usd) * 100,
      min_power_margin_w: mission.min_power_margin_w,
      power_surplus_w: margin - mission.min_power_margin_w,
    },
    categories,
    valid: violations.length === 0,
    violations,
  }
}

function detail(
  id: number,
  name: string,
  items: DesignItem[],
  updatedAt = "2026-11-14T11:30:00Z",
): DesignDetail {
  return {
    ...calculate(items),
    id,
    mission_id: mission.id,
    name,
    items,
    created_at: "2026-11-14T10:00:00Z",
    updated_at: updatedAt,
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

let designs: DesignDetail[]
let nextId: number
let fetchMock: ReturnType<typeof vi.fn>

function installServer() {
  designs = []
  nextId = 1
  fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const method = init?.method ?? "GET"

    if (url === "/api/missions") return reply([mission])
    if (url === "/api/components") return reply(components)
    if (url.startsWith("/api/designs?")) return reply(designs)
    if (url === "/api/design/validate" && method === "POST") {
      const body = JSON.parse(String(init?.body)) as { items: DesignItem[] }
      return reply(calculate(body.items))
    }
    if (url === "/api/designs" && method === "POST") {
      const body = JSON.parse(String(init?.body)) as {
        name: string
        items: DesignItem[]
      }
      const created = detail(nextId, body.name, body.items)
      nextId += 1
      designs = [created, ...designs]
      return reply(created, 201)
    }

    const match = url.match(/^\/api\/designs\/(\d+)$/)
    if (match) {
      const id = Number(match[1])
      const existing = designs.find((design) => design.id === id)
      if (!existing) return reply({ detail: { message: "Missing" } }, 404)
      if (method === "PUT") {
        const body = JSON.parse(String(init?.body)) as {
          name: string
          items: DesignItem[]
        }
        const updated = detail(id, body.name, body.items, "2026-11-14T11:45:00Z")
        designs = designs.map((design) => (design.id === id ? updated : design))
        return reply(updated)
      }
      return reply(existing)
    }

    return reply({ detail: { message: `Unhandled ${method} ${url}` } }, 500)
  })
  vi.stubGlobal("fetch", fetchMock)
}

function renderDesigner() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  render(
    <QueryClientProvider client={client}>
      <Designer />
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

describe("Designer persistence flow", () => {
  it("creates a new design and posts the selected manifest", async () => {
    renderDesigner()

    const nameInput = (await screen.findByLabelText("Design name")) as HTMLInputElement
    await waitFor(() => expect(nameInput.value).toBe("EarthWatch-01 Design 1"))

    fireEvent.click(
      within(screen.getByLabelText("Component library")).getByRole("button", {
        name: /power/i,
      }),
    )
    fireEvent.click(screen.getByRole("button", { name: "Add Deployable Solar Array" }))

    await screen.findByRole("button", { name: "Remove Deployable Solar Array" })

    fireEvent.click(screen.getByRole("button", { name: "SAVE DESIGN" }))

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "UPDATE DESIGN" })).toBeTruthy(),
    )

    const postCall = fetchMock.mock.calls.find(
      ([url, init]) => String(url) === "/api/designs" && init?.method === "POST",
    )
    expect(postCall).toBeTruthy()
    const body = JSON.parse(String(postCall?.[1]?.body)) as {
      mission_slug: string
      name: string
      items: DesignItem[]
    }
    expect(body).toEqual({
      mission_slug: "earthwatch-01",
      name: "EarthWatch-01 Design 1",
      items: [{ component_id: 4, quantity: 1 }],
    })
    expect(screen.getByText(/SAVED 14 NOV 2026/)).toBeTruthy()
  })

  it("loads a saved design and updates its quantities", async () => {
    const saved = detail(7, "Saved Baseline", [{ component_id: 1, quantity: 2 }])
    designs = [saved]

    renderDesigner()

    await screen.findByLabelText("Design name")
    await waitFor(() =>
      expect((screen.getByLabelText("Design name") as HTMLInputElement).value).toBe(
        "Saved Baseline",
      ),
    )
    await screen.findByRole("button", { name: "Remove 3U Primary Structure" })

    fireEvent.click(
      screen.getByRole("button", { name: "Increase 3U Primary Structure quantity" }),
    )
    fireEvent.click(screen.getByRole("button", { name: "UPDATE DESIGN" }))

    await waitFor(() => {
      const putCall = fetchMock.mock.calls.find(
        ([url, init]) => String(url) === "/api/designs/7" && init?.method === "PUT",
      )
      expect(putCall).toBeTruthy()
      const body = JSON.parse(String(putCall?.[1]?.body)) as {
        name: string
        items: DesignItem[]
      }
      expect(body).toEqual({
        name: "Saved Baseline",
        items: [{ component_id: 1, quantity: 3 }],
      })
    })
  })
})

import { describe, expect, it } from "vitest"

import type { DesignValidation } from "./design"
import { COMPONENT_CATEGORIES } from "./design"
import {
  CATEGORY_META,
  addComponent,
  categoryCoverage,
  formatSignedPower,
  formatStamp,
  makeDesignName,
  normalizeItems,
  quantityOf,
  removeComponent,
  setComponentQuantity,
  totalUnits,
  usageTone,
} from "./designer"

function validationWithQuantities(quantities: Partial<Record<string, number>>): DesignValidation {
  return {
    mission_slug: "earthwatch-01",
    mission_name: "EarthWatch-01",
    totals: {
      mass_kg: 0,
      power_consumption_w: 0,
      power_generation_w: 0,
      power_margin_w: 0,
      cost_usd: 0,
      cost_currency: "USD",
      component_count: 0,
      total_quantity: 0,
    },
    budgets: {
      mass_remaining_kg: 8,
      mass_limit_kg: 8,
      mass_used_pct: 0,
      cost_remaining_usd: 500000,
      cost_limit_usd: 500000,
      cost_used_pct: 0,
      min_power_margin_w: 5,
      power_surplus_w: -5,
    },
    categories: COMPONENT_CATEGORIES.map((category) => ({
      category,
      quantity: quantities[category] ?? 0,
      mass_kg: 0,
      power_consumption_w: 0,
      power_generation_w: 0,
      cost_usd: 0,
    })),
    valid: false,
    violations: [],
  }
}

describe("designer item operations", () => {
  it("adds a new component and increments an existing one", () => {
    const once = addComponent([], 7)
    expect(once).toEqual([{ component_id: 7, quantity: 1 }])

    const twice = addComponent(once, 7)
    expect(twice).toEqual([{ component_id: 7, quantity: 2 }])
    expect(quantityOf(twice, 7)).toBe(2)
  })

  it("keeps items ordered by component id", () => {
    const items = addComponent(addComponent([], 9), 3)
    expect(items.map((item) => item.component_id)).toEqual([3, 9])
  })

  it("changes quantity and removes an item at zero", () => {
    const items = [{ component_id: 4, quantity: 3 }]
    expect(setComponentQuantity(items, 4, 5)).toEqual([{ component_id: 4, quantity: 5 }])
    expect(quantityOf(setComponentQuantity(items, 4, 0), 4)).toBe(0)
    expect(removeComponent(items, 4)).toEqual([])
  })

  it("clamps quantities to the backend limit", () => {
    expect(setComponentQuantity([{ component_id: 4, quantity: 99 }], 4, 250)).toEqual([
      { component_id: 4, quantity: 100 },
    ])
    expect(addComponent([{ component_id: 4, quantity: 100 }], 4)).toEqual([
      { component_id: 4, quantity: 100 },
    ])
  })

  it("normalizes saved records by merging duplicate ids", () => {
    const normalized = normalizeItems([
      { component_id: 5, quantity: 2 },
      { component_id: 2, quantity: 1 },
      { component_id: 5, quantity: 3 },
    ])
    expect(normalized).toEqual([
      { component_id: 2, quantity: 1 },
      { component_id: 5, quantity: 5 },
    ])
    expect(totalUnits(normalized)).toBe(6)
  })
})

describe("required subsystem coverage", () => {
  it("reports missing and covered categories", () => {
    const validation = validationWithQuantities({
      structure: 1,
      power: 2,
      payload: 1,
    })
    const coverage = categoryCoverage(validation, [
      "structure",
      "power",
      "payload",
      "thermal_control",
    ])

    expect(coverage.total).toBe(4)
    expect(coverage.covered).toBe(3)
    expect(coverage.missing).toEqual(["thermal_control"])
  })

  it("reports the full requirement when the engine has not answered yet", () => {
    const coverage = categoryCoverage(undefined, ["structure", "payload"])
    expect(coverage).toEqual({ covered: 0, total: 2, missing: ["structure", "payload"] })
  })
})

describe("designer presentation helpers", () => {
  it("defines metadata for all seven categories", () => {
    expect(Object.keys(CATEGORY_META)).toHaveLength(7)
    for (const category of COMPONENT_CATEGORIES) {
      expect(CATEGORY_META[category].label.length).toBeGreaterThan(0)
      expect(CATEGORY_META[category].hex).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })

  it("generates the next available design name", () => {
    expect(makeDesignName("EarthWatch-01", [])).toBe("EarthWatch-01 Design 1")
    expect(makeDesignName("EarthWatch-01", ["EarthWatch-01 Design 1"])).toBe(
      "EarthWatch-01 Design 2",
    )
    expect(
      makeDesignName("EarthWatch-01", [
        "EarthWatch-01 Design 1",
        "EarthWatch-01 Design 2",
      ]),
    ).toBe("EarthWatch-01 Design 3")
  })

  it("formats UTC timestamps and signed power", () => {
    expect(formatStamp("2026-11-14T16:22:31+00:00")).toBe("14 NOV 2026 · 16:22 UTC")
    expect(formatStamp(null)).toBe("—")
    expect(formatSignedPower(13.5)).toBe("+13.5 W")
    expect(formatSignedPower(-4)).toBe("-4.0 W")
  })

  it("classifies budget usage thresholds", () => {
    expect(usageTone(50)).toBe("nominal")
    expect(usageTone(80)).toBe("caution")
    expect(usageTone(101)).toBe("over")
  })
})

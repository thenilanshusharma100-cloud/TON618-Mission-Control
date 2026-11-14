import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import type {
  Component,
  DesignBudgets,
  DesignItem,
  DesignTotals,
} from "../../lib/design"
import { Manifest } from "./Manifest"

afterEach(() => {
  cleanup()
})

const structure: Component = {
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
}

const totals: DesignTotals = {
  mass_kg: 1.2,
  power_consumption_w: 0,
  power_generation_w: 0,
  power_margin_w: 0,
  cost_usd: 45000,
  cost_currency: "USD",
  component_count: 1,
  total_quantity: 2,
}

const budgets: DesignBudgets = {
  mass_remaining_kg: 6.8,
  mass_limit_kg: 8,
  mass_used_pct: 15,
  cost_remaining_usd: 455000,
  cost_limit_usd: 500000,
  cost_used_pct: 9,
  min_power_margin_w: 5,
  power_surplus_w: -5,
}

function renderManifest(
  items: DesignItem[] = [{ component_id: 1, quantity: 2 }],
  overrides: Partial<Parameters<typeof Manifest>[0]> = {},
) {
  const onQuantity = vi.fn()
  const onRemove = vi.fn()
  render(
    <Manifest
      items={items}
      componentsById={new Map([[1, structure]])}
      totals={totals}
      budgets={budgets}
      onQuantity={onQuantity}
      onRemove={onRemove}
      {...overrides}
    />,
  )
  return { onQuantity, onRemove }
}

describe("Manifest", () => {
  it("increments and decrements a component quantity", () => {
    const { onQuantity } = renderManifest()

    fireEvent.click(
      screen.getByRole("button", { name: "Increase 3U Primary Structure quantity" }),
    )
    expect(onQuantity).toHaveBeenCalledWith(1, 3)

    fireEvent.click(
      screen.getByRole("button", { name: "Decrease 3U Primary Structure quantity" }),
    )
    expect(onQuantity).toHaveBeenCalledWith(1, 1)
  })

  it("disables decrement at one unit", () => {
    renderManifest([{ component_id: 1, quantity: 1 }])

    const decrease = screen.getByRole("button", {
      name: "Decrease 3U Primary Structure quantity",
    })
    expect(decrease.hasAttribute("disabled")).toBe(true)
  })

  it("removes a component from the manifest", () => {
    const { onRemove } = renderManifest()

    fireEvent.click(screen.getByRole("button", { name: "Remove 3U Primary Structure" }))
    expect(onRemove).toHaveBeenCalledWith(1)
  })

  it("shows an instructive empty state", () => {
    renderManifest([])

    expect(screen.getByText("No components installed.")).toBeTruthy()
    expect(screen.getByText(/educational estimates/i)).toBeTruthy()
  })
})

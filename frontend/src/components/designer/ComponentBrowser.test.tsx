import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import type { Component } from "../../lib/design"
import { ComponentBrowser } from "./ComponentBrowser"

afterEach(() => {
  cleanup()
})

const components: Component[] = [
  {
    id: 1,
    slug: "structure-3u-frame",
    name: "3U Primary Structure",
    description: "Aluminium frame, rails and fasteners for a 3U-form-factor spacecraft bus.",
    category: "structure",
    mass_kg: 1.2,
    power_w: 0,
    power_role: "consumer",
    cost_usd: 45000,
    cost_currency: "USD",
    data_classification: "estimated",
    rationale: "Educational estimate for a 3U educational satellite structure.",
    source: null,
  },
  {
    id: 4,
    slug: "power-deployable-array",
    name: "Deployable Solar Array",
    description: "Two deployable panels with higher generation at the cost of mass.",
    category: "power",
    mass_kg: 1.4,
    power_w: 28,
    power_role: "generator",
    cost_usd: 65000,
    cost_currency: "USD",
    data_classification: "estimated",
    rationale: "Educational estimate of beginning-of-life orbit-average generation.",
    source: null,
  },
]

function browserProps(overrides: Partial<Parameters<typeof ComponentBrowser>[0]> = {}) {
  return {
    components,
    requiredCategories: ["structure", "power"],
    items: [{ component_id: 1, quantity: 1 }],
    onAdd: vi.fn(),
    onSelectCategory: vi.fn(),
    selectedCategory: "structure" as const,
    ...overrides,
  }
}

describe("ComponentBrowser", () => {
  it("selects a category from the sidebar", () => {
    const onSelectCategory = vi.fn()
    render(
      <ComponentBrowser
        {...browserProps()}
        selectedCategory="structure"
        onSelectCategory={onSelectCategory}
      />,
    )

    fireEvent.click(screen.getByRole("button", { name: /power/i }))
    expect(onSelectCategory).toHaveBeenCalledWith("power")
  })

  it("lists the selected category and adds a component", () => {
    const onAdd = vi.fn()
    render(
      <ComponentBrowser {...browserProps()} selectedCategory="power" onAdd={onAdd} />,
    )

    expect(screen.queryByText("3U Primary Structure")).toBeNull()
    expect(screen.getByText("Deployable Solar Array")).toBeTruthy()
    expect(screen.getByText("+28.0 W")).toBeTruthy()

    fireEvent.click(screen.getByRole("button", { name: "Add Deployable Solar Array" }))
    expect(onAdd).toHaveBeenCalledWith(4)
  })

  it("reveals specifications and the estimate rationale", () => {
    render(<ComponentBrowser {...browserProps()} selectedCategory="structure" />)

    expect(screen.queryByText(/Aluminium frame/)).toBeNull()
    fireEvent.click(
      screen.getByRole("button", { name: "Specifications for 3U Primary Structure" }),
    )

    expect(screen.getByText(/Aluminium frame/)).toBeTruthy()
    expect(screen.getByText(/ESTIMATE RATIONALE/)).toBeTruthy()
  })

  it("shows installed quantities and disables add at the limit", () => {
    render(
      <ComponentBrowser
        {...browserProps()}
        selectedCategory="structure"
        items={[{ component_id: 1, quantity: 100 }]}
      />,
    )

    expect(screen.getByText("100")).toBeTruthy()
    const addButton = screen.getByRole("button", { name: "Add 3U Primary Structure" })
    expect(addButton.hasAttribute("disabled")).toBe(true)
  })
})

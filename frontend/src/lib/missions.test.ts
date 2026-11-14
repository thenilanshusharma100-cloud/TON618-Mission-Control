import { describe, expect, it } from "vitest"

import { formatMass, formatPower, formatUsd } from "./missions"

describe("catalog display formatting", () => {
  it("formats whole-dollar costs without decimals", () => {
    expect(formatUsd(332000)).toBe("$332,000")
    expect(formatUsd(0)).toBe("$0")
  })

  it("formats mass in kilograms with one decimal", () => {
    expect(formatMass(5.7)).toBe("5.7 kg")
    expect(formatMass(8)).toBe("8.0 kg")
  })

  it("formats power in watts with one decimal", () => {
    expect(formatPower(13.5)).toBe("13.5 W")
    expect(formatPower(28)).toBe("28.0 W")
  })
})

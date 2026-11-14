import { describe, expect, it } from "vitest"

import {
  DEFAULT_ALTITUDE_KM,
  clampAltitude,
  clampInclination,
  formatAngle,
  formatEpoch,
  formatKilometres,
  formatPeriod,
  formatPrecession,
  formatScientific,
  formatVelocity,
  orbitRadiusScale,
} from "./orbit"

describe("orbit input domain", () => {
  it("clamps altitude to the planner envelope", () => {
    expect(clampAltitude(50)).toBe(160)
    expect(clampAltitude(2500)).toBe(2000)
    expect(clampAltitude(550)).toBe(550)
    expect(clampAltitude(Number.NaN)).toBe(DEFAULT_ALTITUDE_KM)
  })

  it("clamps inclination to 0–180 degrees", () => {
    expect(clampInclination(-1)).toBe(0)
    expect(clampInclination(181)).toBe(180)
    expect(clampInclination(97.6)).toBe(97.6)
    expect(clampInclination(Number.NaN)).toBe(0)
  })

  it("computes the orbit-to-Earth visual scale", () => {
    expect(orbitRadiusScale(6_928_100, 6_378_100)).toBeCloseTo(1.0862326, 6)
    expect(orbitRadiusScale(Number.NaN, 6_378_100)).toBe(1)
    expect(orbitRadiusScale(6_928_100, 0)).toBe(1)
  })
})

describe("orbit display formatting", () => {
  it("formats radius and velocity", () => {
    expect(formatKilometres(6_928_100)).toBe("6,928.1 km")
    expect(formatVelocity(7585.1088)).toBe("7585.1 m/s")
  })

  it("formats the orbital period in hours, minutes and seconds", () => {
    expect(formatPeriod(5738.9468)).toBe("1 h 35 m 39 s")
    expect(formatPeriod(5400)).toBe("1 h 30 m 00 s")
    expect(formatPeriod(0)).toBe("—")
  })

  it("formats values in scientific notation with superscripts", () => {
    expect(formatScientific(-28_766_937.674)).toBe("-2.877 × 10⁷")
    expect(formatScientific(52_550_392_204.38)).toBe("5.255 × 10¹⁰")
    expect(formatScientific(0)).toBe("0")
    expect(formatScientific(Number.NaN)).toBe("—")
  })

  it("formats J2 precession in degrees per day", () => {
    expect(formatPrecession(1.991063797294792e-7)).toBe("+0.9856 °/day")
    expect(formatPrecession(-1.5069e-6)).toBe("-7.4597 °/day")
  })

  it("formats angles and epochs", () => {
    expect(formatAngle(97.592877, 2)).toBe("97.59°")
    expect(formatAngle(97.592877, 3)).toBe("97.593°")
    expect(formatEpoch("2026-11-14T11:30:00Z")).toBe("14 NOV 2026 · 11:30 UTC")
    expect(formatEpoch(null)).toBe("—")
  })
})

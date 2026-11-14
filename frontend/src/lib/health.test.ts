import { describe, expect, it } from "vitest"

import { linkLabel, linkState, type HealthPayload } from "./health"

const nominal: HealthPayload = {
  status: "ok",
  version: "0.1.0",
  database: "ok",
  units: "SI (pint)",
}

describe("linkState", () => {
  it("reports syncing before the first response", () => {
    expect(linkState(undefined, false)).toBe("syncing")
  })

  it("reports online for a nominal payload", () => {
    expect(linkState(nominal, false)).toBe("online")
  })

  it("reports degraded when the API is up but unhealthy", () => {
    expect(linkState({ ...nominal, status: "degraded", database: "error" }, false)).toBe("degraded")
  })

  it("reports offline on request failure", () => {
    expect(linkState(undefined, true)).toBe("offline")
  })
})

describe("linkLabel", () => {
  it("maps every state to a label", () => {
    expect(linkLabel("online")).toBe("LINK NOMINAL")
    expect(linkLabel("degraded")).toBe("LINK DEGRADED")
    expect(linkLabel("offline")).toBe("LINK LOST")
    expect(linkLabel("syncing")).toBe("ACQUIRING")
  })
})

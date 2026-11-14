export type HealthPayload = {
  status: "ok" | "degraded"
  version: string
  database: "ok" | "error"
  units: string
}

export type LinkState = "syncing" | "online" | "degraded" | "offline"

export function linkState(health: HealthPayload | undefined, hasError: boolean): LinkState {
  if (hasError) return "offline"
  if (!health) return "syncing"
  return health.status === "ok" ? "online" : "degraded"
}

export function linkLabel(state: LinkState): string {
  switch (state) {
    case "online":
      return "LINK NOMINAL"
    case "degraded":
      return "LINK DEGRADED"
    case "offline":
      return "LINK LOST"
    default:
      return "ACQUIRING"
  }
}

export type SimulationScoreBreakdown = {
  orbit_achievement: number
  power_management: number
  mass_management: number
  communication: number
  payload_performance: number
  budget_management: number
}

export type MissionTimelinePoint = {
  elapsed_s: number
  mission_phase: string
  epoch_utc: string
  latitude_deg: number | null
  longitude_deg: number | null
  latitude_rad: number | null
  longitude_rad: number | null
  power_status: string
  comm_status: string
  payload_status: string
}

export type SimulationRun = {
  run_id: string
  started_at: string
  completed_at: string | null
  design_id: number
  design_name: string
  mission_slug: string
  altitude_km: number
  inclination_deg: number
  required_sso_inclination_deg: number
  orbital_period_s: number
  orbits_completed: number
  orbit_elapsed_s: number
  total_mass_kg: number
  mass_limit_kg: number
  total_cost_usd: number
  cost_limit_usd: number
  cost_remaining_usd: number
  cost_used_pct: number
  power_generation_w: number
  power_consumption_w: number
  net_power_w: number
  min_power_margin_w: number
  battery_energy_full_wh: number
  battery_energy_remaining_wh: number
  battery_state_of_charge_pct: number
  battery_min_state_of_charge_pct: number
  power_balance_status: "positive" | "negative" | "zero"
  coverage_pct: number
  required_categories: number
  present_categories: number
  missing_categories: string[]
  comm_contact_sessions: number
  comm_contact_fraction: number
  raw_score: number
  score_breakdown: SimulationScoreBreakdown
  mission_status: "success" | "partial" | "failure"
  warnings: string[]
  recommendations: string[]
  violation_codes: string[]
  timeline: MissionTimelinePoint[]
  assumptions: string[]
}

export type MissionReadiness = {
  valid: boolean
  mission_status: "success" | "partial" | "failure"
  warnings: string[]
  recommendations: string[]
  total_mass_kg: number
  mass_limit_kg: number
  total_cost_usd: number
  cost_limit_usd: number
  cost_used_pct: number
  net_power_w: number
  min_power_margin_w: number
  battery_min_state_of_charge_pct: number
  coverage_pct: number
  required_categories: number
  present_categories: number
  missing_categories: string[]
  violation_codes: string[]
}

export type SimulationResponse = {
  run: SimulationRun
  raw_score: number
  score_breakdown: SimulationScoreBreakdown
  readiness: MissionReadiness
}

export type SimulationRequest = {
  design_id: number
  mission_slug: string
  design_data: {
    altitude_km: number
    inclination_deg: number
  }
}

export const SIMULATION_SCORE_MAX: SimulationScoreBreakdown = {
  orbit_achievement: 25,
  power_management: 20,
  mass_management: 15,
  communication: 15,
  payload_performance: 15,
  budget_management: 10,
}

export function missionStatusLabel(status: SimulationRun["mission_status"]): string {
  if (status === "success") return "Success"
  if (status === "partial") return "Partial"
  return "Failure"
}

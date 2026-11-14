export const COMPONENT_CATEGORIES = [
  "structure",
  "power",
  "communication",
  "onboard_computer",
  "payload",
  "propulsion",
  "thermal_control",
] as const

export type ComponentCategory = (typeof COMPONENT_CATEGORIES)[number]

export type PowerRole = "consumer" | "generator"

export type ComponentSource = {
  id: number
  key: string
  title: string
  publisher: string
  url: string
  retrieved_on: string
  kind: string
}

export type Component = {
  id: number
  slug: string
  name: string
  description: string
  category: ComponentCategory
  mass_kg: number
  power_w: number
  power_role: PowerRole
  cost_usd: number
  cost_currency: "USD"
  data_classification: "estimated" | "published_reference"
  rationale: string
  source: ComponentSource | null
}

export type DesignItem = {
  component_id: number
  quantity: number
}

export type DesignTotals = {
  mass_kg: number
  power_consumption_w: number
  power_generation_w: number
  power_margin_w: number
  cost_usd: number
  cost_currency: "USD"
  component_count: number
  total_quantity: number
}

export type DesignBudgets = {
  mass_remaining_kg: number
  mass_limit_kg: number
  mass_used_pct: number
  cost_remaining_usd: number
  cost_limit_usd: number
  cost_used_pct: number
  min_power_margin_w: number
  power_surplus_w: number
}

export type CategoryBreakdown = {
  category: ComponentCategory
  quantity: number
  mass_kg: number
  power_consumption_w: number
  power_generation_w: number
  cost_usd: number
}

export type Violation = {
  code: string
  severity: "error" | "warning"
  message: string
}

export type DesignValidation = {
  mission_slug: string
  mission_name: string
  totals: DesignTotals
  budgets: DesignBudgets
  categories: CategoryBreakdown[]
  valid: boolean
  violations: Violation[]
}

export type DesignDetail = DesignValidation & {
  id: number
  mission_id: number
  name: string
  items: DesignItem[]
  created_at: string
  updated_at: string
}

export type DesignSavePayload = {
  name: string
  items: DesignItem[]
}

export type DesignCreatePayload = DesignSavePayload & {
  mission_slug: string
}

export type Mission = {
  id: number
  slug: string
  name: string
  summary: string
  briefing: string
  difficulty: string
  max_mass_kg: number
  max_cost_usd: number
  min_power_margin_w: number
  required_categories: string[]
  budget_rationale: string
}

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
})

export function formatUsd(amount: number): string {
  return usd.format(amount)
}

export function formatMass(kg: number): string {
  return `${kg.toFixed(1)} kg`
}

export function formatPower(watts: number): string {
  return `${watts.toFixed(1)} W`
}

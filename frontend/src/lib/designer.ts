import {
  COMPONENT_CATEGORIES,
  type ComponentCategory,
  type DesignItem,
  type DesignValidation,
} from "./design"

export const MAX_COMPONENT_QUANTITY = 100

export type CategoryMeta = {
  label: string
  short: string
  hex: string
  description: string
}

export const CATEGORY_META: Record<ComponentCategory, CategoryMeta> = {
  structure: {
    label: "Structure",
    short: "STR",
    hex: "#38e8c6",
    description: "Frames, rails and load paths",
  },
  power: {
    label: "Power",
    short: "PWR",
    hex: "#ffb547",
    description: "Generation, storage and distribution",
  },
  communication: {
    label: "Communication",
    short: "COM",
    hex: "#62a8ff",
    description: "Telemetry and data downlink",
  },
  onboard_computer: {
    label: "Onboard Computer",
    short: "OBC",
    hex: "#a78bfa",
    description: "Command, data handling and interfaces",
  },
  payload: {
    label: "Payload",
    short: "PLD",
    hex: "#ff7a3d",
    description: "Mission instruments and sensors",
  },
  propulsion: {
    label: "Propulsion",
    short: "PRP",
    hex: "#ff6b8a",
    description: "Attitude and orbit adjustment",
  },
  thermal_control: {
    label: "Thermal Control",
    short: "THM",
    hex: "#8fd3e8",
    description: "Insulation, radiators and heaters",
  },
}

export function categoryLabel(category: ComponentCategory): string {
  return CATEGORY_META[category].label
}

export function addComponent(items: DesignItem[], componentId: number): DesignItem[] {
  const existing = items.find((item) => item.component_id === componentId)
  if (!existing) {
    return [...items, { component_id: componentId, quantity: 1 }].sort(
      (a, b) => a.component_id - b.component_id,
    )
  }
  return setComponentQuantity(items, componentId, existing.quantity + 1)
}

export function setComponentQuantity(
  items: DesignItem[],
  componentId: number,
  quantity: number,
): DesignItem[] {
  if (!Number.isFinite(quantity)) return items
  const next = Math.min(Math.floor(quantity), MAX_COMPONENT_QUANTITY)
  if (next <= 0) return removeComponent(items, componentId)
  return items
    .map((item) =>
      item.component_id === componentId ? { ...item, quantity: next } : item,
    )
    .sort((a, b) => a.component_id - b.component_id)
}

export function removeComponent(items: DesignItem[], componentId: number): DesignItem[] {
  return items.filter((item) => item.component_id !== componentId)
}

export function quantityOf(items: DesignItem[], componentId: number): number {
  return items.find((item) => item.component_id === componentId)?.quantity ?? 0
}

export function totalUnits(items: DesignItem[]): number {
  return items.reduce((sum, item) => sum + item.quantity, 0)
}

/** Merge duplicate ids sourced from a saved record before editing. */
export function normalizeItems(items: DesignItem[]): DesignItem[] {
  const merged = new Map<number, number>()
  for (const item of items) {
    merged.set(item.component_id, (merged.get(item.component_id) ?? 0) + item.quantity)
  }
  return [...merged.entries()]
    .map(([component_id, quantity]) => ({
      component_id,
      quantity: Math.min(quantity, MAX_COMPONENT_QUANTITY),
    }))
    .sort((a, b) => a.component_id - b.component_id)
}

export type Coverage = {
  covered: number
  total: number
  missing: ComponentCategory[]
}

export function categoryCoverage(
  validation: DesignValidation | undefined,
  requiredCategories: string[],
): Coverage {
  const required = COMPONENT_CATEGORIES.filter((category) =>
    requiredCategories.includes(category),
  )
  if (!validation) {
    return { covered: 0, total: required.length, missing: required }
  }
  const present = new Set(
    validation.categories
      .filter((category) => category.quantity > 0)
      .map((category) => category.category),
  )
  const missing = required.filter((category) => !present.has(category))
  return { covered: required.length - missing.length, total: required.length, missing }
}

export function makeDesignName(missionName: string, existingNames: string[]): string {
  const taken = new Set(existingNames)
  let index = 1
  while (taken.has(`${missionName} Design ${index}`)) {
    index += 1
  }
  return `${missionName} Design ${index}`
}

const MONTHS = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
]

export function formatStamp(value: string | null | undefined): string {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  const pad = (part: number) => String(part).padStart(2, "0")
  return `${pad(date.getUTCDate())} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()} · ${pad(
    date.getUTCHours(),
  )}:${pad(date.getUTCMinutes())} UTC`
}

export function formatSignedPower(watts: number): string {
  return `${watts >= 0 ? "+" : ""}${watts.toFixed(1)} W`
}

export function usageTone(percent: number): "nominal" | "caution" | "over" {
  if (percent > 100) return "over"
  if (percent >= 80) return "caution"
  return "nominal"
}

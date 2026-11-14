import { useState } from "react"

import type { Component, ComponentCategory, DesignItem } from "../../lib/design"
import {
  MAX_COMPONENT_QUANTITY,
  CATEGORY_META,
  categoryLabel,
  quantityOf,
} from "../../lib/designer"
import { COMPONENT_CATEGORIES } from "../../lib/design"

type ComponentBrowserProps = {
  components: Component[]
  selectedCategory: ComponentCategory
  requiredCategories: string[]
  items: DesignItem[]
  onSelectCategory: (category: ComponentCategory) => void
  onAdd: (componentId: number) => void
}

function powerLabel(component: Component): string {
  const sign = component.power_role === "generator" ? "+" : "−"
  return `${sign}${component.power_w.toFixed(1)} W`
}

export function ComponentBrowser({
  components,
  selectedCategory,
  requiredCategories,
  items,
  onSelectCategory,
  onAdd,
}: ComponentBrowserProps) {
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const selected = components.filter((component) => component.category === selectedCategory)
  const meta = CATEGORY_META[selectedCategory]

  return (
    <aside className="flex min-h-0 flex-col border border-edge bg-panel" aria-label="Component library">
      <div className="border-b border-edge px-4 py-3">
        <p className="text-[10px] tracking-[0.3em] text-muted">COMPONENT LIBRARY</p>
        <p className="mt-1 text-[10px] text-muted/70">
          {components.length} ESTIMATED ARTICLES · 7 SUBSYSTEMS
        </p>
      </div>

      <div className="grid grid-cols-2 gap-1 border-b border-edge p-2 xl:grid-cols-1">
        {COMPONENT_CATEGORIES.map((category) => {
          const categoryMeta = CATEGORY_META[category]
          const isActive = category === selectedCategory
          const isRequired = requiredCategories.includes(category)
          const installed = items.reduce((sum, item) => {
            const component = components.find((candidate) => candidate.id === item.component_id)
            return component?.category === category ? sum + item.quantity : sum
          }, 0)
          return (
            <button
              key={category}
              type="button"
              aria-pressed={isActive}
              onClick={() => onSelectCategory(category)}
              className={`flex items-center gap-2 border px-2 py-2 text-left transition-colors ${
                isActive
                  ? "border-signal/60 bg-signal/10 text-signal"
                  : "border-transparent text-muted hover:border-edge hover:bg-panel-2 hover:text-ink"
              }`}
            >
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: categoryMeta.hex }}
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1 truncate text-[10px] tracking-[0.16em]">
                {categoryLabel(category).toUpperCase()}
              </span>
              {isRequired ? (
                <span className="text-[8px] tracking-[0.1em] text-amber">REQ</span>
              ) : null}
              {installed > 0 ? (
                <span className="border border-signal/40 px-1 text-[9px] text-signal">
                  {installed}
                </span>
              ) : null}
            </button>
          )
        })}
      </div>

      <div className="flex items-baseline justify-between gap-2 px-4 pt-3">
        <p className="text-[10px] tracking-[0.24em]" style={{ color: meta.hex }}>
          {meta.label.toUpperCase()}
        </p>
        <p className="text-[9px] text-muted">{selected.length} ARTICLES</p>
      </div>
      <p className="px-4 pt-1 text-[10px] text-muted/70">{meta.description}</p>

      <div className="mt-2 max-h-[520px] flex-1 space-y-2 overflow-y-auto px-2 pb-3 xl:max-h-[640px]">
        {selected.length === 0 ? (
          <p className="px-2 py-4 text-[11px] text-muted">No catalog articles in this category.</p>
        ) : (
          selected.map((component) => {
            const quantity = quantityOf(items, component.id)
            const atLimit = quantity >= MAX_COMPONENT_QUANTITY
            return (
              <article key={component.id} className="border border-edge/80 bg-panel-2 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="text-[12px] leading-snug text-ink">{component.name}</h3>
                    <p className="mt-1 text-[8px] tracking-[0.16em] text-muted">
                      ESTIMATED · USD · {component.power_role.toUpperCase()}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onAdd(component.id)}
                    disabled={atLimit}
                    aria-label={`Add ${component.name}`}
                    title={atLimit ? "Quantity limit reached" : `Add ${component.name}`}
                    className="grid h-7 w-7 shrink-0 place-items-center border border-signal/50 text-sm text-signal transition-colors hover:bg-signal hover:text-void disabled:cursor-not-allowed disabled:border-edge disabled:text-muted"
                  >
                    +
                  </button>
                </div>

                <dl className="mt-3 grid grid-cols-3 gap-2 text-[10px]">
                  <div>
                    <dt className="text-[8px] tracking-[0.12em] text-muted">MASS</dt>
                    <dd className="mt-0.5 text-ink">{component.mass_kg.toFixed(2)} kg</dd>
                  </div>
                  <div>
                    <dt className="text-[8px] tracking-[0.12em] text-muted">POWER</dt>
                    <dd
                      className={`mt-0.5 ${
                        component.power_role === "generator" ? "text-amber" : "text-ink"
                      }`}
                    >
                      {powerLabel(component)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[8px] tracking-[0.12em] text-muted">COST</dt>
                    <dd className="mt-0.5 text-ink">
                      ${(component.cost_usd / 1000).toFixed(0)}k
                    </dd>
                  </div>
                </dl>

                <div className="mt-2">
                  <button
                    type="button"
                    onClick={() => setExpandedId(expandedId === component.id ? null : component.id)}
                    aria-expanded={expandedId === component.id}
                    aria-label={`Specifications for ${component.name}`}
                    className="text-[9px] tracking-[0.16em] text-muted hover:text-signal"
                  >
                    {expandedId === component.id ? "▾ SPECIFICATIONS" : "▸ SPECIFICATIONS"}
                  </button>
                  {expandedId === component.id ? (
                    <div className="mt-2 border-l border-edge pl-2">
                      <p className="text-[10px] leading-relaxed text-muted">
                        {component.description}
                      </p>
                      <p className="mt-2 text-[9px] leading-relaxed text-muted/70">
                        ESTIMATE RATIONALE — {component.rationale}
                      </p>
                    </div>
                  ) : null}
                </div>
              </article>
            )
          })
        )}
      </div>
    </aside>
  )
}

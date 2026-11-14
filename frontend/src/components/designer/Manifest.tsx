import type {
  Component,
  DesignBudgets,
  DesignItem,
  DesignTotals,
} from "../../lib/design"
import { CATEGORY_META, MAX_COMPONENT_QUANTITY, usageTone } from "../../lib/designer"
import { formatUsd } from "../../lib/missions"

type ManifestProps = {
  items: DesignItem[]
  componentsById: Map<number, Component>
  totals: DesignTotals | undefined
  budgets: DesignBudgets | undefined
  onQuantity: (componentId: number, quantity: number) => void
  onRemove: (componentId: number) => void
}

type BudgetBarProps = {
  label: string
  value: string
  percent: number
  tone: "nominal" | "caution" | "over"
}

function BudgetBar({ label, value, percent, tone }: BudgetBarProps) {
  const color =
    tone === "over" ? "bg-alert" : tone === "caution" ? "bg-amber" : "bg-signal"
  const text =
    tone === "over" ? "text-alert" : tone === "caution" ? "text-amber" : "text-signal"
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[9px] tracking-[0.18em] text-muted">{label}</span>
        <span className={`text-[10px] tabular-nums ${text}`}>{value}</span>
      </div>
      <div className="mt-1 h-1 w-full bg-edge/60" aria-hidden="true">
        <div
          className={`h-full ${color} transition-[width] duration-300`}
          style={{ width: `${Math.min(Math.max(percent, 0), 100)}%` }}
        />
      </div>
    </div>
  )
}

export function Manifest({
  items,
  componentsById,
  totals,
  budgets,
  onQuantity,
  onRemove,
}: ManifestProps) {
  const loadPercent =
    totals && totals.power_generation_w > 0
      ? (totals.power_consumption_w / totals.power_generation_w) * 100
      : totals && totals.power_consumption_w > 0
        ? 100
        : 0

  return (
    <aside className="flex min-h-0 flex-col gap-3" aria-label="Design manifest">
      <section className="border border-edge bg-panel p-4">
        <p className="text-[10px] tracking-[0.3em] text-muted">MISSION BUDGETS</p>
        <div className="mt-3 space-y-3">
          <BudgetBar
            label="MASS"
            value={
              totals && budgets
                ? `${totals.mass_kg.toFixed(2)} / ${budgets.mass_limit_kg.toFixed(0)} kg`
                : "—"
            }
            percent={budgets?.mass_used_pct ?? 0}
            tone={usageTone(budgets?.mass_used_pct ?? 0)}
          />
          <BudgetBar
            label="COST"
            value={
              totals && budgets
                ? `${formatUsd(totals.cost_usd)} / ${formatUsd(budgets.cost_limit_usd)}`
                : "—"
            }
            percent={budgets?.cost_used_pct ?? 0}
            tone={usageTone(budgets?.cost_used_pct ?? 0)}
          />
          <BudgetBar
            label="LOAD / GENERATION"
            value={
              totals
                ? `${totals.power_consumption_w.toFixed(1)} / ${totals.power_generation_w.toFixed(1)} W`
                : "—"
            }
            percent={loadPercent}
            tone={usageTone(loadPercent)}
          />
        </div>
      </section>

      <section className="flex min-h-0 flex-1 flex-col border border-edge bg-panel">
        <div className="flex items-baseline justify-between gap-2 border-b border-edge px-4 py-3">
          <p className="text-[10px] tracking-[0.3em] text-muted">MANIFEST</p>
          <p className="text-[9px] text-muted">
            {totals ? `${totals.total_quantity} UNITS` : "—"}
          </p>
        </div>

        {items.length === 0 ? (
          <div className="px-4 py-6">
            <p className="text-[12px] text-ink">No components installed.</p>
            <p className="mt-2 text-[10px] leading-relaxed text-muted">
              Select hardware from the library to build the spacecraft. Every value shown here
              is calculated by the backend from the seeded catalog.
            </p>
          </div>
        ) : (
          <ul className="max-h-[560px] divide-y divide-edge/70 overflow-y-auto xl:max-h-none">
            {items.map((item) => {
              const component = componentsById.get(item.component_id)
              if (!component) {
                return (
                  <li key={item.component_id} className="px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[10px] text-alert">
                        UNKNOWN COMPONENT #{item.component_id}
                      </p>
                      <button
                        type="button"
                        onClick={() => onRemove(item.component_id)}
                        aria-label={`Remove unknown component ${item.component_id}`}
                        className="text-muted hover:text-alert"
                      >
                        ×
                      </button>
                    </div>
                  </li>
                )
              }

              const meta = CATEGORY_META[component.category]
              const lineMass = component.mass_kg * item.quantity
              const lineCost = component.cost_usd * item.quantity
              return (
                <li key={item.component_id} className="px-3 py-3">
                  <div className="flex items-start gap-2">
                    <span
                      className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ backgroundColor: meta.hex }}
                      aria-hidden="true"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] leading-snug text-ink">{component.name}</p>
                      <p className="mt-0.5 text-[8px] tracking-[0.14em] text-muted">
                        {meta.short} · {lineMass.toFixed(2)} kg · {formatUsd(lineCost)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemove(component.id)}
                      aria-label={`Remove ${component.name}`}
                      className="h-5 w-5 shrink-0 border border-edge text-[11px] leading-none text-muted transition-colors hover:border-alert/60 hover:text-alert"
                    >
                      ×
                    </button>
                  </div>

                  <div className="mt-2 flex items-center justify-between gap-2 pl-4">
                    <div className="flex items-center border border-edge">
                      <button
                        type="button"
                        onClick={() => onQuantity(component.id, item.quantity - 1)}
                        disabled={item.quantity <= 1}
                        aria-label={`Decrease ${component.name} quantity`}
                        className="grid h-6 w-6 place-items-center text-muted hover:text-ink disabled:cursor-not-allowed disabled:text-edge"
                      >
                        −
                      </button>
                      <span className="w-8 border-x border-edge text-center text-[10px] tabular-nums text-ink">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => onQuantity(component.id, item.quantity + 1)}
                        disabled={item.quantity >= MAX_COMPONENT_QUANTITY}
                        aria-label={`Increase ${component.name} quantity`}
                        className="grid h-6 w-6 place-items-center text-muted hover:text-ink disabled:cursor-not-allowed disabled:text-edge"
                      >
                        +
                      </button>
                    </div>
                    <span className="text-[8px] tracking-[0.12em] text-muted">
                      QTY {item.quantity}
                    </span>
                  </div>
                </li>
              )
            })}
          </ul>
        )}

        <div className="mt-auto border-t border-edge px-4 py-3">
          <p className="text-[9px] leading-relaxed text-muted/70">
            Catalog data are educational estimates. Mission budgets are scenario limits, not
            NASA requirements.
          </p>
        </div>
      </section>
    </aside>
  )
}

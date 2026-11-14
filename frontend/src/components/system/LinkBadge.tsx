import { useHealth } from "../../api/queries"
import { linkLabel, linkState, type LinkState } from "../../lib/health"

const dotClass: Record<LinkState, string> = {
  online: "bg-signal shadow-[0_0_10px_var(--color-signal)]",
  degraded: "bg-amber shadow-[0_0_10px_var(--color-amber)]",
  offline: "bg-alert shadow-[0_0_10px_var(--color-alert)]",
  syncing: "bg-muted",
}

const textClass: Record<LinkState, string> = {
  online: "text-signal",
  degraded: "text-amber",
  offline: "text-alert",
  syncing: "text-muted",
}

export function LinkBadge() {
  const { data, isError } = useHealth()
  const state = linkState(data, isError)

  return (
    <div
      className="flex items-center gap-2 border border-edge bg-panel-2 px-3 py-1.5"
      role="status"
      aria-live="polite"
    >
      <span className={`h-2 w-2 rounded-full ${dotClass[state]}`} aria-hidden="true" />
      <span className={`text-[11px] tracking-[0.18em] ${textClass[state]}`}>
        {linkLabel(state)}
      </span>
    </div>
  )
}

import { NavLink, Outlet } from "react-router-dom"

import { LinkBadge } from "../system/LinkBadge"
import { UtcClock } from "../system/UtcClock"

export function AppShell() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-edge bg-panel/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-6 px-6 py-4">
          <NavLink to="/" className="group flex items-baseline gap-3">
            <span className="text-xl font-bold tracking-[0.32em] text-ink transition-colors group-hover:text-signal">
              TON618
            </span>
            <span className="text-[10px] uppercase tracking-[0.42em] text-muted">
              Mission Control
            </span>
          </NavLink>
          <div className="flex items-center gap-5">
            <UtcClock />
            <LinkBadge />
          </div>
        </div>
        <nav className="mx-auto flex w-full max-w-7xl gap-1 px-6" aria-label="Primary">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `border-b-2 px-3 py-2 text-[11px] tracking-[0.24em] transition-colors ${
                isActive
                  ? "border-signal text-signal"
                  : "border-transparent text-muted hover:text-ink"
              }`
            }
          >
            DASHBOARD
          </NavLink>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-8">
        <Outlet />
      </main>

      <footer className="border-t border-edge/60">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-3 text-[10px] tracking-[0.18em] text-muted">
          <span>TON618 · MISSION CONTROL</span>
          <span>NO AUTH · LOCAL OPERATIONS</span>
        </div>
      </footer>
    </div>
  )
}

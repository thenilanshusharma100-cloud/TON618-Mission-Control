import { Link, Route, Routes } from "react-router-dom"

import { AppShell } from "./components/layout/AppShell"
import { Dashboard } from "./pages/Dashboard"

function NotFound() {
  return (
    <div className="border border-edge bg-panel p-8">
      <p className="text-[10px] tracking-[0.3em] text-muted">NAVIGATION</p>
      <h1 className="mt-3 text-2xl font-semibold">Route not found</h1>
      <p className="mt-2 text-sm text-muted">This console path is not part of the mission plan.</p>
      <Link to="/" className="mt-5 inline-block border border-signal px-4 py-2 text-xs tracking-[0.2em] text-signal">
        RETURN TO DASHBOARD
      </Link>
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Dashboard />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}

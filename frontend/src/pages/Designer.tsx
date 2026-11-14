import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useEffect, useMemo, useRef, useState } from "react"

import { postJson, putJson } from "../api/client"
import {
  useComponents,
  useDesigns,
  useDesign,
  useDesignValidation,
  useMissions,
} from "../api/queries"
import { ComponentBrowser } from "../components/designer/ComponentBrowser"
import { Manifest } from "../components/designer/Manifest"
import { SpacecraftSchematic } from "../components/designer/SpacecraftSchematic"
import type {
  ComponentCategory,
  DesignDetail,
  DesignItem,
} from "../lib/design"
import {
  CATEGORY_META,
  addComponent,
  categoryCoverage,
  formatSignedPower,
  formatStamp,
  makeDesignName,
  normalizeItems,
  removeComponent,
  setComponentQuantity,
} from "../lib/designer"
import { formatUsd } from "../lib/missions"

function MetricCard({
  label,
  value,
  detail,
  tone = "text-ink",
}: {
  label: string
  value: string
  detail: string
  tone?: string
}) {
  return (
    <div className="border border-edge bg-panel px-3 py-3">
      <p className="text-[9px] tracking-[0.22em] text-muted">{label}</p>
      <p className={`mt-2 text-lg leading-none tracking-tight tabular-nums ${tone}`}>{value}</p>
      <p className="mt-2 text-[9px] tracking-[0.08em] text-muted/80">{detail}</p>
    </div>
  )
}

export function Designer() {
  const queryClient = useQueryClient()
  const missionsQuery = useMissions()
  const mission = missionsQuery.data?.[0]

  const componentsQuery = useComponents()
  const components = useMemo(() => componentsQuery.data ?? [], [componentsQuery.data])
  const componentsById = useMemo(
    () => new Map(components.map((component) => [component.id, component])),
    [components],
  )

  const designsQuery = useDesigns(mission?.slug)
  const designs = designsQuery.data ?? []

  const [designId, setDesignId] = useState<number | null>(null)
  const [name, setName] = useState("")
  const [items, setItems] = useState<DesignItem[]>([])
  const [activeCategory, setActiveCategory] = useState<ComponentCategory>("structure")
  const [dirty, setDirty] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [initialized, setInitialized] = useState(false)
  const loadedDesignRef = useRef<number | null>(null)

  const designQuery = useDesign(designId)
  const validationQuery = useDesignValidation(mission?.slug, items)
  const validation = validationQuery.data

  useEffect(() => {
    if (initialized || !mission || !designsQuery.isSuccess) return
    const saved = designsQuery.data
    if (saved.length > 0) {
      // Hydrating editable state from the server record cannot be derived
      // during render without discarding the user's in-progress edits.
      // oxlint-disable-next-line react/set-state-in-effect
      setDesignId(saved[0].id)
      loadedDesignRef.current = null
    } else {
      setName(makeDesignName(mission.name, []))
    }
    setInitialized(true)
  }, [initialized, mission, designsQuery.isSuccess, designsQuery.data])

  useEffect(() => {
    const design = designQuery.data
    if (!design || loadedDesignRef.current === design.id) return
    loadedDesignRef.current = design.id
    setName(design.name)
    setItems(normalizeItems(design.items))
    setSavedAt(design.updated_at)
    setDirty(false)
  }, [designQuery.data])

  const saveMutation = useMutation({
    mutationFn: () => {
      const cleanName = name.trim()
      if (!mission) throw new Error("No mission is loaded.")
      return designId === null
        ? postJson<DesignDetail>("/designs", {
            mission_slug: mission.slug,
            name: cleanName,
            items,
          })
        : putJson<DesignDetail>(`/designs/${designId}`, { name: cleanName, items })
    },
    onSuccess: (design) => {
      loadedDesignRef.current = design.id
      setDesignId(design.id)
      setName(design.name)
      setItems(normalizeItems(design.items))
      setSavedAt(design.updated_at)
      setDirty(false)
      void queryClient.invalidateQueries({ queryKey: ["designs", mission?.slug] })
    },
  })

  const coverage = categoryCoverage(validation, mission?.required_categories ?? [])

  const updateItems = (updater: (current: DesignItem[]) => DesignItem[]) => {
    setItems((current) => updater(current))
    setDirty(true)
    saveMutation.reset()
  }

  const handleAdd = (componentId: number) => updateItems((current) => addComponent(current, componentId))
  const handleQuantity = (componentId: number, quantity: number) =>
    updateItems((current) => setComponentQuantity(current, componentId, quantity))
  const handleRemove = (componentId: number) =>
    updateItems((current) => removeComponent(current, componentId))

  const startNewDesign = () => {
    if (!mission) return
    if (dirty && !window.confirm("Discard unsaved changes and start a new design?")) return
    setDesignId(null)
    loadedDesignRef.current = null
    setName(makeDesignName(mission.name, designs.map((design) => design.name)))
    setItems([])
    setSavedAt(null)
    setDirty(false)
    setActiveCategory("structure")
    saveMutation.reset()
  }

  const selectDesign = (value: string) => {
    if (value === "new") {
      startNewDesign()
      return
    }
    const nextId = Number(value)
    if (nextId === designId) return
    if (dirty && !window.confirm("Discard unsaved changes and load another design?")) return
    loadedDesignRef.current = null
    setDesignId(nextId)
    setSavedAt(null)
    setDirty(false)
    saveMutation.reset()
  }

  const booting =
    missionsQuery.isLoading ||
    componentsQuery.isLoading ||
    (initialized && designId !== null && designQuery.isLoading)
  const bootError =
    missionsQuery.isError ||
    componentsQuery.isError ||
    (initialized && designId !== null && designQuery.isError)

  if (booting) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center border border-edge bg-panel">
        <div className="text-center">
          <p className="text-[10px] tracking-[0.4em] text-signal">TON618 // DESIGN CONSOLE</p>
          <p className="mt-3 text-sm text-ink">Acquiring mission catalog and design records…</p>
          <p className="mt-2 text-[10px] tracking-[0.12em] text-muted">
            COMPONENT LIBRARY · MISSION BUDGETS · ENGINEERING RULES
          </p>
        </div>
      </div>
    )
  }

  if (bootError) {
    const retry = () => {
      void missionsQuery.refetch()
      void componentsQuery.refetch()
      void designsQuery.refetch()
      if (designId !== null) void designQuery.refetch()
    }
    return (
      <div className="border border-alert/40 bg-panel p-6">
        <p className="text-[10px] tracking-[0.3em] text-alert">GROUND LINK FAULT</p>
        <h1 className="mt-3 text-xl">Design console unavailable</h1>
        <p className="mt-2 max-w-xl text-sm text-muted">
          The mission catalog or saved-design ledger did not respond. Confirm the FastAPI server is
          running on port 8000 and try again.
        </p>
        <button
          type="button"
          onClick={retry}
          className="mt-5 border border-signal px-4 py-2 text-[10px] tracking-[0.24em] text-signal hover:bg-signal hover:text-void"
        >
          RETRY CONNECTION
        </button>
      </div>
    )
  }

  if (!mission) {
    return (
      <div className="border border-edge bg-panel p-6">
        <p className="text-[10px] tracking-[0.3em] text-muted">MISSION CATALOG</p>
        <h1 className="mt-3 text-xl">No mission package loaded</h1>
        <p className="mt-2 text-sm text-muted">
          Seed the database to create the EarthWatch-01 mission, then reload this console.
        </p>
      </div>
    )
  }

  const totals = validation?.totals
  const budgets = validation?.budgets
  const marginTone =
    totals && budgets && totals.power_margin_w < budgets.min_power_margin_w
      ? "text-alert"
      : "text-signal"

  const designOptions = designs.map((design) => ({
    id: design.id,
    name: design.name,
    updated_at: design.updated_at,
  }))
  if (designId !== null && !designOptions.some((option) => option.id === designId)) {
    designOptions.unshift({ id: designId, name, updated_at: savedAt ?? "" })
  }

  const saveStatus = saveMutation.isPending
    ? { label: "SAVING DESIGN…", tone: "text-amber" }
    : designId !== null && designQuery.isFetching
      ? { label: "LOADING DESIGN RECORD…", tone: "text-amber" }
      : dirty
        ? { label: "UNSAVED CHANGES", tone: "text-amber" }
        : savedAt
          ? { label: `SAVED ${formatStamp(savedAt)}`, tone: "text-signal" }
          : { label: "NEW DRAFT · NOT SAVED", tone: "text-muted" }

  const savingDisabled =
    !name.trim() || saveMutation.isPending || (designId !== null && designQuery.isFetching)
  const requiredCategoryMeta = mission.required_categories.map(
    (category) => CATEGORY_META[category as ComponentCategory],
  )

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-edge pb-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3 text-[10px] tracking-[0.34em] text-signal">
            <span className="h-px w-8 bg-signal" aria-hidden="true" />
            MISSION DESIGN · {mission.name.toUpperCase()}
          </div>
          <input
            value={name}
            onChange={(event) => {
              setName(event.target.value)
              setDirty(true)
              saveMutation.reset()
            }}
            aria-label="Design name"
            maxLength={200}
            placeholder="Untitled design"
            className="mt-2 w-full max-w-2xl border-b border-transparent bg-transparent text-2xl font-semibold tracking-tight text-ink outline-none transition-colors placeholder:text-muted/40 focus:border-signal"
          />
          <p className={`mt-2 text-[9px] tracking-[0.18em] ${saveStatus.tone}`}>
            {saveStatus.label}
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <label className="block">
            <span className="block text-[9px] tracking-[0.2em] text-muted">DESIGN RECORD</span>
            {designs.length === 0 && designId === null ? (
              <span className="mt-1 block border border-edge bg-panel px-3 py-2 text-[10px] text-muted">
                NO SAVED DESIGNS
              </span>
            ) : (
              <select
                value={designId ?? "new"}
                onChange={(event) => selectDesign(event.target.value)}
                aria-label="Saved design"
                className="mt-1 max-w-[240px] border border-edge bg-panel px-3 py-2 text-[10px] text-ink outline-none focus:border-signal"
              >
                <option value="new">+ NEW DRAFT</option>
                {designOptions.map((design) => (
                  <option key={design.id} value={design.id}>
                    {design.name}
                  </option>
                ))}
              </select>
            )}
          </label>

          <button
            type="button"
            onClick={() => saveMutation.mutate()}
            disabled={savingDisabled}
            className="border border-signal bg-signal/10 px-4 py-2 text-[10px] tracking-[0.22em] text-signal transition-colors hover:bg-signal hover:text-void disabled:cursor-not-allowed disabled:border-edge disabled:bg-panel disabled:text-muted"
          >
            {saveMutation.isPending
              ? "SAVING…"
              : designId === null
                ? "SAVE DESIGN"
                : "UPDATE DESIGN"}
          </button>
        </div>
      </div>

      {saveMutation.isError ? (
        <div className="mt-3 border border-alert/50 bg-alert/5 px-4 py-3 text-[11px] text-alert">
          SAVE FAILED — {saveMutation.error instanceof Error ? saveMutation.error.message : "Unknown error."}
        </div>
      ) : null}

      <div className="mt-4 grid gap-4 xl:grid-cols-[290px_minmax(0,1fr)_340px]">
        <ComponentBrowser
          components={components}
          selectedCategory={activeCategory}
          requiredCategories={mission.required_categories}
          items={items}
          onSelectCategory={setActiveCategory}
          onAdd={handleAdd}
        />

        <div className="min-w-0 space-y-4">
          <SpacecraftSchematic
            mission={mission}
            components={components}
            items={items}
            validation={validation}
            requiredCategories={mission.required_categories}
            activeCategory={activeCategory}
            onSelectCategory={setActiveCategory}
          />

          <section className="grid grid-cols-2 gap-2 2xl:grid-cols-4" aria-label="Engineering metrics">
            <MetricCard
              label="TOTAL MASS"
              value={totals ? `${totals.mass_kg.toFixed(2)} kg` : "—"}
              detail={
                budgets ? `REMAINING ${budgets.mass_remaining_kg.toFixed(2)} kg` : "AWAITING ENGINE"
              }
              tone={
                budgets && budgets.mass_remaining_kg < 0 ? "text-alert" : "text-ink"
              }
            />
            <MetricCard
              label="POWER GENERATION"
              value={totals ? `${totals.power_generation_w.toFixed(1)} W` : "—"}
              detail={
                totals ? `LOAD ${totals.power_consumption_w.toFixed(1)} W` : "AWAITING ENGINE"
              }
              tone="text-amber"
            />
            <MetricCard
              label="NET POWER"
              value={totals ? formatSignedPower(totals.power_margin_w) : "—"}
              detail={
                budgets ? `REQUIRED MARGIN ${budgets.min_power_margin_w.toFixed(1)} W` : "AWAITING ENGINE"
              }
              tone={marginTone}
            />
            <MetricCard
              label="COST REMAINING"
              value={budgets ? formatUsd(budgets.cost_remaining_usd) : "—"}
              detail={budgets ? `OF ${formatUsd(budgets.cost_limit_usd)}` : "AWAITING ENGINE"}
              tone={budgets && budgets.cost_remaining_usd < 0 ? "text-alert" : "text-ink"}
            />
          </section>

          <section className="border border-edge bg-panel p-4" aria-label="Validation">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[10px] tracking-[0.3em] text-muted">FLIGHT RULES</p>
              <div className="flex items-center gap-2">
                {validationQuery.isFetching ? (
                  <span className="text-[9px] tracking-[0.16em] text-amber">RECOMPUTING…</span>
                ) : null}
                {validation ? (
                  <span
                    className={`border px-2 py-0.5 text-[9px] tracking-[0.16em] ${
                      validation.valid
                        ? "border-signal/50 bg-signal/10 text-signal"
                        : "border-alert/50 bg-alert/10 text-alert"
                    }`}
                  >
                    {validation.valid ? "ALL CHECKS PASS" : "CONFIGURATION FAULTS"}
                  </span>
                ) : (
                  <span className="text-[9px] text-muted">AWAITING ENGINE</span>
                )}
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {requiredCategoryMeta.map((meta, index) => {
                const category = mission.required_categories[index] as ComponentCategory
                const covered = !coverage.missing.includes(category)
                return (
                  <span
                    key={category}
                    className={`flex items-center gap-1.5 border px-2 py-1 text-[9px] tracking-[0.12em] ${
                      covered
                        ? "border-edge text-ink"
                        : "border-alert/50 bg-alert/5 text-alert"
                    }`}
                  >
                    <span
                      className="h-1 w-1 rounded-full"
                      style={{ backgroundColor: covered ? meta.hex : "#ff5c5c" }}
                      aria-hidden="true"
                    />
                    {meta.short} {covered ? "READY" : "MISSING"}
                  </span>
                )
              })}
              <span className="flex items-center gap-2 border border-edge px-2 py-1 text-[9px] tracking-[0.12em] text-muted">
                COVERAGE {coverage.covered}/{coverage.total}
              </span>
            </div>

            {validationQuery.isError ? (
              <p className="mt-3 border-l-2 border-alert pl-3 text-[11px] text-alert">
                ENGINEERING ENGINE UNAVAILABLE —{" "}
                {validationQuery.error instanceof Error
                  ? validationQuery.error.message
                  : "Validation request failed."}
              </p>
            ) : validation && validation.violations.length > 0 ? (
              <ul className="mt-3 space-y-2">
                {validation.violations.map((violation) => (
                  <li key={`${violation.code}-${violation.message}`} className="flex gap-3 border-l-2 border-alert/70 pl-3">
                    <span className="shrink-0 text-[9px] tracking-[0.12em] text-alert">
                      {violation.code}
                    </span>
                    <span className="text-[11px] leading-relaxed text-muted">{violation.message}</span>
                  </li>
                ))}
              </ul>
            ) : validation ? (
              <p className="mt-3 text-[11px] leading-relaxed text-muted">
                All mass, power, cost and required-subsystem checks pass. This is a design-game
                check, not a flight qualification.
              </p>
            ) : (
              <p className="mt-3 text-[11px] text-muted">
                Add components to receive engineering validation from the backend.
              </p>
            )}
          </section>
        </div>

        <Manifest
          items={items}
          componentsById={componentsById}
          totals={totals}
          budgets={budgets}
          onQuantity={handleQuantity}
          onRemove={handleRemove}
        />
      </div>
    </div>
  )
}

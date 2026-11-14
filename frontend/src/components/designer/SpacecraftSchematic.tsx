import type { KeyboardEvent } from "react"

import type {
  Component,
  ComponentCategory,
  DesignItem,
  DesignValidation,
} from "../../lib/design"
import type { Mission } from "../../lib/missions"
import { CATEGORY_META } from "../../lib/designer"
import { formatUsd } from "../../lib/missions"

type SpacecraftSchematicProps = {
  mission: Mission
  components: Component[]
  items: DesignItem[]
  validation: DesignValidation | undefined
  requiredCategories: string[]
  activeCategory: ComponentCategory
  onSelectCategory: (category: ComponentCategory) => void
}

const MUTED = "#334155"
const ALERT = "#ff5c5c"

function shortName(name: string): string {
  return name.length > 18 ? `${name.slice(0, 17)}…` : name
}

export function SpacecraftSchematic({
  mission,
  components,
  items,
  validation,
  requiredCategories,
  activeCategory,
  onSelectCategory,
}: SpacecraftSchematicProps) {
  const byCategory = new Map(
    (validation?.categories ?? []).map((category) => [category.category, category]),
  )
  const componentById = new Map(components.map((component) => [component.id, component]))

  const localQuantity = (category: ComponentCategory) =>
    items.reduce((sum, item) => {
      const component = componentById.get(item.component_id)
      return component?.category === category ? sum + item.quantity : sum
    }, 0)

  const quantity = (category: ComponentCategory) =>
    byCategory.get(category)?.quantity ?? localQuantity(category)

  const present = (category: ComponentCategory) => quantity(category) > 0
  const required = (category: ComponentCategory) => requiredCategories.includes(category)

  const categoryItems = (category: ComponentCategory) =>
    items
      .map((item) => ({ item, component: componentById.get(item.component_id) }))
      .filter(
        (entry): entry is { item: DesignItem; component: Component } =>
          entry.component?.category === category,
      )

  const generatorUnits = items.reduce((sum, item) => {
    const component = componentById.get(item.component_id)
    return component?.power_role === "generator" ? sum + item.quantity : sum
  }, 0)

  const payloads = categoryItems("payload")
  const comms = categoryItems("communication")
  const thermal = categoryItems("thermal_control")
  const propulsion = categoryItems("propulsion")

  const generation = validation?.totals.power_generation_w ?? 0
  const netPower = validation?.totals.power_margin_w ?? 0
  const mass = validation?.totals.mass_kg
  const cost = validation?.totals.cost_usd

  const interactive = (category: ComponentCategory) => ({
    role: "button" as const,
    tabIndex: 0,
    "aria-label": `Browse ${CATEGORY_META[category].label} components`,
    style: { cursor: "pointer" },
    onClick: () => onSelectCategory(category),
    onKeyDown: (event: KeyboardEvent<SVGGElement>) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault()
        onSelectCategory(category)
      }
    },
  })

  const strokeFor = (category: ComponentCategory) => {
    if (present(category)) return CATEGORY_META[category].hex
    return required(category) ? ALERT : MUTED
  }

  const activeStroke = (category: ComponentCategory) =>
    activeCategory === category ? 2.6 : 1.4

  const arrayActive = generatorUnits > 0
  const arrayColor = arrayActive ? CATEGORY_META.power.hex : required("power") ? ALERT : MUTED
  const arrayNote = arrayActive
    ? `${generation.toFixed(1)} W GENERATION`
    : present("power")
      ? "NO GENERATOR INSTALLED"
      : required("power")
        ? "POWER MISSING"
        : "OPTIONAL"

  return (
    <div className="relative border border-edge bg-[#070b12]">
      <div className="pointer-events-none absolute left-3 top-3 z-10 text-[9px] tracking-[0.24em] text-muted">
        SPACECRAFT ASSEMBLY
      </div>
      <div className="pointer-events-none absolute right-3 top-3 z-10 text-[9px] tracking-[0.2em] text-muted/70">
        SCHEMATIC · NOT TO SCALE
      </div>

      <svg
        viewBox="0 0 760 430"
        className="h-auto w-full font-mono"
        aria-label={`Interactive schematic for ${mission.name}`}
      >
        <defs>
          <pattern id="schematic-grid" width="24" height="24" patternUnits="userSpaceOnUse">
            <path d="M 24 0 L 0 0 0 24" fill="none" stroke="#101d2b" strokeWidth="1" />
          </pattern>
          <linearGradient id="array-fill" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#38e8c6" stopOpacity="0.04" />
            <stop offset="0.5" stopColor="#38e8c6" stopOpacity="0.18" />
            <stop offset="1" stopColor="#38e8c6" stopOpacity="0.04" />
          </linearGradient>
          <linearGradient id="bus-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#0f1c29" />
            <stop offset="1" stopColor="#0a111b" />
          </linearGradient>
          <filter id="module-glow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="2.6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <rect width="760" height="430" fill="#070b12" />
        <rect width="760" height="430" fill="url(#schematic-grid)" opacity="0.75" />

        <text x="20" y="62" fill="#8394a8" fontSize="8" letterSpacing="2">
          {mission.name.toUpperCase()} · FLIGHT ASSEMBLY
        </text>
        <line x1="20" y1="72" x2="740" y2="72" stroke="#1b2635" strokeWidth="1" />

        {/* Solar arrays */}
        <g {...interactive("power")}>
          <title>Browse power components</title>
          {(["left", "right"] as const).map((side) => {
            const x = side === "left" ? 70 : 520
            return (
              <g key={side}>
                <rect
                  x={x}
                  y={196}
                  width={170}
                  height={48}
                  rx="2"
                  fill={arrayActive ? "url(#array-fill)" : "#0a0f18"}
                  stroke={arrayColor}
                  strokeWidth={activeStroke("power")}
                  strokeDasharray={arrayActive ? undefined : "4 4"}
                  filter={arrayActive ? "url(#module-glow)" : undefined}
                />
                {Array.from({ length: 5 }, (_, index) => (
                  <line
                    key={index}
                    x1={x + 28 * (index + 1)}
                    y1={198}
                    x2={x + 28 * (index + 1)}
                    y2={242}
                    stroke={arrayActive ? "#38e8c6" : MUTED}
                    strokeOpacity="0.22"
                  />
                ))}
              </g>
            )
          })}
          <line x1="240" y1="220" x2="286" y2="220" stroke={arrayColor} strokeWidth="1.4" />
          <line x1="474" y1="220" x2="520" y2="220" stroke={arrayColor} strokeWidth="1.4" />
          <text x="155" y="262" textAnchor="middle" fill={arrayColor} fontSize="7.5" letterSpacing="1.4">
            SOLAR ARRAY · {arrayActive ? `${generation.toFixed(1)} W` : arrayNote}
          </text>
          <text x="605" y="262" textAnchor="middle" fill={arrayColor} fontSize="7.5" letterSpacing="1.4">
            SOLAR ARRAY
          </text>
        </g>

        {/* Structure bus */}
        <g {...interactive("structure")}>
          <title>Browse structure components</title>
          <rect
            x="286"
            y="160"
            width="188"
            height="140"
            rx="5"
            fill="url(#bus-fill)"
            stroke={strokeFor("structure")}
            strokeWidth={activeStroke("structure")}
            strokeDasharray={present("structure") ? undefined : "5 4"}
            filter={present("structure") ? "url(#module-glow)" : undefined}
          />
          {[
            [292, 166, 1, 1],
            [468, 166, -1, 1],
            [292, 294, 1, -1],
            [468, 294, -1, -1],
          ].map(([x, y, dx, dy], index) => (
            <path
              key={index}
              d={`M ${x} ${y + 10 * dy} L ${x} ${y} L ${x + 10 * dx} ${y}`}
              fill="none"
              stroke={strokeFor("structure")}
              strokeOpacity="0.55"
            />
          ))}
          <text x="380" y="181" textAnchor="middle" fill="#8394a8" fontSize="7.5" letterSpacing="1.4">
            STRUCTURE · 3U BUS
          </text>
          <text x="380" y="204" textAnchor="middle" fill="#e6edf3" fontSize="17" letterSpacing="1">
            {mass === undefined ? "—" : `${mass.toFixed(2)} kg`}
          </text>
          <text x="380" y="218" textAnchor="middle" fill="#8394a8" fontSize="6.5" letterSpacing="1.2">
            COMPUTED TOTAL MASS
          </text>
          {!present("structure") ? (
            <text x="380" y="204" textAnchor="middle" fill={ALERT} fontSize="7" letterSpacing="1.4">
              STRUCTURE MISSING
            </text>
          ) : null}
        </g>

        {/* Payload */}
        <g {...interactive("payload")}>
          <title>Browse payload components</title>
          <line
            x1="380"
            y1="136"
            x2="380"
            y2="160"
            stroke={strokeFor("payload")}
            strokeWidth="1.4"
            strokeDasharray={present("payload") ? undefined : "3 3"}
          />
          <rect
            x="312"
            y="74"
            width="136"
            height="62"
            rx="2"
            fill={present("payload") ? "#ff7a3d" : "#0a0f18"}
            fillOpacity={present("payload") ? 0.12 : 1}
            stroke={strokeFor("payload")}
            strokeWidth={activeStroke("payload")}
            strokeDasharray={present("payload") ? undefined : "4 4"}
            filter={present("payload") ? "url(#module-glow)" : undefined}
          />
          <text x="380" y="92" textAnchor="middle" fill={CATEGORY_META.payload.hex} fontSize="7.5" letterSpacing="1.4">
            PAYLOAD
          </text>
          <text x="380" y="109" textAnchor="middle" fill="#e6edf3" fontSize="8">
            {payloads.length > 0 ? shortName(payloads[0].component.name) : "EMPTY BAY"}
          </text>
          <text x="380" y="125" textAnchor="middle" fill="#8394a8" fontSize="7">
            {payloads.length > 0 ? `× ${quantity("payload")}` : required("payload") ? "MISSING" : "OPTIONAL"}
          </text>
        </g>

        {/* Communications dish */}
        <g {...interactive("communication")}>
          <title>Browse communication components</title>
          <path
            d="M 606 92 A 26 26 0 0 1 606 144"
            fill={present("communication") ? "#62a8ff" : "none"}
            fillOpacity="0.08"
            stroke={strokeFor("communication")}
            strokeWidth={activeStroke("communication")}
            strokeDasharray={present("communication") ? undefined : "3 3"}
            filter={present("communication") ? "url(#module-glow)" : undefined}
          />
          <circle
            cx="612"
            cy="118"
            r="3"
            fill={present("communication") ? "#62a8ff" : MUTED}
          />
          <line
            x1="606"
            y1="144"
            x2="606"
            y2="158"
            stroke={strokeFor("communication")}
            strokeWidth="1.4"
          />
          <line x1="590" y1="158" x2="622" y2="158" stroke={strokeFor("communication")} strokeWidth="1.4" />
          <text x="606" y="174" textAnchor="middle" fill={CATEGORY_META.communication.hex} fontSize="7.5" letterSpacing="1.3">
            COMMS
          </text>
          <text x="606" y="186" textAnchor="middle" fill="#8394a8" fontSize="7">
            {comms.length > 0 ? `× ${quantity("communication")}` : required("communication") ? "MISSING" : "OPTIONAL"}
          </text>
        </g>

        {/* Onboard computer */}
        <g {...interactive("onboard_computer")}>
          <title>Browse onboard computer components</title>
          <rect
            x="308"
            y="230"
            width="144"
            height="42"
            rx="2"
            fill={present("onboard_computer") ? "#a78bfa" : "#0a0f18"}
            fillOpacity={present("onboard_computer") ? 0.1 : 1}
            stroke={strokeFor("onboard_computer")}
            strokeWidth={activeStroke("onboard_computer")}
            strokeDasharray={present("onboard_computer") ? undefined : "4 4"}
          />
          <text x="380" y="247" textAnchor="middle" fill={CATEGORY_META.onboard_computer.hex} fontSize="7.5" letterSpacing="1.3">
            ONBOARD COMPUTER
          </text>
          <text x="380" y="262" textAnchor="middle" fill="#e6edf3" fontSize="8">
            {present("onboard_computer") ? `OBC × ${quantity("onboard_computer")}` : "NO AVIONICS"}
          </text>
        </g>

        {/* Thermal radiator */}
        <g {...interactive("thermal_control")}>
          <title>Browse thermal control components</title>
          <line
            x1="474"
            y1="274"
            x2="492"
            y2="274"
            stroke={strokeFor("thermal_control")}
            strokeWidth="1.4"
          />
          <rect
            x="492"
            y="250"
            width="46"
            height="48"
            rx="2"
            fill={present("thermal_control") ? "#8fd3e8" : "#0a0f18"}
            fillOpacity={present("thermal_control") ? 0.1 : 1}
            stroke={strokeFor("thermal_control")}
            strokeWidth={activeStroke("thermal_control")}
            strokeDasharray={present("thermal_control") ? undefined : "4 4"}
          />
          {Array.from({ length: 4 }, (_, index) => (
            <line
              key={index}
              x1="494"
              y1={260 + index * 9}
              x2="536"
              y2={260 + index * 9}
              stroke={present("thermal_control") ? "#8fd3e8" : MUTED}
              strokeOpacity="0.45"
            />
          ))}
          <text x="515" y="312" textAnchor="middle" fill={CATEGORY_META.thermal_control.hex} fontSize="7" letterSpacing="1.2">
            THERMAL
          </text>
          <text x="515" y="323" textAnchor="middle" fill="#8394a8" fontSize="7">
            {thermal.length > 0 ? `× ${quantity("thermal_control")}` : required("thermal_control") ? "MISSING" : "OPTIONAL"}
          </text>
        </g>

        {/* Propulsion */}
        <g {...interactive("propulsion")}>
          <title>Browse propulsion components</title>
          <rect x="370" y="300" width="20" height="8" fill={strokeFor("propulsion")} fillOpacity="0.5" />
          <path
            d="M 360 308 L 400 308 L 416 336 L 344 336 Z"
            fill={present("propulsion") ? "#ff6b8a" : "#0a0f18"}
            fillOpacity={present("propulsion") ? 0.14 : 1}
            stroke={strokeFor("propulsion")}
            strokeWidth={activeStroke("propulsion")}
            strokeDasharray={present("propulsion") ? undefined : "4 4"}
          />
          <text x="380" y="352" textAnchor="middle" fill={CATEGORY_META.propulsion.hex} fontSize="7" letterSpacing="1.2">
            PROPULSION
          </text>
          <text x="380" y="364" textAnchor="middle" fill="#8394a8" fontSize="7">
            {propulsion.length > 0 ? `× ${quantity("propulsion")}` : "OPTIONAL"}
          </text>
        </g>

        <line x1="20" y1="384" x2="740" y2="384" stroke="#1b2635" />
        <text x="24" y="404" fill="#8394a8" fontSize="7.5" letterSpacing="1.2">
          MASS {mass === undefined ? "—" : `${mass.toFixed(2)} KG`}
        </text>
        <text x="210" y="404" fill="#8394a8" fontSize="7.5" letterSpacing="1.2">
          NET POWER {netPower >= 0 ? "+" : ""}
          {netPower.toFixed(1)} W
        </text>
        <text x="400" y="404" fill="#8394a8" fontSize="7.5" letterSpacing="1.2">
          COST {cost === undefined ? "—" : formatUsd(cost)}
        </text>
        <text x="740" y="404" textAnchor="end" fill="#38e8c6" fontSize="7.5" letterSpacing="1.2">
          CLICK A MODULE TO BROWSE
        </text>
      </svg>
    </div>
  )
}

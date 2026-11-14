import {
  ALTITUDE_MAX_KM,
  ALTITUDE_MIN_KM,
  INCLINATION_MAX_DEG,
  INCLINATION_MIN_DEG,
  clampAltitude,
  clampInclination,
} from "../../lib/orbit"

type OrbitConfigPanelProps = {
  altitudeKm: number
  inclinationDeg: number
  requiredInclinationDeg: number | undefined
  isSunSynchronous: boolean
  onAltitude: (km: number) => void
  onInclination: (deg: number) => void
  onApplySso: () => void
}

function FieldHeader({
  label,
  value,
  unit,
}: {
  label: string
  value: string
  unit: string
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-[9px] tracking-[0.22em] text-muted">{label}</span>
      <span className="text-[10px] tabular-nums text-ink">
        {value} <span className="text-muted">{unit}</span>
      </span>
    </div>
  )
}

export function OrbitConfigPanel({
  altitudeKm,
  inclinationDeg,
  requiredInclinationDeg,
  isSunSynchronous,
  onAltitude,
  onInclination,
  onApplySso,
}: OrbitConfigPanelProps) {
  return (
    <aside className="space-y-3" aria-label="Orbit configuration">
      <section className="border border-edge bg-panel p-4">
        <p className="text-[10px] tracking-[0.3em] text-muted">ORBIT CONFIGURATION</p>

        <dl className="mt-4 space-y-2">
          <div className="flex items-baseline justify-between gap-2 border-b border-edge/60 pb-2">
            <dt className="text-[9px] tracking-[0.18em] text-muted">CENTRAL BODY</dt>
            <dd className="text-[11px] text-ink">EARTH</dd>
          </div>
          <div className="flex items-baseline justify-between gap-2 border-b border-edge/60 pb-2">
            <dt className="text-[9px] tracking-[0.18em] text-muted">ORBIT TYPE</dt>
            <dd className="text-[11px] text-ink">CIRCULAR LEO</dd>
          </div>
          <div className="flex items-baseline justify-between gap-2 pb-1">
            <dt className="text-[9px] tracking-[0.18em] text-muted">ECCENTRICITY</dt>
            <dd className="text-[11px] text-ink">0 · FIXED</dd>
          </div>
        </dl>

        <div className="mt-5">
          <FieldHeader label="ALTITUDE" value={altitudeKm.toFixed(0)} unit="km" />
          <input
            type="range"
            min={ALTITUDE_MIN_KM}
            max={ALTITUDE_MAX_KM}
            step={10}
            value={altitudeKm}
            aria-label="Altitude slider"
            onChange={(event) => onAltitude(clampAltitude(Number(event.target.value)))}
            className="mt-2 w-full accent-signal"
          />
          <div className="mt-2 flex items-center gap-2">
            <input
              type="number"
              min={ALTITUDE_MIN_KM}
              max={ALTITUDE_MAX_KM}
              step={10}
              value={altitudeKm}
              aria-label="Altitude (km)"
              onChange={(event) => onAltitude(clampAltitude(Number(event.target.value)))}
              className="w-24 border border-edge bg-panel-2 px-2 py-1.5 text-[11px] tabular-nums text-ink outline-none focus:border-signal"
            />
            <span className="text-[9px] tracking-[0.12em] text-muted">
              {Math.round(altitudeKm * 1000).toLocaleString("en-US")} m · SI AT API
            </span>
          </div>
          <p className="mt-2 border-l border-amber/50 pl-2 text-[9px] leading-relaxed text-muted/80">
            550 km is an educational mission assumption, not a NASA mission specification.
            Planner domain: {ALTITUDE_MIN_KM}–{ALTITUDE_MAX_KM} km.
          </p>
        </div>

        <div className="mt-5">
          <FieldHeader
            label="INCLINATION"
            value={inclinationDeg.toFixed(2)}
            unit="deg"
          />
          <input
            type="range"
            min={INCLINATION_MIN_DEG}
            max={INCLINATION_MAX_DEG}
            step={0.1}
            value={inclinationDeg}
            aria-label="Inclination slider"
            onChange={(event) =>
              onInclination(clampInclination(Number(event.target.value)))
            }
            className="mt-2 w-full accent-amber"
          />
          <div className="mt-2 flex items-center gap-2">
            <input
              type="number"
              min={INCLINATION_MIN_DEG}
              max={INCLINATION_MAX_DEG}
              step={0.01}
              value={inclinationDeg}
              aria-label="Inclination (degrees)"
              onChange={(event) =>
                onInclination(clampInclination(Number(event.target.value)))
              }
              className="w-24 border border-edge bg-panel-2 px-2 py-1.5 text-[11px] tabular-nums text-ink outline-none focus:border-signal"
            />
            <span className="text-[9px] tracking-[0.12em] text-muted">
              {(inclinationDeg * Math.PI / 180).toFixed(5)} rad
            </span>
          </div>
          <p className="mt-2 text-[9px] leading-relaxed text-muted/80">
            0° is equatorial; 90° is polar; above 90° is retrograde.
          </p>
        </div>

        <div className="mt-5 border-t border-edge pt-4">
          <p className="text-[9px] tracking-[0.18em] text-muted">J2 SOLUTION</p>
          <p className="mt-1 text-[10px] leading-relaxed text-muted/80">
            Required sun-synchronous inclination at this altitude:
          </p>
          <p className="mt-1 text-lg tabular-nums text-amber">
            {requiredInclinationDeg === undefined
              ? "—"
              : `${requiredInclinationDeg.toFixed(3)}°`}
          </p>
          <button
            type="button"
            onClick={onApplySso}
            disabled={requiredInclinationDeg === undefined || isSunSynchronous}
            className="mt-3 w-full border border-amber/60 bg-amber/10 px-3 py-2 text-[9px] tracking-[0.18em] text-amber transition-colors hover:bg-amber hover:text-void disabled:cursor-not-allowed disabled:border-edge disabled:bg-panel disabled:text-muted"
          >
            {isSunSynchronous
              ? "SUN-SYNCHRONOUS APPLIED"
              : "APPLY SOLVED INCLINATION"}
          </button>
          <p className="mt-2 text-[8px] leading-relaxed text-muted/70">
            Solved from the J2 nodal-precession target; never a hardcoded inclination.
          </p>
        </div>
      </section>
    </aside>
  )
}

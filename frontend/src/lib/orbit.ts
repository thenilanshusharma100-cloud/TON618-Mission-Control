export type OrbitConstants = {
  gravitational_parameter_m3_s2: number
  equatorial_radius_m: number
  j2: number
  source_title: string
  source_url: string
  retrieved_on: string
}

export type SunSynchronous = {
  target_rate_rad_s: number
  required_inclination_rad: number
  required_inclination_deg: number
  nodal_rate_delta_rad_s: number
  inclination_delta_deg: number
  tolerance_fraction: number
  is_sun_synchronous: boolean
}

export type OrbitAnalysis = {
  central_body: "Earth"
  orbit_type: "circular_leo"
  altitude_km: number
  altitude_m: number
  inclination_deg: number
  inclination_rad: number
  radius_m: number
  velocity_m_s: number
  period_s: number
  specific_energy_j_kg: number
  angular_momentum_m2_s: number
  mean_motion_rad_s: number
  orbits_per_day: number
  nodal_precession_rad_s: number
  epoch_utc: string
  constants: OrbitConstants
  sun_synchronous: SunSynchronous
  assumptions: string[]
  limitations: string[]
}

export const ALTITUDE_MIN_KM = 160
export const ALTITUDE_MAX_KM = 2000
export const DEFAULT_ALTITUDE_KM = 550
export const INCLINATION_MIN_DEG = 0
export const INCLINATION_MAX_DEG = 180

const DEG = 180 / Math.PI
const SECONDS_PER_DAY = 86400

export function clampAltitude(km: number): number {
  if (!Number.isFinite(km)) return DEFAULT_ALTITUDE_KM
  return Math.min(Math.max(km, ALTITUDE_MIN_KM), ALTITUDE_MAX_KM)
}

export function clampInclination(deg: number): number {
  if (!Number.isFinite(deg)) return 0
  return Math.min(Math.max(deg, INCLINATION_MIN_DEG), INCLINATION_MAX_DEG)
}

export function orbitRadiusScale(radiusM: number, earthRadiusM: number): number {
  if (!Number.isFinite(radiusM) || !Number.isFinite(earthRadiusM) || earthRadiusM <= 0) {
    return 1
  }
  return radiusM / earthRadiusM
}

const compact = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 })

export function formatKilometres(metres: number): string {
  return `${compact.format(metres / 1000)} km`
}

export function formatVelocity(metresPerSecond: number): string {
  return `${metresPerSecond.toFixed(1)} m/s`
}

export function formatPeriod(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "—"
  const total = Math.round(seconds)
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const remainder = total % 60
  if (hours > 0) {
    return `${hours} h ${String(minutes).padStart(2, "0")} m ${String(remainder).padStart(2, "0")} s`
  }
  return `${minutes} min ${String(remainder).padStart(2, "0")} s`
}

const SUPERSCRIPTS: Record<string, string> = {
  "-": "⁻",
  "0": "⁰",
  "1": "¹",
  "2": "²",
  "3": "³",
  "4": "⁴",
  "5": "⁵",
  "6": "⁶",
  "7": "⁷",
  "8": "⁸",
  "9": "⁹",
}

export function formatScientific(value: number, digits = 3): string {
  if (!Number.isFinite(value)) return "—"
  if (value === 0) return "0"
  const exponent = Math.floor(Math.log10(Math.abs(value)))
  const mantissa = value / 10 ** exponent
  const superscript = String(exponent)
    .split("")
    .map((character) => SUPERSCRIPTS[character] ?? character)
    .join("")
  return `${mantissa.toFixed(digits)} × 10${superscript}`
}

export function formatPrecession(radiansPerSecond: number): string {
  if (!Number.isFinite(radiansPerSecond)) return "—"
  const degreesPerDay = radiansPerSecond * DEG * SECONDS_PER_DAY
  return `${degreesPerDay >= 0 ? "+" : ""}${degreesPerDay.toFixed(4)} °/day`
}

export function formatAngle(degrees: number, digits = 2): string {
  return `${degrees.toFixed(digits)}°`
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

export function formatEpoch(value: string | null | undefined): string {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  const pad = (part: number) => String(part).padStart(2, "0")
  return `${pad(date.getUTCDate())} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()} · ${pad(
    date.getUTCHours(),
  )}:${pad(date.getUTCMinutes())} UTC`
}

"""Circular low-Earth-orbit mechanics with first-order J2 nodal precession.

Every function in this module takes and returns SI base units (metres, seconds,
radians, m^3/s^2). Conversion from kilometres or degrees happens in the API
layer, and display formatting happens in the frontend.

The sun-synchronous model solves for the inclination that produces the target
nodal rate; it never hardcodes an inclination. See ``ASSUMPTIONS`` and
``LIMITATIONS`` for the model boundary.
"""

from dataclasses import dataclass
from datetime import date
from math import acos, cos, pi, sqrt

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import ScientificData

EARTH_GM_KEY = "earth.gm"
EARTH_RADIUS_KEY = "earth.radius.equatorial"
EARTH_J2_KEY = "earth.j2"

# Planner convention: one eastward nodal revolution per 365.2422-day mean
# tropical year. This is a documented educational model assumption, not a
# NASA mission specification.
TROPICAL_YEAR_S = 365.2422 * 86400.0
SUN_SYNCHRONOUS_TARGET_RAD_S = 2.0 * pi / TROPICAL_YEAR_S

# The "sun-synchronous" badge tolerates a 1 % departure from the target rate.
SUN_SYNCHRONOUS_TOLERANCE = 0.01

ASSUMPTIONS: tuple[str, ...] = (
    "Circular Keplerian orbit: eccentricity is fixed at zero.",
    "Earth's gravity is modelled as a point mass plus the first zonal harmonic J2; "
    "higher-order harmonics are ignored.",
    "Orbit radius is the published equatorial radius plus the entered altitude.",
    "The sun-synchronous target is one eastward nodal revolution per 365.2422-day "
    "mean tropical year, a planner convention rather than a mission specification.",
    "Nodal precession uses the first-order secular J2 approximation.",
)

LIMITATIONS: tuple[str, ...] = (
    "Atmospheric drag, solar radiation pressure, luni-solar perturbations and "
    "non-zonal gravity terms are not modelled.",
    "The required sun-synchronous inclination is solved from the target rate at each "
    "altitude; it is not a fixed catalog value.",
    "The reference epoch is the analysis time. B4 computes steady-state elements, "
    "not a propagated ephemeris.",
    "This is an educational mission-design model, not a flight-dynamics or "
    "collision-avoidance tool.",
)


class OrbitConstantsMissing(LookupError):
    """Raised when the seeded Earth reference constants are unavailable."""


class OrbitModelError(ValueError):
    """Raised when the requested orbit is outside the model's valid domain."""


@dataclass(frozen=True)
class EarthConstants:
    gravitational_parameter_m3_s2: float
    equatorial_radius_m: float
    j2: float
    source_title: str
    source_url: str
    retrieved_on: date


@dataclass(frozen=True)
class OrbitSolution:
    altitude_m: float
    inclination_rad: float
    radius_m: float
    velocity_m_s: float
    period_s: float
    specific_energy_j_kg: float
    angular_momentum_m2_s: float
    mean_motion_rad_s: float
    nodal_precession_rad_s: float
    required_sso_inclination_rad: float


def load_earth_constants(db: Session) -> EarthConstants:
    """Load the three verified Earth constants used by the orbit model."""
    keys = (EARTH_GM_KEY, EARTH_RADIUS_KEY, EARTH_J2_KEY)
    rows = db.scalars(select(ScientificData).where(ScientificData.key.in_(keys))).all()
    by_key = {row.key: row for row in rows}
    missing = [key for key in keys if key not in by_key]
    if missing:
        raise OrbitConstantsMissing(
            "Missing seeded Earth constants: " + ", ".join(sorted(missing))
        )

    gm = by_key[EARTH_GM_KEY]
    source = gm.source
    if source is None:
        raise OrbitConstantsMissing("Earth gravitational parameter has no cited source")

    return EarthConstants(
        gravitational_parameter_m3_s2=gm.value_si,
        equatorial_radius_m=by_key[EARTH_RADIUS_KEY].value_si,
        j2=by_key[EARTH_J2_KEY].value_si,
        source_title=source.title,
        source_url=source.url,
        retrieved_on=source.retrieved_on,
    )


def orbital_radius(altitude_m: float, earth_radius_m: float) -> float:
    if altitude_m <= 0:
        raise OrbitModelError("altitude must be positive")
    return earth_radius_m + altitude_m


def orbital_velocity(mu: float, radius_m: float) -> float:
    if mu <= 0 or radius_m <= 0:
        raise OrbitModelError("gravitational parameter and radius must be positive")
    return sqrt(mu / radius_m)


def orbital_period(mu: float, radius_m: float) -> float:
    if mu <= 0 or radius_m <= 0:
        raise OrbitModelError("gravitational parameter and radius must be positive")
    return 2.0 * pi * sqrt(radius_m**3 / mu)


def specific_orbital_energy(mu: float, radius_m: float) -> float:
    if mu <= 0 or radius_m <= 0:
        raise OrbitModelError("gravitational parameter and radius must be positive")
    return -mu / (2.0 * radius_m)


def specific_angular_momentum(mu: float, radius_m: float) -> float:
    if mu <= 0 or radius_m <= 0:
        raise OrbitModelError("gravitational parameter and radius must be positive")
    return sqrt(mu * radius_m)


def mean_motion(mu: float, radius_m: float) -> float:
    if mu <= 0 or radius_m <= 0:
        raise OrbitModelError("gravitational parameter and radius must be positive")
    return sqrt(mu / radius_m**3)


def j2_nodal_precession(
    mu: float,
    radius_m: float,
    reference_radius_m: float,
    j2: float,
    inclination_rad: float,
) -> float:
    """First-order secular J2 rate of change of the right ascension of the node.

    dOmega/dt = -(3/2) * J2 * (R_ref / r)^2 * n * cos(i)
    """
    if not 0.0 <= inclination_rad <= pi:
        raise OrbitModelError("inclination must lie between 0 and pi radians")
    n = mean_motion(mu, radius_m)
    return -1.5 * j2 * (reference_radius_m / radius_m) ** 2 * n * cos(inclination_rad)


def sun_synchronous_inclination(
    mu: float,
    radius_m: float,
    reference_radius_m: float,
    j2: float,
    target_rate_rad_s: float = SUN_SYNCHRONOUS_TARGET_RAD_S,
) -> float:
    """Solve the inclination that produces the target eastward nodal rate.

    Setting -(3/2) J2 (R/r)^2 n cos(i) = target and solving for i gives
    cos(i) = -(2/3) target / (J2 (R/r)^2 n). The solution is retrograde
    (i > 90 degrees) for a positive eastward target.
    """
    if target_rate_rad_s <= 0:
        raise OrbitModelError("sun-synchronous target rate must be positive")
    n = mean_motion(mu, radius_m)
    coefficient = j2 * (reference_radius_m / radius_m) ** 2 * n
    if coefficient <= 0:
        raise OrbitModelError("J2 nodal coefficient must be positive")

    cos_inclination = -(2.0 / 3.0) * target_rate_rad_s / coefficient
    if cos_inclination < -1.0 or cos_inclination > 1.0:
        raise OrbitModelError(
            "sun-synchronous inclination is unreachable at this orbit radius"
        )
    return acos(cos_inclination)


def analyze_orbit(
    constants: EarthConstants,
    altitude_m: float,
    inclination_rad: float,
) -> OrbitSolution:
    """Compute circular-orbit elements and the J2 sun-synchronous solution."""
    if not 0.0 <= inclination_rad <= pi:
        raise OrbitModelError("inclination must lie between 0 and pi radians")

    radius_m = orbital_radius(altitude_m, constants.equatorial_radius_m)
    return OrbitSolution(
        altitude_m=altitude_m,
        inclination_rad=inclination_rad,
        radius_m=radius_m,
        velocity_m_s=orbital_velocity(constants.gravitational_parameter_m3_s2, radius_m),
        period_s=orbital_period(constants.gravitational_parameter_m3_s2, radius_m),
        specific_energy_j_kg=specific_orbital_energy(
            constants.gravitational_parameter_m3_s2, radius_m
        ),
        angular_momentum_m2_s=specific_angular_momentum(
            constants.gravitational_parameter_m3_s2, radius_m
        ),
        mean_motion_rad_s=mean_motion(
            constants.gravitational_parameter_m3_s2, radius_m
        ),
        nodal_precession_rad_s=j2_nodal_precession(
            constants.gravitational_parameter_m3_s2,
            radius_m,
            constants.equatorial_radius_m,
            constants.j2,
            inclination_rad,
        ),
        required_sso_inclination_rad=sun_synchronous_inclination(
            constants.gravitational_parameter_m3_s2,
            radius_m,
            constants.equatorial_radius_m,
            constants.j2,
        ),
    )


__all__ = [
    "ASSUMPTIONS",
    "LIMITATIONS",
    "SUN_SYNCHRONOUS_TARGET_RAD_S",
    "SUN_SYNCHRONOUS_TOLERANCE",
    "TROPICAL_YEAR_S",
    "EarthConstants",
    "OrbitConstantsMissing",
    "OrbitModelError",
    "OrbitSolution",
    "analyze_orbit",
    "j2_nodal_precession",
    "load_earth_constants",
    "mean_motion",
    "orbital_period",
    "orbital_radius",
    "orbital_velocity",
    "specific_angular_momentum",
    "specific_orbital_energy",
    "sun_synchronous_inclination",
]

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class OrbitRequest(BaseModel):
    """Orbit-planner inputs.

    Altitude is entered in kilometres and inclination in degrees; the route
    converts both to SI before calling the physics service.
    """

    model_config = ConfigDict(allow_inf_nan=False)

    altitude_km: float = Field(ge=160.0, le=2000.0)
    inclination_deg: float = Field(ge=0.0, le=180.0)


class OrbitConstantsRead(BaseModel):
    gravitational_parameter_m3_s2: float
    equatorial_radius_m: float
    j2: float
    source_title: str
    source_url: str
    retrieved_on: date


class SunSynchronousRead(BaseModel):
    target_rate_rad_s: float
    required_inclination_rad: float
    required_inclination_deg: float
    nodal_rate_delta_rad_s: float
    inclination_delta_deg: float
    tolerance_fraction: float
    is_sun_synchronous: bool


class OrbitAnalysisRead(BaseModel):
    central_body: Literal["Earth"]
    orbit_type: Literal["circular_leo"]
    altitude_km: float
    altitude_m: float
    inclination_deg: float
    inclination_rad: float
    radius_m: float
    velocity_m_s: float
    period_s: float
    specific_energy_j_kg: float
    angular_momentum_m2_s: float
    mean_motion_rad_s: float
    orbits_per_day: float
    nodal_precession_rad_s: float
    epoch_utc: datetime
    constants: OrbitConstantsRead
    sun_synchronous: SunSynchronousRead
    assumptions: list[str]
    limitations: list[str]

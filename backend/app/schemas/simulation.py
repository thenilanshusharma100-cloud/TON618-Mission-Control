from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.design import DesignItem


class OrbitParameters(BaseModel):
    """Orbit selected in the B4 planner.

    Only the orbit is taken from the request: mass, power and cost are always
    recomputed from the saved spacecraft design and the seeded component
    catalog, never trusted from the browser.
    """

    altitude_km: float = Field(gt=0, le=100_000, description="Circular orbit altitude")
    inclination_deg: float = Field(ge=0, le=180, description="Orbital inclination")


class MissionParams(BaseModel):
    """Parameters for a mission simulation request.

    ``design_id`` selects a saved spacecraft (the normal path). When it is
    omitted, ``components`` must describe an unsaved design.
    """

    design_id: int | None = Field(
        default=None, ge=1, description="Saved spacecraft design id"
    )
    design_name: str | None = Field(
        default=None, description="Name for an unsaved design"
    )
    mission_slug: str = Field(
        default="earthwatch-01", min_length=2, description="Mission identifier"
    )

    design_data: OrbitParameters = Field(
        description="Orbit parameters selected in the orbit planner"
    )

    components: list[DesignItem] = Field(
        default_factory=list,
        description="Component lines for an unsaved design; ignored when design_id is set",
    )

    model_config = {"protected_namespaces": ()}


class SimulationScoreBreakdown(BaseModel):
    """Per-category score breakdown for a mission (0-100 total)."""

    orbit_achievement: int = Field(
        default=0, ge=0, le=25, description="Orbit achievement (25 max)"
    )
    power_management: int = Field(
        default=0, ge=0, le=20, description="Power management (20 max)"
    )
    mass_management: int = Field(
        default=0, ge=0, le=15, description="Mass management (15 max)"
    )
    communication: int = Field(
        default=0, ge=0, le=15, description="Communication (15 max)"
    )
    payload_performance: int = Field(
        default=0, ge=0, le=15, description="Payload performance (15 max)"
    )
    budget_management: int = Field(
        default=0, ge=0, le=10, description="Budget management (10 max)"
    )

    @property
    def total(self) -> int:
        return (
            self.orbit_achievement
            + self.power_management
            + self.mass_management
            + self.communication
            + self.payload_performance
            + self.budget_management
        )


class MissionTimelinePointRead(BaseModel):
    """One sampled point in the mission timeline (one per completed orbit)."""

    elapsed_s: float
    mission_phase: str
    epoch_utc: str
    latitude_deg: float | None = None
    longitude_deg: float | None = None
    latitude_rad: float | None = None
    longitude_rad: float | None = None
    power_status: str
    comm_status: str
    payload_status: str


class SimulationRunRead(BaseModel):
    """Complete result of one mission simulation run.

    Every value is derived from the saved design calculation, the seeded
    mission budgets and the orbit solution. There are no browser-supplied
    engineering inputs.
    """

    run_id: str
    started_at: datetime
    completed_at: datetime | None = None

    design_id: int
    design_name: str
    mission_slug: str

    # Orbit
    altitude_km: float
    inclination_deg: float
    required_sso_inclination_deg: float
    orbital_period_s: float
    orbits_completed: int
    orbit_elapsed_s: float

    # Mass and budgets
    total_mass_kg: float
    mass_limit_kg: float
    total_cost_usd: int
    cost_limit_usd: int
    cost_remaining_usd: int
    cost_used_pct: float

    # Power
    power_generation_w: float
    power_consumption_w: float
    net_power_w: float
    min_power_margin_w: float
    battery_energy_full_wh: float
    battery_energy_remaining_wh: float
    battery_state_of_charge_pct: float
    battery_min_state_of_charge_pct: float
    power_balance_status: str

    # Subsystems and communications
    coverage_pct: float
    required_categories: int
    present_categories: int
    missing_categories: list[str]
    comm_contact_sessions: int
    comm_contact_fraction: float

    # Scoring and status
    raw_score: int = Field(ge=0, le=100)
    score_breakdown: SimulationScoreBreakdown
    mission_status: str
    warnings: list[str]
    recommendations: list[str]
    violation_codes: list[str]

    timeline: list[MissionTimelinePointRead]
    assumptions: list[str]


class MissionReadinessRead(BaseModel):
    """Summary of whether the design is ready to fly the selected mission."""

    valid: bool
    mission_status: str
    warnings: list[str]
    recommendations: list[str]
    total_mass_kg: float
    mass_limit_kg: float
    total_cost_usd: int
    cost_limit_usd: int
    cost_used_pct: float
    net_power_w: float
    min_power_margin_w: float
    battery_min_state_of_charge_pct: float
    coverage_pct: float
    required_categories: int
    present_categories: int
    missing_categories: list[str]
    violation_codes: list[str]


class SimulationRunResponse(BaseModel):
    """Full response from a mission simulation run."""

    run: SimulationRunRead
    raw_score: int = Field(ge=0, le=100, description="Total score 0-100")
    score_breakdown: SimulationScoreBreakdown = Field(
        description="Per-category scores summing to raw_score"
    )
    readiness: MissionReadinessRead = Field(
        description="Launch-readiness evaluation derived from the same run"
    )

    model_config = {"protected_namespaces": ()}

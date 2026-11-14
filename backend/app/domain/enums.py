from enum import StrEnum


class ComponentCategory(StrEnum):
    STRUCTURE = "structure"
    POWER = "power"
    COMMUNICATION = "communication"
    ONBOARD_COMPUTER = "onboard_computer"
    PAYLOAD = "payload"
    PROPULSION = "propulsion"
    THERMAL_CONTROL = "thermal_control"


class PowerRole(StrEnum):
    CONSUMER = "consumer"
    GENERATOR = "generator"


class DataClassification(StrEnum):
    PUBLISHED_REFERENCE = "published_reference"
    DERIVED = "derived"
    ESTIMATED = "estimated"


class SourceKind(StrEnum):
    NASA = "nasa"
    JPL = "jpl"
    VENDOR = "vendor"
    STANDARD = "standard"
    OTHER = "other"

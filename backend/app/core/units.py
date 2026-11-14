"""Pint-backed unit handling.

Rule for the whole codebase: internal calculations use SI base units
(metre, kilogram, second, kelvin, ...). Conversion to display units happens
only at the UI boundary.
"""

from pint import UnitRegistry

ureg = UnitRegistry()
ureg.default_system = "mks"
Q_ = ureg.Quantity


def to_si(value: float, unit: str) -> float:
    """Convert ``value`` in ``unit`` to SI base units and return the magnitude.

    Raises ``pint.errors.UndefinedUnitError`` for unknown units.
    """
    return Q_(value, unit).to_base_units().magnitude

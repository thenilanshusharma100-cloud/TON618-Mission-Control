import pytest
from pint.errors import DimensionalityError

from app.core.units import Q_, to_si


def test_kilometres_convert_to_metres() -> None:
    assert to_si(500, "km") == pytest.approx(500_000.0)


def test_minutes_convert_to_seconds() -> None:
    assert to_si(94.6, "min") == pytest.approx(5676.0, rel=1e-9)


def test_kilograms_are_already_si() -> None:
    assert to_si(12.5, "kg") == pytest.approx(12.5)


def test_dimensionality_guard_rejects_incompatible_units() -> None:
    with pytest.raises(DimensionalityError):
        Q_(1.0, "watt").to("kilogram")

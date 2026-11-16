"""Hand-written, illustrative demo destinations (not live travel data)."""
from .adventure import DESTINATIONS as _ADVENTURE
from .beach_mountains import DESTINATIONS as _BEACH_MOUNTAINS
from .culture_urban import DESTINATIONS as _CULTURE_URBAN

DESTINATIONS = _BEACH_MOUNTAINS + _CULTURE_URBAN + _ADVENTURE

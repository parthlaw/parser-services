import re
from datetime import datetime
from typing import Optional, Tuple, Union

from dateutil import parser as _dateutil_parser
DATE_FORMAT_MAP={"US":["US"],"EU":["EU","IN"]}
# ---------------------------------------------------------------------------
# Locale alias maps
# ---------------------------------------------------------------------------
_EU_ALIASES = {"EU", "EUR", "EUROPE", "UK", "DD/MM", "IN", "INDIA"}
_US_ALIASES = {"US", "USA", "MM/DD", ""}

# A regex to capture a leading DD/MM/YYYY or MM/DD/YYYY (or with '-') pattern.
# We do *not* anchor end-of-string so that times are allowed after the date.
# Groups: 1 -> first number, 2 -> second number, 3 -> year.
_DATE_HEAD_RE = re.compile(r"^\s*(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b")


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _norm_locale(locale: str) -> str:
    """Normalize a locale string to either 'US' or 'EU'. Default to US."""
    if not locale:
        return "US"
    up = locale.strip().upper()
    if up in _EU_ALIASES:
        return "EU"
    if up in _US_ALIASES:
        return "US"
    # Fallback heuristic: if it *starts* with EU or IN, call it EU.
    if up.startswith(("EU", "IN")):
        return "EU"
    return "US"


def _parse_with_dayfirst(date_string: str, dayfirst: bool) -> datetime:
    """Centralized call into dateutil so we keep behavior consistent."""
    return _dateutil_parser.parse(date_string, dayfirst=dayfirst)


def _fmt(dt: datetime, fmt: str) -> str:
    return dt.strftime(fmt)


def _infer_dayfirst_from_head(date_string: str) -> Optional[bool]:
    """
    Inspect the leading numeric date portion and infer whether we should parse
    with dayfirst=True or False. Return None if ambiguous.

    Heuristic:
      - If token1 > 12 and token2 <= 12 -> definitely day-first.
      - If token2 > 12 and token1 <= 12 -> definitely month-first.
      - If both <= 12 -> ambiguous -> None.
      - If either token invalid (e.g., 0 or >31) we still let dateutil raise.
    """
    m = _DATE_HEAD_RE.match(date_string)
    if not m:
        return None
    try:
        a = int(m.group(1))
        b = int(m.group(2))
    except ValueError:  # should not happen due to regex, but be safe
        return None

    if a > 12 and b <= 12:
        return True  # dayfirst
    if b > 12 and a <= 12:
        return False  # monthfirst
    return None  # ambiguous (both <=12)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def parse_date_us_format(date_string: str, output_format: str = "%Y-%m-%d", *, return_dt: bool = False) -> Union[str, datetime, None]:
    """Parse assuming *month-first* (US).

    Works for both date-only and datetime strings.
    """
    try:
        dt = _parse_with_dayfirst(date_string, dayfirst=False)
        return dt if return_dt else _fmt(dt, output_format)
    except Exception:
        return None


def parse_date_eu_format(date_string: str, output_format: str = "%Y-%m-%d", *, return_dt: bool = False) -> Union[str, datetime, None]:
    """Parse assuming *day-first* (EU / IN / UK style)."""
    try:
        dt = _parse_with_dayfirst(date_string, dayfirst=True)
        return dt if return_dt else _fmt(dt, output_format)
    except Exception:
        return None


def parse_date_locale(
    date_string: str,
    locale: str = "US",
    output_format: str = "%Y-%m-%d",
    *,
    return_dt: bool = False,
) -> Union[str, datetime]:
    """Parse date based on a locale-like string ("US", "EU", "IN", etc.)."""
    norm = _norm_locale(locale)
    dayfirst = norm == "EU"
    dt = _parse_with_dayfirst(date_string, dayfirst=dayfirst)
    return dt if return_dt else _fmt(dt, output_format)


def smart_date_parser(
    date_string: str,
    default_locale: str = "US",
    output_format: str = "%Y-%m-%d",
    *,
    return_dt: bool = False,
    return_locale: bool = False,
) -> Union[str, Tuple[str, str], datetime, Tuple[datetime, str]]:
    """
    Attempt to infer DD/MM vs MM/DD by inspecting the numeric head of the string.

    - If unambiguous (one of the first two tokens >12), we pick that interpretation.
    - If ambiguous, we fall back to `default_locale`.
    - Full time strings (AM/PM or 24h) are preserved because we always parse the *full* original string.

    Returns:
        By default, a formatted string per `output_format`.
        If `return_dt=True`, returns a datetime.
        If `return_locale=True`, returns a tuple (value, "US"|"EU").

    Examples:
        smart_date_parser("31/03/2021 08:04:44 PM", default_locale="IN", output_format="%Y-%m-%d %H:%M:%S")
        smart_date_parser("01/02/2024", default_locale="US", return_locale=True)
    """
    try:
        inferred = _infer_dayfirst_from_head(date_string)
        if inferred is None:
            # ambiguous -> use caller default locale
            norm = _norm_locale(default_locale)
            dayfirst = norm == "EU"
            used_locale = norm
        else:
            dayfirst = inferred
            used_locale = "EU" if inferred else "US"

        dt = _parse_with_dayfirst(date_string, dayfirst=dayfirst)

        if return_dt:
            value = dt
        else:
            value = _fmt(dt, output_format)

        return value, used_locale
    except Exception:
        return date_string, "US"

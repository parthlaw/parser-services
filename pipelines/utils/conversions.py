import re
from datetime import datetime
from dateutil import parser
from typing import Union, Optional

def _normalize_date_string(date_str: str) -> str:
    # Remove leading/trailing whitespace and collapse internal multiple spaces
    date_str = re.sub(r"\s+", " ", date_str.strip())

    # Remove spaces around date delimiters like "/", "-", "."
    date_str = re.sub(r"\s*([/\-.])\s*", r"\1", date_str)

    return date_str


def currency_string_to_float(s):
    if not s or not isinstance(s, str):
        return None

    # Extract the last valid float-like pattern (e.g., 10.00 or 1,000.00)
    matches = re.findall(r"[-+]?\d[\d,]*\.?\d*", s)
    if not matches:
        return None

    # Pick the last match (more likely to be the actual number in messy strings)
    num_str = matches[-1].replace(",", "")  # Remove thousands separator

    try:
        return float(num_str)
    except ValueError:
        return None


def convert_to_iso(
    date_input: Union[str, datetime], default_timezone: str = "UTC"
) -> Optional[str]:
    """
    Convert various date formats to ISO 8601 format (YYYY-MM-DDTHH:MM:SS).

    Args:
        date_input: Date as string or datetime object
        default_timezone: Default timezone to use if none specified

    Returns:
        ISO formatted date string or None if conversion fails

    Examples:
        >>> convert_to_iso("2023-12-25")
        '2023-12-25T00:00:00'
        >>> convert_to_iso("Dec 25, 2023 3:30 PM")
        '2023-12-25T15:30:00'
        >>> convert_to_iso("25/12/2023")
        '2023-12-25T00:00:00'
    """

    if date_input is None:
        return None

    # If already a datetime object
    if isinstance(date_input, datetime):
        return date_input.isoformat()

    # Convert to string if not already
    date_str = str(date_input).strip()
    date_str = _normalize_date_string(str(date_input))

    if not date_str:
        return None

    try:
        # Try using dateutil parser first (handles most formats automatically)
        parsed_date = parser.parse(date_str, fuzzy=True)
        return parsed_date.isoformat()

    except (ValueError, TypeError, parser.ParserError):
        # If dateutil fails, try custom patterns
        return _parse_custom_formats(date_str)


def _parse_custom_formats(date_str: str) -> Optional[str]:
    """Handle custom date formats that dateutil might miss."""

    # Common patterns to try
    patterns = [
        # DD/MM/YYYY or MM/DD/YYYY
        (r"(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})", ["%d/%m/%Y", "%m/%d/%Y"]),
        # YYYY/MM/DD
        (r"(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})", ["%Y/%m/%d"]),
        # DD-MMM-YYYY
        (r"(\d{1,2})[/\-.]([A-Za-z]{3})[/\-.](\d{4})", ["%d-%b-%Y"]),
        # YYYYMMDD
        (r"^(\d{8})$", ["%Y%m%d"]),
        # Unix timestamp (10 digits)
        (r"^(\d{10})$", ["unix"]),
        # Unix timestamp with milliseconds (13 digits)
        (r"^(\d{13})$", ["unix_ms"]),
    ]

    for pattern, formats in patterns:
        if re.match(pattern, date_str):
            for fmt in formats:
                try:
                    if fmt == "unix":
                        dt = datetime.fromtimestamp(int(date_str))
                        return dt.isoformat()
                    elif fmt == "unix_ms":
                        dt = datetime.fromtimestamp(int(date_str) / 1000)
                        return dt.isoformat()
                    else:
                        dt = datetime.strptime(date_str, fmt)
                        return dt.isoformat()
                except ValueError:
                    continue

    return None
convert_to_iso("01/04/ 2024")

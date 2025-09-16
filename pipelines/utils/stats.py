from statistics import mode
import numpy as np
from typing import List, Dict


def calculate_y_merge_tolerance(
    words: List[Dict],
    percentile_threshold: float = 25,
    min_gap_samples: int = 10,
    default_tolerance: float = 3.0,
    max_tolerance: float = 10.0,
    min_tolerance: float = 0,
) -> float:
    """
    Calculate optimal y-direction merge tolerance based on statistical analysis of word positions.

    This function analyzes the vertical spacing between words to determine if they are
    tightly packed or loosely spaced, and returns an appropriate merge tolerance for
    row building operations.

    Args:
        words: List of word dictionaries with 'top', 'bottom' keys
        percentile_threshold: Percentile to use for determining tight packing (default: 25)
        min_gap_samples: Minimum number of gap samples needed for reliable statistics
        default_tolerance: Default tolerance when insufficient data (default: 3.0)
        max_tolerance: Maximum allowed tolerance (default: 10.0)
        min_tolerance: Minimum allowed tolerance (default: 1.0)

    Returns:
        float: Optimal merge tolerance value for y-direction merging
    """

    if not words or len(words) < 2:
        return default_tolerance

    # Sort words by top position
    sorted_words = sorted(words, key=lambda w: w.get("top", 0))

    # Calculate gaps between consecutive words
    y_gaps = []
    line_heights = []

    for i in range(len(sorted_words) - 1):
        current_word = sorted_words[i]
        next_word = sorted_words[i + 1]

        # Get positions
        current_bottom = current_word.get("bottom", 0)
        current_top = current_word.get("top", 0)
        next_top = next_word.get("top", 0)
        next_bottom = next_word.get("bottom", 0)

        # Calculate line height
        current_height = current_bottom - current_top
        next_height = next_bottom - next_top

        if current_height > 0:
            line_heights.append(current_height)
        if next_height > 0:
            line_heights.append(next_height)

        # Calculate gap between lines
        gap = next_top - current_bottom

        # Only consider positive gaps (words not overlapping)
        if gap > 0:
            y_gaps.append(gap)

    # If insufficient gap samples, use default
    if len(y_gaps) < min_gap_samples:
        return default_tolerance

    # Calculate statistics
    gap_stats = {
        "mean": np.mean(y_gaps),
        "median": np.median(y_gaps),
        "std": np.std(y_gaps),
        "min": np.min(y_gaps),
        "max": np.max(y_gaps),
        "percentile_25": np.percentile(y_gaps, 25),
        "percentile_75": np.percentile(y_gaps, 75),
        "percentile_10": np.percentile(y_gaps, 10),
        "percentile_90": np.percentile(y_gaps, 90),
        "iqr": np.percentile(y_gaps, 75) - np.percentile(y_gaps, 25),
        "mode": mode(y_gaps),
    }
    # Calculate average line height if available
    avg_line_height = np.mean(line_heights) if line_heights else 10

    # Determine if text is tightly packed
    normalised_iqr = gap_stats["iqr"] / avg_line_height
    is_tightly_packed = normalised_iqr < 0.5 or gap_stats["mode"] < gap_stats["iqr"]
    # Calculate tolerance based on packing density
    if is_tightly_packed:
        # For tightly packed text, use smaller tolerance
        # Base it on the 25th percentile of gaps
        tolerance = 0
    else:
        # For loosely packed text, use larger tolerance
        # Base it on median gap with some buffer
        tolerance = min(
            max(round(gap_stats["median"], 1) + gap_stats["std"] * 0.2, 2),
            gap_stats["mean"],
            7,
        )
    return tolerance

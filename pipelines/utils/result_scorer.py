from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime
import re
import json

def score_parsed_result(rows: List[Dict[str, Any]], debug: bool = True) -> Dict[str, Any]:
    if not rows:
        return {"score": 0.0, "mode": None}

    def std_key(k: str) -> str:
        return re.sub(r"[ _./]", "", k.lower())

    CREDIT_KEYS = {"credit", "cramount", "cr"}
    DEBIT_KEYS = {"debit", "dramount", "dr"}
    AMOUNT_KEYS = {"amount", "amt", "transactionamount", "txnamount"}
    TYPE_KEYS = {"type", "txntype", "drcr", "crdr", "transactiontype"}

    def parse_money(val: Any) -> Optional[float]:
        if val is None:
            return None
        if isinstance(val, (int, float)):
            return float(val)
        s = str(val).strip()
        if not s:
            return None
        s = re.sub(r"[,\\s₹$€£]", "", s)
        if s.startswith("(") and s.endswith(")"):
            s = "-" + s[1:-1]
        try:
            return float(s)
        except ValueError:
            return None

    def parse_type(val: Any) -> Optional[str]:
        if val is None:
            return None
        s = str(val).upper().strip().replace(".", "")
        if "CREDIT" in s or s == "CR":
            return "CR"
        if "DEBIT" in s or s == "DR":
            return "DR"
        return None

    def extract_fields(row: Dict[str, Any]) -> Tuple[float, float]:
        credit_val = debit_val = amount_val = None
        type_val = None
        for k, v in row.items():
            sk = std_key(k)
            if sk in CREDIT_KEYS:
                credit_val = parse_money(v)
            elif sk in DEBIT_KEYS:
                debit_val = parse_money(v)
            elif sk in AMOUNT_KEYS:
                amount_val = parse_money(v)
            elif sk in TYPE_KEYS:
                type_val = parse_type(v)
        if credit_val is not None or debit_val is not None:
            return credit_val or 0.0, debit_val or 0.0
        if amount_val is not None and type_val is not None:
            return (amount_val, 0.0) if type_val == "CR" else (0.0, abs(amount_val))
        if amount_val is not None:
            return (amount_val, 0.0) if amount_val >= 0 else (0.0, abs(amount_val))
        return 0.0, 0.0

    def parse_date(val: Any) -> Optional[datetime]:
        try:
            return datetime.strptime(str(val).strip(), "%Y-%m-%d")
        except Exception:
            return None

    parsed_dates = [parse_date(r.get("date")) for r in rows]
    valid_dates = [d for d in parsed_dates if d is not None]

    if len(valid_dates) >= 2:
        if valid_dates == sorted(valid_dates):
            sorted_rows = rows[:]  # already ascending
        elif valid_dates == sorted(valid_dates, reverse=True):
            sorted_rows = list(reversed(rows))  # reverse
        else:
            # Mixed order: sort by date, then by original index
            indexed_rows = list(enumerate(rows))
            indexed_sorted = sorted(indexed_rows, key=lambda x: ((parsed_dates[x[0]] or datetime.min), x[0]))
            sorted_rows = [r for _, r in indexed_sorted]
    else:
        sorted_rows = rows[:]  # No date info: keep original order

    balances = [parse_money(r.get("balance")) for r in sorted_rows]
    credits, debits = [], []
    for r in sorted_rows:
        cr, dr = extract_fields(r)
        credits.append(cr)
        debits.append(dr)

    def check_mode(post: bool) -> float:
        matches = checks = 0
        for i in range(1, len(sorted_rows)):
            if balances[i - 1] is not None and balances[i] is not None:
                checks += 1
                if post:
                    expected = balances[i - 1] + credits[i] - debits[i]
                    actual = balances[i]
                else:
                    expected = balances[i] - credits[i] + debits[i]
                    actual = balances[i - 1]
                if abs(expected - actual) < 0.01:
                    matches += 1
                elif debug:
                    print(f"Mismatch at {i}: expected {expected}, actual {actual}")
        return matches / checks if checks else 0.0

    post_score = check_mode(True)
    pre_score = check_mode(False)
    mode = "post" if post_score >= pre_score else "pre"

    return {"score": round(10 * max(post_score, pre_score), 2), "mode": mode}

def score_jsonl_file(jsonl_file_path: str, debug: bool = True) -> Dict[str, Any]:
    """
    Score a parsed result from a JSONL file.
    
    Args:
        jsonl_file_path (str): Path to the JSONL file containing parsed bank statement data
        debug (bool): Whether to print debug information
        
    Returns:
        Dict[str, Any]: Dictionary containing score and mode information
    """
    try:
        rows = []
        with open(jsonl_file_path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line:
                    try:
                        row = json.loads(line)
                        rows.append(row)
                    except json.JSONDecodeError as e:
                        if debug:
                            print(f"Warning: Failed to parse JSON line: {line[:100]}... Error: {e}")
                        continue
        
        return score_parsed_result(rows, debug)
        
    except FileNotFoundError:
        if debug:
            print(f"Error: JSONL file not found: {jsonl_file_path}")
        return {"score": 0.0, "mode": None}
    except Exception as e:
        if debug:
            print(f"Error processing JSONL file: {e}")
        return {"score": 0.0, "mode": None}

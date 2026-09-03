"""Format dates to Tajik long form: 2 сентябри соли 2026"""
from __future__ import annotations

import re
from datetime import datetime
from typing import Optional

_MONTHS = {
    1: "январи",
    2: "феврали",
    3: "марти",
    4: "апрели",
    5: "майи",
    6: "июни",
    7: "июли",
    8: "августи",
    9: "сентябри",
    10: "октябри",
    11: "ноябри",
    12: "декабри",
}


def format_tj_date(raw: Optional[str]) -> str:
    """Convert various date strings to 'D моҳи соли YYYY'.

    Accepts: 2.09.2026, 02.09.2026, 2/9/2026, 2026-09-02,
             2 сентябри соли 2026 (passthrough if already long).
    Returns original string if unparseable.
    """
    if raw is None:
        return ""
    s = str(raw).strip()
    if not s:
        return ""

    # Already long Tajik form
    if re.search(r"соли\s+\d{4}", s, re.I):
        return s

    # ISO datetime from DB: 2026-09-02 12:30:00
    m = re.match(r"^(\d{4})-(\d{2})-(\d{2})", s)
    if m:
        y, mo, d = int(m.group(1)), int(m.group(2)), int(m.group(3))
        return _compose(d, mo, y)

    # D.M.YYYY or DD.MM.YYYY or D/M/YYYY
    m = re.match(r"^(\d{1,2})[./\-](\d{1,2})[./\-](\d{4})$", s)
    if m:
        d, mo, y = int(m.group(1)), int(m.group(2)), int(m.group(3))
        if 1 <= mo <= 12 and 1 <= d <= 31:
            return _compose(d, mo, y)

    # YYYY.MM.DD
    m = re.match(r"^(\d{4})[./\-](\d{1,2})[./\-](\d{1,2})$", s)
    if m:
        y, mo, d = int(m.group(1)), int(m.group(2)), int(m.group(3))
        if 1 <= mo <= 12 and 1 <= d <= 31:
            return _compose(d, mo, y)

    try:
        dt = datetime.fromisoformat(s.replace("Z", "+00:00")[:19])
        return _compose(dt.day, dt.month, dt.year)
    except Exception:
        pass

    return s


def _compose(day: int, month: int, year: int) -> str:
    name = _MONTHS.get(month)
    if not name:
        return f"{day}.{month:02d}.{year}"
    return f"{day} {name} соли {year}"

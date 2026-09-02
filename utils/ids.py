"""Generate long unique numeric Student IDs (16–20+ digits)."""
from __future__ import annotations

import random
import time


def generate_student_id(length: int = 18) -> str:
    """Pure numeric ID, long enough to be unique offline.

    Format idea (inspired by Geografia style):
    - timestamp portion (ms) + random digits
    - always starts with non-zero
    """
    length = max(16, min(length, 24))
    ts = str(int(time.time() * 1000))
    rnd_len = max(6, length - len(ts))
    rnd = "".join(str(random.randint(0, 9)) for _ in range(rnd_len))
    raw = ts + rnd
    if len(raw) > length:
        raw = raw[-length:]
    elif len(raw) < length:
        raw = raw + "".join(str(random.randint(0, 9)) for _ in range(length - len(raw)))
    if raw[0] == "0":
        raw = str(random.randint(1, 9)) + raw[1:]
    return raw

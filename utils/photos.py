"""Save student photos from base64 or uploaded file to data/photos/."""
from __future__ import annotations

import base64
import re
from pathlib import Path
from typing import Optional

from config import PHOTOS_DIR


def _safe_id(student_id: str) -> str:
    return re.sub(r"[^0-9A-Za-z_-]", "", student_id)[:40]


def save_photo_base64(student_id: str, data_url: str) -> Optional[str]:
    """Accept data:image/jpeg;base64,... or raw base64. Return relative path or None."""
    if not data_url:
        return None
    m = re.match(r"^data:image/(jpeg|jpg|png|webp);base64,(.+)$", data_url, re.I | re.S)
    if m:
        ext = "jpg" if m.group(1).lower() in ("jpeg", "jpg") else m.group(1).lower()
        b64 = m.group(2)
    else:
        ext = "jpg"
        b64 = data_url
    try:
        raw = base64.b64decode(b64)
    except Exception:
        return None
    if len(raw) < 100:
        return None
    name = f"{_safe_id(student_id)}.{ext}"
    path = PHOTOS_DIR / name
    path.write_bytes(raw)
    return f"photos/{name}"


def save_photo_file(student_id: str, file_storage) -> Optional[str]:
    """Werkzeug FileStorage → data/photos/<id>.jpg"""
    if not file_storage or not file_storage.filename:
        return None
    filename = file_storage.filename.lower()
    ext = "jpg"
    if filename.endswith(".png"):
        ext = "png"
    elif filename.endswith(".webp"):
        ext = "webp"
    name = f"{_safe_id(student_id)}.{ext}"
    path = PHOTOS_DIR / name
    file_storage.save(str(path))
    return f"photos/{name}"


def photo_abs_path(rel: str) -> Optional[Path]:
    if not rel:
        return None
    p = PHOTOS_DIR.parent / rel if not Path(rel).is_absolute() else Path(rel)
    return p if p.is_file() else None

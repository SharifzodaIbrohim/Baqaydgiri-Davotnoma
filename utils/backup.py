"""Create zip backup of database and photos."""
from __future__ import annotations

import zipfile
from datetime import datetime
from io import BytesIO
from pathlib import Path

from config import DB_PATH, PHOTOS_DIR, EXPORTS_DIR, DATA_DIR


def build_backup_zip() -> BytesIO:
    buf = BytesIO()
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    with zipfile.ZipFile(buf, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        if DB_PATH.is_file():
            zf.write(DB_PATH, arcname="data/app.db")
        if PHOTOS_DIR.is_dir():
            for p in PHOTOS_DIR.rglob("*"):
                if p.is_file():
                    arc = p.relative_to(DATA_DIR).as_posix()
                    zf.write(p, arcname=f"data/{arc}")
        if EXPORTS_DIR.is_dir():
            files = sorted(EXPORTS_DIR.glob("*"), key=lambda x: x.stat().st_mtime, reverse=True)[:50]
            for p in files:
                if p.is_file() and p.stat().st_size < 5_000_000:
                    zf.write(p, arcname=f"data/exports/{p.name}")
        zf.writestr(
            "README_BACKUP.txt",
            f"Backup Baqaydgiri-Davotnoma {stamp}\n"
            "Restore: extract data/app.db and data/photos/ into project data/ folder.\n",
        )
    buf.seek(0)
    return buf


def backup_filename() -> str:
    return f"Baqaydgiri_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.zip"

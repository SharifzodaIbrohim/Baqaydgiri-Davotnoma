import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

ADMIN_USER = os.getenv("ADMIN_USER", "admin")
ADMIN_PASS = os.getenv("ADMIN_PASS", "admin123")
SECRET_KEY = os.getenv("SECRET_KEY", "baqaydgiri-davotnoma-dev-secret-change-me")
PORT = int(os.getenv("PORT", "5000"))
PASS_PERCENT = float(os.getenv("PASS_PERCENT", "70"))

DATA_DIR = BASE_DIR / "data"
PHOTOS_DIR = DATA_DIR / "photos"
EXPORTS_DIR = DATA_DIR / "exports"
DB_PATH = DATA_DIR / "app.db"
# BASE_DIR already defined above — re-export for server imports

# Ensure runtime folders exist
PHOTOS_DIR.mkdir(parents=True, exist_ok=True)
EXPORTS_DIR.mkdir(parents=True, exist_ok=True)

SUBJECTS = [
    "МАТЕМАТИКА",
    "Физика",
    "Химия",
    "Биология",
    "География",
    "Технологияи иттилоотӣ",
    "Забони давлатӣ",
    "Забон ва адабиёти рус",
    "Забон ва адабиёти тоҷик",
    "Забони русӣ",
    "Забони англисӣ",
    "ТАЪРИХ",
    "Ҳуқуқ",
]

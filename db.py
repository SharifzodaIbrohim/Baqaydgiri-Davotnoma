"""SQLite helpers for Бақайдгирӣ-Даъватнома."""
from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from config import DB_PATH


def _utc_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")


def init_db() -> None:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with get_conn() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS students (
                id TEXT PRIMARY KEY,
                last_name TEXT NOT NULL,
                first_name TEXT NOT NULL,
                patronymic TEXT DEFAULT '',
                birth_date TEXT DEFAULT '',
                address TEXT DEFAULT '',
                school TEXT NOT NULL,
                class_name TEXT NOT NULL,
                teacher TEXT DEFAULT '',
                gender TEXT NOT NULL,
                subject TEXT NOT NULL,
                olympiad_title TEXT DEFAULT '',
                olympiad_date TEXT DEFAULT '',
                photo_path TEXT DEFAULT '',
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS results (
                student_id TEXT PRIMARY KEY,
                score REAL,
                max_score REAL DEFAULT 100,
                percent REAL,
                status TEXT DEFAULT '',
                scored_at TEXT,
                FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_students_school ON students(school);
            CREATE INDEX IF NOT EXISTS idx_students_class ON students(class_name);
            CREATE INDEX IF NOT EXISTS idx_students_subject ON students(subject);
            """
        )


@contextmanager
def get_conn():
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def row_to_dict(row: sqlite3.Row | None) -> Optional[Dict[str, Any]]:
    if row is None:
        return None
    return dict(row)


def list_students() -> List[Dict[str, Any]]:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM students ORDER BY created_at DESC"
        ).fetchall()
        return [dict(r) for r in rows]


def get_student(student_id: str) -> Optional[Dict[str, Any]]:
    with get_conn() as conn:
        row = conn.execute(
            "SELECT * FROM students WHERE id = ?", (student_id,)
        ).fetchone()
        return row_to_dict(row)


def create_student(data: Dict[str, Any]) -> Dict[str, Any]:
    now = _utc_now()
    with get_conn() as conn:
        conn.execute(
            """
            INSERT INTO students (
                id, last_name, first_name, patronymic, birth_date, address,
                school, class_name, teacher, gender, subject,
                olympiad_title, olympiad_date, photo_path, created_at
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            """,
            (
                data["id"],
                data["last_name"],
                data["first_name"],
                data.get("patronymic") or "",
                data.get("birth_date") or "",
                data.get("address") or "",
                data["school"],
                data["class_name"],
                data.get("teacher") or "",
                data["gender"],
                data["subject"],
                data.get("olympiad_title") or "",
                data.get("olympiad_date") or "",
                data.get("photo_path") or "",
                now,
            ),
        )
        # empty results row
        conn.execute(
            "INSERT OR IGNORE INTO results (student_id) VALUES (?)",
            (data["id"],),
        )
    return get_student(data["id"])  # type: ignore


def delete_student(student_id: str) -> bool:
    with get_conn() as conn:
        cur = conn.execute("DELETE FROM students WHERE id = ?", (student_id,))
        return cur.rowcount > 0


def update_result(
    student_id: str,
    score: Optional[float],
    max_score: Optional[float] = 100,
    status: Optional[str] = None,
    pass_percent: float = 70.0,
) -> Optional[Dict[str, Any]]:
    if get_student(student_id) is None:
        return None
    max_s = float(max_score if max_score is not None else 100)
    percent = None
    if score is not None and max_s > 0:
        percent = round(float(score) / max_s * 100, 2)
        if status is None or status == "":
            status = "Гузашт" if percent >= pass_percent else "Нагузашт"
    now = _utc_now()
    with get_conn() as conn:
        conn.execute(
            """
            INSERT INTO results (student_id, score, max_score, percent, status, scored_at)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(student_id) DO UPDATE SET
                score = excluded.score,
                max_score = excluded.max_score,
                percent = excluded.percent,
                status = excluded.status,
                scored_at = excluded.scored_at
            """,
            (student_id, score, max_s, percent, status or "", now),
        )
    return get_result(student_id)


def get_result(student_id: str) -> Optional[Dict[str, Any]]:
    with get_conn() as conn:
        row = conn.execute(
            "SELECT * FROM results WHERE student_id = ?", (student_id,)
        ).fetchone()
        return row_to_dict(row)


def list_results(
    school: str = "",
    class_name: str = "",
    subject: str = "",
    olympiad: str = "",
    status: str = "",
    q: str = "",
) -> List[Dict[str, Any]]:
    sql = """
        SELECT
            s.id AS student_id,
            s.last_name, s.first_name, s.patronymic,
            s.school, s.class_name, s.gender, s.subject,
            s.olympiad_title, s.created_at,
            r.score, r.max_score, r.percent, r.status, r.scored_at
        FROM students s
        LEFT JOIN results r ON r.student_id = s.id
        WHERE 1=1
    """
    params: List[Any] = []
    if school:
        sql += " AND s.school LIKE ?"
        params.append(f"%{school}%")
    if class_name:
        sql += " AND s.class_name LIKE ?"
        params.append(f"%{class_name}%")
    if subject:
        sql += " AND s.subject = ?"
        params.append(subject)
    if olympiad:
        sql += " AND s.olympiad_title LIKE ?"
        params.append(f"%{olympiad}%")
    if status:
        sql += " AND COALESCE(r.status, '') = ?"
        params.append(status)
    if q:
        sql += """ AND (
            s.id LIKE ? OR s.last_name LIKE ? OR s.first_name LIKE ?
            OR s.patronymic LIKE ? OR (s.last_name || ' ' || s.first_name) LIKE ?
        )"""
        like = f"%{q}%"
        params.extend([like, like, like, like, like])
    sql += " ORDER BY s.created_at DESC"
    with get_conn() as conn:
        rows = conn.execute(sql, params).fetchall()
        return [dict(r) for r in rows]


def full_name(s: Dict[str, Any]) -> str:
    parts = [s.get("last_name") or "", s.get("first_name") or "", s.get("patronymic") or ""]
    return " ".join(p for p in parts if p).strip()

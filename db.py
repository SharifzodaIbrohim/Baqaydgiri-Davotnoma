"""SQLite helpers for Бақайдгирӣ-Даъватнома."""
from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional

from config import DB_PATH


def _utc_now() -> str:
    """Wall-clock time of this PC (offline school computer)."""
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


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
                created_at TEXT NOT NULL,
                present_at TEXT DEFAULT ''
            );
            CREATE TABLE IF NOT EXISTS results (
                student_id TEXT PRIMARY KEY REFERENCES students(id) ON DELETE CASCADE,
                score REAL,
                max_score REAL DEFAULT 100,
                percent REAL,
                status TEXT DEFAULT '',
                scored_at TEXT DEFAULT ''
            );
            CREATE TABLE IF NOT EXISTS attendance (
                student_id TEXT PRIMARY KEY,
                present_at TEXT NOT NULL,
                note TEXT DEFAULT '',
                FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
            );
            """
        )
        cols = [r[1] for r in conn.execute("PRAGMA table_info(students)").fetchall()]
        if "present_at" not in cols:
            conn.execute("ALTER TABLE students ADD COLUMN present_at TEXT DEFAULT ''")


@contextmanager
def get_conn():
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def row_to_dict(row: Optional[sqlite3.Row]) -> Optional[Dict[str, Any]]:
    if row is None:
        return None
    return dict(row)


def full_name(st: Dict[str, Any]) -> str:
    parts = [st.get("last_name") or "", st.get("first_name") or "", st.get("patronymic") or ""]
    return " ".join(p for p in parts if p).strip()


def get_student(student_id: str) -> Optional[Dict[str, Any]]:
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM students WHERE id = ?", (student_id,)).fetchone()
        return row_to_dict(row)


def list_students(q: str = "") -> List[Dict[str, Any]]:
    with get_conn() as conn:
        if q:
            like = f"%{q}%"
            rows = conn.execute(
                """
                SELECT * FROM students
                WHERE last_name LIKE ? OR first_name LIKE ? OR patronymic LIKE ?
                   OR id LIKE ? OR school LIKE ? OR class_name LIKE ?
                ORDER BY created_at DESC
                """,
                (like, like, like, like, like, like),
            ).fetchall()
        else:
            rows = conn.execute("SELECT * FROM students ORDER BY created_at DESC").fetchall()
        return [dict(r) for r in rows]


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
                data["id"], data["last_name"], data["first_name"],
                data.get("patronymic") or "", data.get("birth_date") or "",
                data.get("address") or "", data["school"], data["class_name"],
                data.get("teacher") or "", data["gender"], data["subject"],
                data.get("olympiad_title") or "", data.get("olympiad_date") or "",
                data.get("photo_path") or "", now,
            ),
        )
        conn.execute("INSERT OR IGNORE INTO results (student_id) VALUES (?)", (data["id"],))
    return get_student(data["id"])  # type: ignore


def delete_student(student_id: str) -> bool:
    with get_conn() as conn:
        cur = conn.execute("DELETE FROM students WHERE id = ?", (student_id,))
        return cur.rowcount > 0


def get_result(student_id: str) -> Optional[Dict[str, Any]]:
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM results WHERE student_id = ?", (student_id,)).fetchone()
        return row_to_dict(row)


def update_result(
    student_id: str,
    score: Optional[float],
    max_score: Optional[float] = 100,
    status: Optional[str] = None,
    pass_percent: float = 70.0,
) -> Optional[Dict[str, Any]]:
    """Status is MANUAL only — admin chooses. Never auto from score."""
    if get_student(student_id) is None:
        return None
    existing = get_result(student_id) or {}
    max_s = float(max_score if max_score is not None else (existing.get("max_score") or 100))
    if score is None and existing.get("score") is not None:
        score = existing.get("score")
    percent = None
    if score is not None and max_s > 0:
        percent = round(float(score) / max_s * 100, 2)
    if status is None:
        status = existing.get("status") or ""
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


def get_attendance(student_id: str) -> Optional[Dict[str, Any]]:
    with get_conn() as conn:
        row = conn.execute(
            "SELECT * FROM attendance WHERE student_id = ?", (student_id,)
        ).fetchone()
        return row_to_dict(row)


def mark_present(student_id: str, note: str = "") -> Optional[Dict[str, Any]]:
    return set_attendance(student_id, status="present", note=note)


def set_attendance(
    student_id: str,
    status: str = "present",
    note: str = "",
) -> Optional[Dict[str, Any]]:
    st = get_student(student_id)
    if not st:
        return None
    status = (status or "present").strip().lower()
    if status in ("ҳозир", "hozir", "yes", "1", "true", "present"):
        status = "present"
    elif status in ("ғоиб", "absent", "no", "0", "ҳозир нашуд"):
        status = "absent"
    elif status in ("", "unknown", "—", "-", "номаълум"):
        status = "unknown"

    with get_conn() as conn:
        if status == "unknown":
            conn.execute("DELETE FROM attendance WHERE student_id = ?", (student_id,))
            try:
                conn.execute("UPDATE students SET present_at = '' WHERE id = ?", (student_id,))
            except Exception:
                pass
            st["present_at"] = ""
            st["attendance_status"] = "unknown"
            return st

        if status == "present":
            now = _utc_now()
            att_note = note or "Ҳозир"
            conn.execute(
                """
                INSERT INTO attendance (student_id, present_at, note)
                VALUES (?, ?, ?)
                ON CONFLICT(student_id) DO UPDATE SET
                    present_at = excluded.present_at,
                    note = excluded.note
                """,
                (student_id, now, att_note),
            )
            try:
                conn.execute("UPDATE students SET present_at = ? WHERE id = ?", (now, student_id))
            except Exception:
                pass
            st["present_at"] = now
            st["attendance_status"] = "present"
            return st

        # absent
        conn.execute(
            """
            INSERT INTO attendance (student_id, present_at, note)
            VALUES (?, ?, ?)
            ON CONFLICT(student_id) DO UPDATE SET
                present_at = excluded.present_at,
                note = excluded.note
            """,
            (student_id, "", "Ҳозир нашуд"),
        )
        try:
            conn.execute("UPDATE students SET present_at = '' WHERE id = ?", (student_id,))
        except Exception:
            pass
        st["present_at"] = ""
        st["attendance_status"] = "absent"
        return st


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
            r.score, r.max_score, r.percent, r.status, r.scored_at,
            a.present_at AS present_at, a.note AS attendance_note
        FROM students s
        LEFT JOIN results r ON r.student_id = s.id
        LEFT JOIN attendance a ON a.student_id = s.id
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
        sql += " AND COALESCE(s.olympiad_title,'') LIKE ?"
        params.append(f"%{olympiad}%")
    if status:
        sql += " AND COALESCE(r.status, '') = ?"
        params.append(status)
    if q:
        sql += """ AND (
            s.last_name LIKE ? OR s.first_name LIKE ? OR s.patronymic LIKE ?
            OR s.id LIKE ? OR s.school LIKE ?
        )"""
        like = f"%{q}%"
        params.extend([like, like, like, like, like])
    sql += " ORDER BY s.last_name, s.first_name"
    with get_conn() as conn:
        rows = conn.execute(sql, params).fetchall()
        return [dict(r) for r in rows]


def student_with_status(student_id: str) -> Optional[Dict[str, Any]]:
    st = get_student(student_id)
    if not st:
        return None
    res = get_result(student_id) or {}
    st["score"] = res.get("score")
    st["max_score"] = res.get("max_score")
    st["percent"] = res.get("percent")
    st["status"] = res.get("status") or ""
    st["scored_at"] = res.get("scored_at") or ""
    att = get_attendance(student_id) or {}
    present_at = (att.get("present_at") or st.get("present_at") or "").strip()
    note = (att.get("note") or "").strip()
    if present_at:
        st["attendance_status"] = "present"
    elif note and ("нашуд" in note.lower() or note.lower() == "absent"):
        st["attendance_status"] = "absent"
    else:
        st["attendance_status"] = "unknown"
    st["present_at"] = present_at
    st["attendance_note"] = note
    return st

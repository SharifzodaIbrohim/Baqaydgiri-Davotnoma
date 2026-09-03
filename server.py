"""
Бақайдгирӣ-Даъватнома — offline Flask app.
Run: python server.py
Open: http://127.0.0.1:5000
"""
from __future__ import annotations

import os
import re
from pathlib import Path

from flask import (
    Flask,
    Response,
    jsonify,
    redirect,
    render_template,
    request,
    send_from_directory,
    session,
    url_for,
)

import config
import db
from utils.export_xlsx import build_results_xlsx
from utils.ids import generate_student_id
from utils.photos import save_photo_base64, save_photo_file

app = Flask(__name__)
app.secret_key = config.SECRET_KEY
app.config["MAX_CONTENT_LENGTH"] = 8 * 1024 * 1024  # 8 MB photos

# ---------------------------------------------------------------------------
# Auth helpers
# ---------------------------------------------------------------------------

def login_required(fn):
    from functools import wraps

    @wraps(fn)
    def wrapper(*args, **kwargs):
        if not session.get("admin"):
            if request.path.startswith("/api/"):
                return jsonify({"ok": False, "error": "Логин лозим аст"}), 401
            return redirect(url_for("login_page"))
        return fn(*args, **kwargs)

    return wrapper


# ---------------------------------------------------------------------------
# Pages
# ---------------------------------------------------------------------------

@app.route("/")
@app.route("/login")
def login_page():
    if session.get("admin"):
        return redirect(url_for("admin_page"))
    return render_template("login.html")


@app.route("/admin")
@login_required
def admin_page():
    return render_template("admin.html", subjects=config.SUBJECTS)


# ---------------------------------------------------------------------------
# Auth API
# ---------------------------------------------------------------------------

@app.route("/api/login", methods=["POST"])
def api_login():
    data = request.get_json(silent=True) or {}
    user = (data.get("username") or "").strip()
    password = data.get("password") or ""
    if user == config.ADMIN_USER and password == config.ADMIN_PASS:
        session["admin"] = True
        return jsonify({"ok": True})
    return jsonify({"ok": False, "error": "Номи корбар ё парол нодуруст"}), 401


@app.route("/api/logout", methods=["POST"])
def api_logout():
    session.clear()
    return jsonify({"ok": True})


# ---------------------------------------------------------------------------
# Students API
# ---------------------------------------------------------------------------

@app.route("/api/students", methods=["GET"])
@login_required
def api_students_list():
    students = db.list_students()
    return jsonify({"ok": True, "students": students})


@app.route("/api/students", methods=["POST"])
@login_required
def api_students_create():
    data = request.get_json(silent=True) or {}
    # Required fields validation
    required = [
        "full_name", "school", "class_name", "gender",
        "subject", "olympiad_type", "teacher", "region"
    ]
    for key in required:
        if not (data.get(key) or "").strip():
            return jsonify({"ok": False, "error": f"Майдони {key} лозим аст"}), 400

    student_id = generate_student_id()
    photo_path = None

    # Photo: base64 or already handled
    photo_b64 = data.get("photo_base64")
    if photo_b64:
        try:
            photo_path = save_photo_base64(student_id, photo_b64)
        except Exception as e:
            return jsonify({"ok": False, "error": f"Хатои сурат: {e}"}), 400

    student = {
        "id": student_id,
        "full_name": data["full_name"].strip(),
        "school": data["school"].strip(),
        "class_name": data["class_name"].strip(),
        "gender": data["gender"].strip(),
        "subject": data["subject"].strip(),
        "olympiad_type": data["olympiad_type"].strip(),
        "teacher": data["teacher"].strip(),
        "region": data.get("region", "").strip(),
        "district": data.get("district", "").strip(),
        "phone": data.get("phone", "").strip(),
        "birth_year": data.get("birth_year", "").strip(),
        "notes": data.get("notes", "").strip(),
        "photo_path": photo_path or "",
    }

    try:
        db.create_student(student)
        return jsonify({"ok": True, "student": db.get_student(student_id)})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500


@app.route("/api/students/<student_id>", methods=["DELETE"])
@login_required
def api_students_delete(student_id):
    ok = db.delete_student(student_id)
    if not ok:
        return jsonify({"ok": False, "error": "Хонанда ёфт нашуд"}), 404
    return jsonify({"ok": True})


# ---------------------------------------------------------------------------
# Davotnoma & Exam sheet
# ---------------------------------------------------------------------------

@app.route("/api/students/<student_id>/davotnoma")
@login_required
def api_davotnoma(student_id):
    student = db.get_student(student_id)
    if not student:
        return jsonify({"ok": False, "error": "Хонанда ёфт нашуд"}), 404
    return render_template(
        "davotnoma.html",
        student=student,
        for_save=False,
        logo_left_uri=None,
        logo_right_uri=None,
    )


@app.route("/api/students/<student_id>/exam-sheet")
@login_required
def api_exam_sheet(student_id):
    student = db.get_student(student_id)
    if not student:
        return jsonify({"ok": False, "error": "Хонанда ёфт нашуд"}), 404
    return render_template("exam_sheet.html", student=student)


@app.route("/api/students/<student_id>/save-local", methods=["POST"])
@login_required
def api_save_local(student_id):
    student = db.get_student(student_id)
    if not student:
        return jsonify({"ok": False, "error": "Хонанда ёфт нашуд"}), 404

    # Prepare base64 logos for offline HTML if present
    import base64
    logo_left_uri = logo_right_uri = None
    left_path = config.BASE_DIR / "static" / "img" / "logo-left.jpg"
    right_path = config.BASE_DIR / "static" / "img" / "logo-right.jpg"
    if left_path.exists():
        b64 = base64.b64encode(left_path.read_bytes()).decode("ascii")
        logo_left_uri = f"data:image/jpeg;base64,{b64}"
    if right_path.exists():
        b64 = base64.b64encode(right_path.read_bytes()).decode("ascii")
        logo_right_uri = f"data:image/jpeg;base64,{b64}"

    # Render davotnoma
    davotnoma_html = render_template(
        "davotnoma.html",
        student=student,
        for_save=True,
        logo_left_uri=logo_left_uri,
        logo_right_uri=logo_right_uri,
    )
    # Render exam sheet
    exam_html = render_template("exam_sheet.html", student=student)

    safe_name = re.sub(r"[^\w\u0400-\u04FF\-]+", "_", student["full_name"])[:40]
    safe_subj = re.sub(r"[^\w\u0400-\u04FF\-]+", "_", student["subject"])[:30]

    dav_path = config.EXPORTS_DIR / f"Davotnoma_{student_id}_{safe_name}.html"
    exam_path = config.EXPORTS_DIR / f"ExamSheet_{student_id}_{safe_subj}.html"

    dav_path.write_text(davotnoma_html, encoding="utf-8")
    exam_path.write_text(exam_html, encoding="utf-8")

    return jsonify({
        "ok": True,
        "davotnoma": str(dav_path.name),
        "exam_sheet": str(exam_path.name),
        "dir": str(config.EXPORTS_DIR),
    })


# ---------------------------------------------------------------------------
# Results API
# ---------------------------------------------------------------------------

@app.route("/api/results")
@login_required
def api_results():
    filters = {
        "school": request.args.get("school", "").strip(),
        "class_name": request.args.get("class", "").strip(),
        "subject": request.args.get("subject", "").strip(),
        "olympiad": request.args.get("olympiad", "").strip(),
        "status": request.args.get("status", "").strip(),
        "q": request.args.get("q", "").strip(),
    }
    rows = db.list_results(filters)
    return jsonify({"ok": True, "results": rows})


@app.route("/api/results/<student_id>", methods=["PUT"])
@login_required
def api_results_update(student_id):
    data = request.get_json(silent=True) or {}
    score = data.get("score")
    max_score = data.get("maxScore") or data.get("max_score")
    if score is None or max_score is None:
        return jsonify({"ok": False, "error": "score ва maxScore лозиманд"}), 400
    try:
        score = float(score)
        max_score = float(max_score)
    except (TypeError, ValueError):
        return jsonify({"ok": False, "error": "Хол бояд рақам бошад"}), 400

    percent = round((score / max_score) * 100, 2) if max_score else 0
    status = "Гузашт" if percent >= config.PASS_PERCENT else "Нагузашт"

    ok = db.update_result(student_id, score, max_score, percent, status)
    if not ok:
        return jsonify({"ok": False, "error": "Хонанда ёфт нашуд"}), 404
    return jsonify({
        "ok": True,
        "percent": percent,
        "status": status,
    })


@app.route("/api/results/export.xlsx")
@login_required
def api_results_export():
    filters = {
        "school": request.args.get("school", "").strip(),
        "class_name": request.args.get("class", "").strip(),
        "subject": request.args.get("subject", "").strip(),
        "olympiad": request.args.get("olympiad", "").strip(),
        "status": request.args.get("status", "").strip(),
        "q": request.args.get("q", "").strip(),
    }
    rows = db.list_results(filters)
    xlsx_bytes = build_results_xlsx(rows)
    return Response(
        xlsx_bytes,
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": "attachment; filename=results.xlsx"
        },
    )


# ---------------------------------------------------------------------------
# Static photos
# ---------------------------------------------------------------------------

@app.route("/data/photos/<path:filename>")
@login_required
def serve_photo(filename):
    return send_from_directory(config.PHOTOS_DIR, filename)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    db.init_db()
    print(f"Baqaydgiri-Davotnoma → http://127.0.0.1:{config.PORT}")
    app.run(host="127.0.0.1", port=config.PORT, debug=False)

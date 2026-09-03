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
def index():
    if session.get("admin"):
        return redirect(url_for("admin_page"))
    return redirect(url_for("login_page"))


@app.route("/login")
def login_page():
    if session.get("admin"):
        return redirect(url_for("admin_page"))
    return render_template("login.html")


@app.route("/admin")
@login_required
def admin_page():
    return render_template(
        "admin.html",
        subjects=config.SUBJECTS,
        pass_percent=config.PASS_PERCENT,
    )


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
        session.permanent = True
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
def api_list_students():
    return jsonify({"ok": True, "students": db.list_students()})


@app.route("/api/students", methods=["POST"])
@login_required
def api_create_student():
    # Support both JSON (base64 photo) and multipart
    if request.content_type and "multipart/form-data" in request.content_type:
        form = request.form
        data = {k: (form.get(k) or "").strip() for k in (
            "last_name", "first_name", "patronymic", "birth_date", "address",
            "school", "class_name", "teacher", "gender", "subject",
            "olympiad_title", "olympiad_date",
        )}
        photo_file = request.files.get("photo")
        photo_b64 = (form.get("photo_base64") or "").strip()
    else:
        body = request.get_json(silent=True) or {}
        data = {k: (body.get(k) or "").strip() for k in (
            "last_name", "first_name", "patronymic", "birth_date", "address",
            "school", "class_name", "teacher", "gender", "subject",
            "olympiad_title", "olympiad_date",
        )}
        photo_file = None
        photo_b64 = (body.get("photo_base64") or body.get("photo") or "").strip()

    required = ["last_name", "first_name", "school", "class_name", "gender", "subject"]
    missing = [f for f in required if not data.get(f)]
    if missing:
        return jsonify({"ok": False, "error": f"Майдонҳои ҳатмӣ: {', '.join(missing)}"}), 400
    if data["gender"] not in ("Мард", "Зан"):
        return jsonify({"ok": False, "error": "Ҷинс бояд Мард ё Зан бошад"}), 400
    if data["subject"] not in config.SUBJECTS:
        return jsonify({"ok": False, "error": "Фанни нодуруст"}), 400

    # Unique ID
    for _ in range(20):
        sid = generate_student_id(18)
        if db.get_student(sid) is None:
            break
    else:
        return jsonify({"ok": False, "error": "ID-и уникалӣ сохта нашуд"}), 500

    data["id"] = sid
    photo_path = None
    if photo_file and photo_file.filename:
        photo_path = save_photo_file(sid, photo_file)
    elif photo_b64:
        photo_path = save_photo_base64(sid, photo_b64)
    data["photo_path"] = photo_path or ""

    student = db.create_student(data)
    return jsonify({"ok": True, "student": student})


@app.route("/api/students/<student_id>", methods=["DELETE"])
@login_required
def api_delete_student(student_id: str):
    st = db.get_student(student_id)
    if not st:
        return jsonify({"ok": False, "error": "Ёфт нашуд"}), 404
    # remove photo file
    if st.get("photo_path"):
        p = config.DATA_DIR / st["photo_path"]
        if p.is_file():
            try:
                p.unlink()
            except OSError:
                pass
    db.delete_student(student_id)
    return jsonify({"ok": True})


@app.route("/api/students/<student_id>/davotnoma")
@login_required
def api_davotnoma(student_id: str):
    st = db.get_student(student_id)
    if not st:
        return "Хонанда ёфт нашуд", 404
    return render_template(
        "davotnoma.html",
        s=st,
        full_name=db.full_name(st),
    )


@app.route("/api/students/<student_id>/exam-sheet")
@login_required
def api_exam_sheet(student_id: str):
    st = db.get_student(student_id)
    if not st:
        return "Хонанда ёфт нашуд", 404
    return render_template("exam_sheet.html", s=st)


def _file_data_uri(path: Path, mime: str) -> str:
    import base64

    if not path.is_file():
        return ""
    b64 = base64.b64encode(path.read_bytes()).decode("ascii")
    return f"data:{mime};base64,{b64}"


@app.route("/api/students/<student_id>/save-local", methods=["POST"])
@login_required
def api_save_local(student_id: str):
    """Render both sheets as self-contained HTML into data/exports/."""
    st = db.get_student(student_id)
    if not st:
        return jsonify({"ok": False, "error": "Ёфт нашуд"}), 404

    name_safe = re.sub(r'[\\/:*?"<>|]+', "_", db.full_name(st) or student_id)[:50]
    subj_safe = re.sub(r'[\\/:*?"<>|]+', "_", st.get("subject") or "fan")[:40]

    css_text = (config.BASE_DIR / "static" / "css" / "davotnoma.css").read_text(
        encoding="utf-8"
    )
    logo_left = _file_data_uri(config.BASE_DIR / "static" / "img" / "logo-left.jpg", "image/jpeg")
    logo_right = _file_data_uri(config.BASE_DIR / "static" / "img" / "logo-right.jpg", "image/jpeg")
    photo_uri = ""
    if st.get("photo_path"):
        photo_abs = config.DATA_DIR / st["photo_path"]
        # photo_path is like "photos/xxx.jpg"
        if not photo_abs.is_file():
            photo_abs = config.BASE_DIR / "data" / st["photo_path"]
        ext = photo_abs.suffix.lower().lstrip(".") or "jpeg"
        mime = "image/jpeg" if ext in ("jpg", "jpeg") else f"image/{ext}"
        photo_uri = _file_data_uri(photo_abs, mime)

    dav_html = render_template(
        "davotnoma.html",
        s=st,
        full_name=db.full_name(st),
        for_save=True,
        inline_css=css_text,
        logo_left_uri=logo_left,
        logo_right_uri=logo_right,
        photo_uri=photo_uri,
    )
    exam_html = render_template("exam_sheet.html", s=st, for_save=True)

    dav_name = f"Davotnoma_{student_id}_{name_safe}.html"
    exam_name = f"ExamSheet_{student_id}_{subj_safe}.html"
    dav_path = config.EXPORTS_DIR / dav_name
    exam_path = config.EXPORTS_DIR / exam_name
    dav_path.write_text(dav_html, encoding="utf-8")
    exam_path.write_text(exam_html, encoding="utf-8")

    return jsonify({
        "ok": True,
        "files": [dav_name, exam_name],
        "dir": str(config.EXPORTS_DIR),
    })


# ---------------------------------------------------------------------------
# Results API
# ---------------------------------------------------------------------------

@app.route("/api/results")
@login_required
def api_results():
    rows = db.list_results(
        school=request.args.get("school", "").strip(),
        class_name=request.args.get("class", "").strip(),
        subject=request.args.get("subject", "").strip(),
        olympiad=request.args.get("olympiad", "").strip(),
        status=request.args.get("status", "").strip(),
        q=request.args.get("q", "").strip(),
    )
    return jsonify({"ok": True, "results": rows})


@app.route("/api/results/<student_id>", methods=["PUT"])
@login_required
def api_update_result(student_id: str):
    body = request.get_json(silent=True) or {}
    score = body.get("score")
    max_score = body.get("maxScore", body.get("max_score", 100))
    status = body.get("status")
    if score is not None and score != "":
        try:
            score = float(score)
        except (TypeError, ValueError):
            return jsonify({"ok": False, "error": "Хол рақам бошад"}), 400
    else:
        score = None
    if max_score is not None and max_score != "":
        try:
            max_score = float(max_score)
        except (TypeError, ValueError):
            max_score = 100
    else:
        max_score = 100

    res = db.update_result(
        student_id,
        score=score,
        max_score=max_score,
        status=status,
        pass_percent=config.PASS_PERCENT,
    )
    if res is None:
        return jsonify({"ok": False, "error": "Хонанда ёфт нашуд"}), 404
    return jsonify({"ok": True, "result": res})


@app.route("/api/results/export.xlsx")
@login_required
def api_export_xlsx():
    rows = db.list_results(
        school=request.args.get("school", "").strip(),
        class_name=request.args.get("class", "").strip(),
        subject=request.args.get("subject", "").strip(),
        olympiad=request.args.get("olympiad", "").strip(),
        status=request.args.get("status", "").strip(),
        q=request.args.get("q", "").strip(),
    )
    buf = build_results_xlsx(rows)
    return Response(
        buf.getvalue(),
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": 'attachment; filename="Natijaho.xlsx"',
        },
    )


# ---------------------------------------------------------------------------
# Static photo serve
# ---------------------------------------------------------------------------

@app.route("/data/photos/<path:filename>")
@login_required
def serve_photo(filename: str):
    return send_from_directory(config.PHOTOS_DIR, filename)


# ---------------------------------------------------------------------------
# Boot
# ---------------------------------------------------------------------------

def main():
    db.init_db()
    print("=" * 50)
    print("  Бақайдгирӣ-Даъватнома  (offline)")
    print(f"  http://127.0.0.1:{config.PORT}")
    print(f"  Login: {config.ADMIN_USER} / (see .env)")
    print("=" * 50)
    app.run(host="127.0.0.1", port=config.PORT, debug=False)


if __name__ == "__main__":
    main()

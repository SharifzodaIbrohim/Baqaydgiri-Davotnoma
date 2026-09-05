# -*- coding: utf-8 -*-
"""One-time: python patch_scan.py  then restart server"""
from pathlib import Path

p = Path(__file__).resolve().parent / "server.py"
t = p.read_text(encoding="utf-8")
changed = False

if "from utils.qr_gen import" not in t:
    t = t.replace(
        "from utils.dates import format_tj_date",
        "from utils.dates import format_tj_date\nfrom utils.qr_gen import qr_data_uri\n",
    )
    changed = True
    print("+ qr_gen import")

SCAN_BLOCK = r'''
# --- Scanner API ---
@app.route("/api/scan/<student_id>")
@login_required
def api_scan(student_id: str):
    st = db.student_with_status(student_id.strip()) if hasattr(db, "student_with_status") else db.get_student(student_id.strip())
    if not st:
        return jsonify({"ok": False, "error": "Хонанда бо ин ID ёфт нашуд"}), 404
    if hasattr(db, "get_result"):
        res = db.get_result(student_id.strip()) or {}
        for k in ("score", "max_score", "percent", "status", "scored_at"):
            if k not in st:
                st[k] = res.get(k)
    photo_url = ""
    if st.get("photo_path"):
        pp = str(st["photo_path"]).replace("\\", "/")
        photo_url = "/data/" + pp if pp.startswith("photos/") else "/data/photos/" + pp.split("/")[-1]
    st["photo_url"] = photo_url
    return jsonify({"ok": True, "student": st})

@app.route("/api/attendance/<student_id>", methods=["POST"])
@login_required
def api_attendance(student_id: str):
    body = request.get_json(silent=True) or {}
    note = (body.get("note") or "").strip()
    if not hasattr(db, "mark_present"):
        return jsonify({"ok": False, "error": "mark_present нест"}), 500
    try:
        st = db.mark_present(student_id.strip(), note=note)
    except TypeError:
        st = db.mark_present(student_id.strip())
    if not st:
        return jsonify({"ok": False, "error": "Хонанда ёфт нашуд"}), 404
    return jsonify({"ok": True, "student": st, "present_at": st.get("present_at")})

@app.route("/api/qr/<student_id>.png")
@login_required
def api_qr_png(student_id: str):
    from flask import make_response
    import base64
    try:
        uri = qr_data_uri(str(student_id).strip())
    except Exception:
        uri = ""
    if not uri or not str(uri).startswith("data:image/png;base64,"):
        return "QR unavailable", 503
    raw = base64.b64decode(str(uri).split(",", 1)[1])
    resp = make_response(raw)
    resp.headers["Content-Type"] = "image/png"
    return resp
'''

if "/api/scan/" not in t:
    if '@app.route("/data/photos/' in t:
        t = t.replace('@app.route("/data/photos/', SCAN_BLOCK + '\n@app.route("/data/photos/', 1)
    elif "def main():" in t:
        t = t.replace("def main():", SCAN_BLOCK + "\ndef main():", 1)
    else:
        t += "\n" + SCAN_BLOCK
    changed = True
    print("+ /api/scan")
else:
    print("= scan already there")

if 'host="127.0.0.1"' in t:
    t = t.replace('host="127.0.0.1"', 'host=os.getenv("HOST", "0.0.0.0")')
    changed = True
    print("+ host 0.0.0.0")

if changed:
    p.write_text(t, encoding="utf-8")
    print("SAVED server.py — restart python server.py")
else:
    print("OK no change")

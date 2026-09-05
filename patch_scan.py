# -*- coding: utf-8 -*-
"""Run once:  python patch_scan.py
Adds /api/scan and /api/attendance to server.py if missing.
"""
from pathlib import Path

root = Path(__file__).resolve().parent
p = root / "server.py"
t = p.read_text(encoding="utf-8")
changed = False

HOOK = '''
try:
    from utils.scan_routes import register_scan_routes
    _has_scan = any("/api/scan/" in str(r) for r in app.url_map.iter_rules())
    if not _has_scan:
        register_scan_routes(app, login_required, db, jsonify, request)
        print("Registered /api/scan routes")
except Exception as _e:
    print("scan_routes load:", _e)
'''

if "register_scan_routes" not in t:
    if "\ndef main():" in t:
        t = t.replace("\ndef main():", "\n" + HOOK + "\n\ndef main():", 1)
        changed = True
        print("+ hook register_scan_routes before main()")
    elif "if __name__" in t:
        t = t.replace("if __name__", HOOK + "\n\nif __name__", 1)
        changed = True
        print("+ hook before __main__")
    else:
        t = t + "\n" + HOOK
        changed = True
        print("+ hook at end")
else:
    print("= register_scan_routes already in server.py")

if "from utils.qr_gen import" not in t and "from utils.dates import format_tj_date" in t:
    t = t.replace(
        "from utils.dates import format_tj_date",
        "from utils.dates import format_tj_date\nfrom utils.qr_gen import qr_data_uri",
    )
    changed = True
    print("+ qr_gen import")

if 'host="127.0.0.1"' in t:
    t = t.replace('host="127.0.0.1"', 'host=__import__("os").getenv("HOST", "0.0.0.0")')
    changed = True
    print("+ host 0.0.0.0")

if changed:
    p.write_text(t, encoding="utf-8")
    print("SAVED server.py")
else:
    print("server.py OK")

# Ensure utils/scan_routes.py exists
sr = root / "utils" / "scan_routes.py"
if not sr.is_file():
    sr.write_text(
        'def register_scan_routes(app, login_required, db, jsonify, request):\n'
        '    @app.route("/api/scan/<student_id>")\n'
        '    @login_required\n'
        '    def api_scan(student_id: str):\n'
        '        st = db.get_student(student_id.strip())\n'
        '        if not st:\n'
        '            return jsonify({"ok": False, "error": "Ёфт нашуд"}), 404\n'
        '        st["photo_url"] = ""\n'
        '        return jsonify({"ok": True, "student": st})\n'
        '    @app.route("/api/attendance/<student_id>", methods=["POST"])\n'
        '    @login_required\n'
        '    def api_attendance(student_id: str):\n'
        '        return jsonify({"ok": False, "error": "mark_present нест"}), 500\n',
        encoding="utf-8",
    )
    print("+ created utils/scan_routes.py")
else:
    print("= utils/scan_routes.py exists")

print("DONE — restart: python server.py")
print("Test: http://127.0.0.1:5000/api/scan/YOUR_ID")

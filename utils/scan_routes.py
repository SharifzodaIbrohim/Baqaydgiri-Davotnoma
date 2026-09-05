# Scan / attendance routes (loaded by server or patch_scan)
def register_scan_routes(app, login_required, db, jsonify, request):
    @app.route("/api/scan/<student_id>")
    @login_required
    def api_scan(student_id: str):
        if hasattr(db, "student_with_status"):
            st = db.student_with_status(student_id.strip())
        else:
            st = db.get_student(student_id.strip())
        if not st:
            return jsonify({"ok": False, "error": "Хонанда бо ин ID ёфт нашуд"}), 404
        if hasattr(db, "get_result") and st.get("score") is None and "score" not in st:
            res = db.get_result(student_id.strip()) or {}
            for k in ("score", "max_score", "percent", "status", "scored_at"):
                if k not in st or st.get(k) is None:
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
        status = (body.get("status") or "present").strip()
        if hasattr(db, "set_attendance"):
            st = db.set_attendance(student_id.strip(), status=status, note=note)
        elif hasattr(db, "mark_present"):
            try:
                st = db.mark_present(student_id.strip(), note=note)
            except TypeError:
                st = db.mark_present(student_id.strip())
        else:
            return jsonify({"ok": False, "error": "attendance API нест"}), 500
        if not st:
            return jsonify({"ok": False, "error": "Хонанда ёфт нашуд"}), 404
        return jsonify({
            "ok": True,
            "student": st,
            "present_at": st.get("present_at"),
            "attendance_status": st.get("attendance_status"),
        })

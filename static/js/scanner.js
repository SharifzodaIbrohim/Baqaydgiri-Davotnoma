/* Scanner: compact UI, attendance select, manual status */
(function () {
  "use strict";
  if (!document.getElementById("tab-scan")) return;

  let currentId = null, camStream = null, scanTimer = null, lastScanAt = 0, lastScannedId = "";

  const idInput = document.getElementById("scanIdInput");
  const btnLookup = document.getElementById("btnScanLookup");
  const camSelect = document.getElementById("scanCameraSelect");
  const video = document.getElementById("scanVideo");
  const canvas = document.getElementById("scanCanvas");
  const btnCamStart = document.getElementById("btnScanCamStart");
  const btnCamStop = document.getElementById("btnScanCamStop");
  const camStatus = document.getElementById("scanCamStatus");
  const emptyEl = document.getElementById("scanEmpty");
  const resultEl = document.getElementById("scanResult");
  const scanName = document.getElementById("scanName");
  const scanIdEl = document.getElementById("scanId");
  const scanMeta = document.getElementById("scanMeta");
  const presentBadge = document.getElementById("scanPresentBadge");
  const scanPhoto = document.getElementById("scanPhoto");
  const scanScore = document.getElementById("scanScore");
  const scanStatusSelect = document.getElementById("scanStatusSelect");
  const scanAttendSelect = document.getElementById("scanAttendSelect");
  const scanScoreMsg = document.getElementById("scanScoreMsg");

  function setStatus(msg) { if (camStatus) camStatus.textContent = msg || ""; }
  function getJsQR() {
    if (typeof window.jsQR === "function") return window.jsQR;
    if (typeof jsQR === "function") return jsQR;
    return null;
  }
  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = src; s.async = true;
      s.onload = function () { resolve(src); };
      s.onerror = function () { reject(new Error(src)); };
      document.head.appendChild(s);
    });
  }
  async function ensureJsQR() {
    if (getJsQR()) return true;
    var urls = [
      "https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js",
      "https://unpkg.com/jsqr@1.4.0/dist/jsQR.js",
      "/static/js/vendor/jsQR.js"
    ];
    for (var i = 0; i < urls.length; i++) {
      try {
        await loadScript(urls[i]);
        if (getJsQR()) return true;
      } catch (e) {}
    }
    setStatus("jsQR бор нашуд");
    return false;
  }
  function extractId(raw) {
    if (!raw) return "";
    var s = String(raw).trim();
    if (/^\d{10,24}$/.test(s)) return s;
    var m = s.match(/(?:\/scan\/|\/students\/|id[=:])(\d{10,24})/i);
    if (m) return m[1];
    var m2 = s.match(/(\d{12,24})/);
    return m2 ? m2[1] : s.replace(/\s+/g, "");
  }

  async function lookup(idRaw) {
    var id = extractId(idRaw);
    if (!id) { alert("ID-ро нависед ё QR скан кунед"); return; }
    if (idInput) idInput.value = id;
    try {
      var res = await fetch("/api/scan/" + encodeURIComponent(id));
      var text = await res.text();
      var data;
      try { data = JSON.parse(text); }
      catch (e) {
        showEmpty("Роут /api/scan нест — python patch_scan.py");
        return;
      }
      if (!data.ok) {
        showEmpty(data.error || "Ёфт нашуд");
        return;
      }
      showStudent(data.student);
      setStatus("Хонда шуд: " + id);
    } catch (e) {
      showEmpty("Хато: " + e.message);
    }
  }

  function attendLabel(st) {
    var a = (st.attendance_status || "").toLowerCase();
    if (a === "present" || st.present_at) return { text: "Ҳозир: " + (st.present_at || "✓"), cls: "pill-badge pill-attend-present", val: "present" };
    if (a === "absent") return { text: "Ҳозир нашуд", cls: "pill-badge pill-attend-absent", val: "absent" };
    return { text: "— номаълум —", cls: "pill-badge pill-attend-unknown", val: "unknown" };
  }

  function showEmpty(msg) {
    currentId = null;
    if (emptyEl) { emptyEl.hidden = false; emptyEl.textContent = msg || "ID скан/нависед"; }
    if (resultEl) resultEl.hidden = true;
  }

  function showStudent(s) {
    currentId = s.id;
    if (emptyEl) emptyEl.hidden = true;
    if (resultEl) resultEl.hidden = false;
    if (scanName) scanName.textContent = [s.last_name, s.first_name, s.patronymic].filter(Boolean).join(" ");
    if (scanIdEl) scanIdEl.textContent = s.id;
    if (scanMeta) scanMeta.textContent = (s.school || "") + " · " + (s.class_name || "") + " · " + (s.subject || "");
    var att = attendLabel(s);
    if (presentBadge) {
      presentBadge.textContent = att.text;
      presentBadge.className = att.cls;
    }
    if (scanAttendSelect) scanAttendSelect.value = att.val;
    if (scanPhoto) {
      if (s.photo_url) { scanPhoto.src = s.photo_url; scanPhoto.hidden = false; }
      else scanPhoto.hidden = true;
    }
    if (scanScore) scanScore.value = s.score != null ? s.score : "";
    if (scanStatusSelect) scanStatusSelect.value = s.status || "";
    if (scanScoreMsg) scanScoreMsg.textContent = "";
  }

  if (btnLookup) btnLookup.addEventListener("click", function () { lookup(idInput ? idInput.value : ""); });
  if (idInput) idInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") { e.preventDefault(); lookup(idInput.value); }
  });

  var btnMark = document.getElementById("btnMarkPresent");
  if (btnMark) btnMark.addEventListener("click", async function () {
    if (!currentId) return;
    var status = scanAttendSelect ? scanAttendSelect.value : "present";
    try {
      var res = await fetch("/api/attendance/" + encodeURIComponent(currentId), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: status }),
      });
      var data = await res.json();
      if (!data.ok) { alert(data.error || "Хато"); return; }
      var st = data.student || {};
      st.attendance_status = data.attendance_status || status;
      st.present_at = data.present_at || st.present_at || "";
      var att = attendLabel(st);
      if (presentBadge) { presentBadge.textContent = att.text; presentBadge.className = att.cls; }
      if (scanAttendSelect) scanAttendSelect.value = att.val;
    } catch (e) { alert(e.message); }
  });

  var btnOpenExam = document.getElementById("btnOpenExam");
  if (btnOpenExam) btnOpenExam.addEventListener("click", function () {
    if (currentId) window.open("/api/students/" + encodeURIComponent(currentId) + "/exam-sheet", "_blank");
  });
  var btnOpenDav = document.getElementById("btnOpenDav");
  if (btnOpenDav) btnOpenDav.addEventListener("click", function () {
    if (currentId) window.open("/api/students/" + encodeURIComponent(currentId) + "/davotnoma", "_blank");
  });

  var btnSaveScore = document.getElementById("btnSaveScanScore");
  if (btnSaveScore) btnSaveScore.addEventListener("click", async function () {
    if (!currentId) return;
    var score = scanScore && scanScore.value !== "" ? Number(scanScore.value) : null;
    var status = scanStatusSelect ? scanStatusSelect.value : "";
    try {
      var res = await fetch("/api/results/" + encodeURIComponent(currentId), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ score: score, maxScore: 100, status: status }),
      });
      var data = await res.json();
      if (!data.ok) {
        if (scanScoreMsg) scanScoreMsg.textContent = data.error || "Хато";
        return;
      }
      if (scanScoreMsg) scanScoreMsg.textContent = "Захира шуд" + (data.result && data.result.status ? " · " + data.result.status : "");
      if (scanStatusSelect && data.result) scanStatusSelect.value = data.result.status || "";
    } catch (e) {
      if (scanScoreMsg) scanScoreMsg.textContent = e.message;
    }
  });

  async function listCameras() {
    if (!navigator.mediaDevices) return;
    try {
      var devices = await navigator.mediaDevices.enumerateDevices();
      var cams = devices.filter(function (d) { return d.kind === "videoinput"; });
      if (!camSelect) return;
      var prev = camSelect.value;
      camSelect.innerHTML = "";
      cams.forEach(function (d, i) {
        var o = document.createElement("option");
        o.value = d.deviceId;
        o.textContent = d.label || ("Камера " + (i + 1));
        camSelect.appendChild(o);
      });
      if (prev) camSelect.value = prev;
    } catch (e) {}
  }

  function stopCamera() {
    if (scanTimer) { cancelAnimationFrame(scanTimer); scanTimer = null; }
    if (camStream) { camStream.getTracks().forEach(function (t) { t.stop(); }); camStream = null; }
    if (video) video.srcObject = null;
    setStatus("Камера хомӯш");
  }

  async function startCamera() {
    stopCamera();
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setStatus("Chrome/Edge лозим аст");
      return;
    }
    if (!(await ensureJsQR())) return;
    setStatus("Камера…");
    try {
      var constraints = { audio: false, video: { facingMode: { ideal: "environment" }, width: { ideal: 640 }, height: { ideal: 480 } } };
      if (camSelect && camSelect.value) {
        constraints.video = { deviceId: { exact: camSelect.value }, width: { ideal: 640 }, height: { ideal: 480 } };
      }
      camStream = await navigator.mediaDevices.getUserMedia(constraints);
      video.srcObject = camStream;
      video.setAttribute("playsinline", "true");
      video.muted = true;
      await video.play();
      await listCameras();
      setStatus("QR-ро нишон диҳед…");
      lastScannedId = "";
      tick();
    } catch (e) {
      setStatus("Камера: " + (e.message || e.name));
    }
  }

  function tick() {
    if (!camStream || !video) return;
    var decoder = getJsQR();
    if (!decoder) return;
    if (video.readyState >= 2 && video.videoWidth > 0) {
      try {
        var maxW = 480, vw = video.videoWidth, vh = video.videoHeight;
        var scale = vw > maxW ? maxW / vw : 1;
        var w = Math.max(1, Math.floor(vw * scale));
        var h = Math.max(1, Math.floor(vh * scale));
        canvas.width = w; canvas.height = h;
        var ctx = canvas.getContext("2d", { willReadFrequently: true });
        ctx.drawImage(video, 0, 0, w, h);
        var img = ctx.getImageData(0, 0, w, h);
        var code = decoder(img.data, img.width, img.height, { inversionAttempts: "attemptBoth" });
        if (code && code.data) {
          var id = extractId(code.data);
          var now = Date.now();
          if (id && (id !== lastScannedId || now - lastScanAt > 2500)) {
            lastScanAt = now; lastScannedId = id;
            setStatus("QR: " + id);
            lookup(id);
          }
        }
      } catch (e) {}
    }
    scanTimer = requestAnimationFrame(tick);
  }

  if (btnCamStart) btnCamStart.addEventListener("click", startCamera);
  if (btnCamStop) btnCamStop.addEventListener("click", stopCamera);

  setTimeout(function () { ensureJsQR().then(function (ok) { if (ok) setStatus("Камераро кушоед"); }); }, 200);
  listCameras();
  window.scanLookup = lookup;
  window.scanStopCamera = stopCamera;
})();

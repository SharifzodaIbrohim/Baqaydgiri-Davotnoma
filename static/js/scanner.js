/* Scanner: robust QR + dynamic jsQR + safe JSON */
(function () {
  "use strict";
  const tabScan = document.getElementById("tab-scan");
  if (!tabScan) return;

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
  const scanMax = document.getElementById("scanMax");
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
        if (getJsQR()) { setStatus("jsQR омода"); return true; }
      } catch (e) {}
    }
    setStatus("jsQR бор нашуд — интернетро санҷед");
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
        showEmpty("Роут /api/scan нест. Дар терминал: python patch_scan.py");
        setStatus("Ҷавоб HTML — server.py-ро patch кунед");
        return;
      }
      if (!data.ok) {
        showEmpty(data.error || "Ёфт нашуд");
        setStatus("ID ёфт нашуд: " + id);
        return;
      }
      showStudent(data.student);
      setStatus("Хонда шуд: " + id);
    } catch (e) {
      showEmpty("Хато: " + e.message);
      setStatus("Хатои шабака: " + e.message);
    }
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
    if (presentBadge) {
      if (s.present_at) { presentBadge.textContent = "Ҳозир: " + s.present_at; presentBadge.className = "pill-badge ok"; }
      else { presentBadge.textContent = "Ҳанӯз ҳузур қайд нашудааст"; presentBadge.className = "pill-badge"; }
    }
    if (scanPhoto) {
      if (s.photo_url) { scanPhoto.src = s.photo_url; scanPhoto.hidden = false; }
      else scanPhoto.hidden = true;
    }
    if (scanScore) scanScore.value = s.score != null ? s.score : "";
    if (scanMax) scanMax.value = s.max_score != null ? s.max_score : 100;
    if (scanScoreMsg) scanScoreMsg.textContent = s.status ? "Статус: " + s.status : "";
  }

  if (btnLookup) btnLookup.addEventListener("click", function () { lookup(idInput ? idInput.value : ""); });
  if (idInput) idInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") { e.preventDefault(); lookup(idInput.value); }
  });

  var btnMark = document.getElementById("btnMarkPresent");
  if (btnMark) btnMark.addEventListener("click", async function () {
    if (!currentId) return;
    try {
      var res = await fetch("/api/attendance/" + encodeURIComponent(currentId), {
        method: "POST", headers: { "Content-Type": "application/json" }, body: "{}"
      });
      var data = await res.json();
      if (!data.ok) { alert(data.error || "Хато"); return; }
      if (presentBadge) { presentBadge.textContent = "Ҳозир: " + (data.present_at || "ҳозир"); presentBadge.className = "pill-badge ok"; }
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
    var maxScore = scanMax && scanMax.value !== "" ? Number(scanMax.value) : 100;
    try {
      var res = await fetch("/api/results/" + encodeURIComponent(currentId), {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ score: score, maxScore: maxScore })
      });
      var data = await res.json();
      if (scanScoreMsg) scanScoreMsg.textContent = data.ok ? "Захира шуд" : (data.error || "Хато");
    } catch (e) { if (scanScoreMsg) scanScoreMsg.textContent = e.message; }
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
      setStatus("Браузер камераро дастгирӣ намекунад (Chrome/Edge)");
      return;
    }
    if (!(await ensureJsQR())) return;
    setStatus("Камера кушода мешавад…");
    try {
      var constraints = { audio: false, video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } } };
      if (camSelect && camSelect.value) {
        constraints.video = { deviceId: { exact: camSelect.value }, width: { ideal: 1280 }, height: { ideal: 720 } };
      }
      camStream = await navigator.mediaDevices.getUserMedia(constraints);
      video.srcObject = camStream;
      video.setAttribute("playsinline", "true");
      video.muted = true;
      await video.play();
      await listCameras();
      setStatus("QR-ро ба камера нишон диҳед…");
      lastScannedId = "";
      tick();
    } catch (e) {
      setStatus("Камера: " + (e.message || e.name || e));
    }
  }

  function tick() {
    if (!camStream || !video) return;
    var decoder = getJsQR();
    if (!decoder) { setStatus("jsQR нест"); return; }
    if (video.readyState >= 2 && video.videoWidth > 0) {
      try {
        var maxW = 640, vw = video.videoWidth, vh = video.videoHeight;
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
  if (camSelect) camSelect.addEventListener("change", function () { if (camStream) startCamera(); });

  setTimeout(function () { ensureJsQR().then(function (ok) { if (ok) setStatus("Камераро кушоед, QR-ро нишон диҳед"); }); }, 200);
  listCameras();
  window.scanLookup = lookup;
  window.scanStopCamera = stopCamera;
})();

/* Scanner tab: QR camera + ID lookup + present + score (admin only) */
(function () {
  "use strict";

  const tabScan = document.getElementById("tab-scan");
  if (!tabScan) return;

  let currentId = null;
  let camStream = null;
  let scanTimer = null;
  let lastScanAt = 0;

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

  function extractId(raw) {
    if (!raw) return "";
    const s = String(raw).trim();
    if (/^\d{10,24}$/.test(s)) return s;
    const m = s.match(/(?:\/scan\/|\/students\/|id=)(\d{10,24})/i);
    if (m) return m[1];
    const m2 = s.match(/(\d{12,22})/);
    return m2 ? m2[1] : s.replace(/\s+/g, "");
  }

  async function lookup(idRaw) {
    const id = extractId(idRaw);
    if (!id) {
      alert("ID-ро нависед ё QR скан кунед");
      return;
    }
    idInput.value = id;
    try {
      const res = await fetch("/api/scan/" + encodeURIComponent(id));
      const data = await res.json();
      if (!data.ok) {
        showEmpty(data.error || "Ёфт нашуд");
        return;
      }
      showStudent(data.student);
    } catch (e) {
      showEmpty("Хато: " + e.message);
    }
  }

  function showEmpty(msg) {
    currentId = null;
    emptyEl.hidden = false;
    emptyEl.textContent = msg || "ID скан/нависед — маълумот ин ҷо мебарояд";
    resultEl.hidden = true;
  }

  function showStudent(s) {
    currentId = s.id;
    emptyEl.hidden = true;
    resultEl.hidden = false;
    scanName.textContent = s.full_name || [s.last_name, s.first_name, s.patronymic].filter(Boolean).join(" ");
    scanIdEl.textContent = s.id;
    const parts = [];
    if (s.school) parts.push(s.school);
    if (s.class_name) parts.push("синф " + s.class_name);
    if (s.subject) parts.push(s.subject);
    if (s.olympiad_title) parts.push(s.olympiad_title);
    if (s.gender) parts.push(s.gender);
    scanMeta.textContent = parts.join(" · ");

    if (s.present) {
      presentBadge.textContent = "Ҳозир · " + (s.present_at || "");
      presentBadge.className = "pill-badge present";
    } else {
      presentBadge.textContent = "Ҳанӯз ҳозир нашудааст";
      presentBadge.className = "pill-badge absent";
    }

    if (s.photo_url) {
      scanPhoto.src = s.photo_url;
      scanPhoto.hidden = false;
    } else {
      scanPhoto.removeAttribute("src");
      scanPhoto.hidden = true;
    }

    scanScore.value = s.score != null ? s.score : "";
    scanMax.value = s.max_score != null ? s.max_score : 100;
    if (s.percent != null && s.status) {
      scanScoreMsg.textContent = "Фоиз: " + s.percent + "% · " + s.status;
    } else {
      scanScoreMsg.textContent = "";
    }
  }

  btnLookup.addEventListener("click", () => lookup(idInput.value));
  idInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      lookup(idInput.value);
    }
  });

  document.getElementById("btnMarkPresent").addEventListener("click", async () => {
    if (!currentId) return;
    try {
      const res = await fetch("/api/attendance/" + encodeURIComponent(currentId), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!data.ok) {
        alert(data.error || "Хато");
        return;
      }
      presentBadge.textContent = "Ҳозир · " + (data.present_at || "");
      presentBadge.className = "pill-badge present";
    } catch (e) {
      alert("Хато: " + e.message);
    }
  });

  document.getElementById("btnOpenExam").addEventListener("click", () => {
    if (!currentId) return;
    window.open("/api/students/" + encodeURIComponent(currentId) + "/exam-sheet", "_blank");
  });
  document.getElementById("btnOpenDav").addEventListener("click", () => {
    if (!currentId) return;
    window.open("/api/students/" + encodeURIComponent(currentId) + "/davotnoma", "_blank");
  });

  document.getElementById("btnSaveScanScore").addEventListener("click", async () => {
    if (!currentId) return;
    const score = scanScore.value === "" ? null : Number(scanScore.value);
    const maxScore = scanMax.value === "" ? 100 : Number(scanMax.value);
    try {
      const res = await fetch("/api/results/" + encodeURIComponent(currentId), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ score, maxScore }),
      });
      const data = await res.json();
      if (!data.ok) {
        scanScoreMsg.textContent = data.error || "Хато";
        return;
      }
      const r = data.result;
      scanScoreMsg.textContent =
        "Захира шуд · " +
        (r.percent != null ? r.percent + "% · " : "") +
        (r.status || "");
    } catch (e) {
      scanScoreMsg.textContent = "Хато: " + e.message;
    }
  });

  async function listCameras() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cams = devices.filter((d) => d.kind === "videoinput");
      camSelect.innerHTML = "";
      cams.forEach((d, i) => {
        const opt = document.createElement("option");
        opt.value = d.deviceId;
        opt.textContent = d.label || "Камера " + (i + 1);
        camSelect.appendChild(opt);
      });
      if (!cams.length) {
        camSelect.innerHTML = '<option value="">Камера ёфт нашуд</option>';
      }
    } catch (e) {
      console.warn(e);
    }
  }

  function stopCamera() {
    if (scanTimer) {
      cancelAnimationFrame(scanTimer);
      scanTimer = null;
    }
    if (camStream) {
      camStream.getTracks().forEach((t) => t.stop());
      camStream = null;
    }
    if (video) {
      video.srcObject = null;
    }
    camStatus.textContent = "Камера хомӯш";
  }

  async function startCamera() {
    stopCamera();
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      camStatus.textContent = "Камера дастгирӣ намешавад (HTTPS ё localhost лозим)";
      return;
    }
    const constraints = {
      audio: false,
      video: camSelect.value
        ? { deviceId: { exact: camSelect.value }, facingMode: "environment" }
        : { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
    };
    try {
      camStream = await navigator.mediaDevices.getUserMedia(constraints);
      video.srcObject = camStream;
      await video.play();
      camStatus.textContent = "Камера кор мекунад — QR-ро нишон диҳед";
      await listCameras();
      tick();
    } catch (e) {
      camStatus.textContent = "Камера кушода нашуд: " + e.message;
    }
  }

  function tick() {
    if (!camStream || !video || video.readyState < 2) {
      scanTimer = requestAnimationFrame(tick);
      return;
    }
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (w && h && typeof jsQR === "function") {
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(video, 0, 0, w, h);
      const img = ctx.getImageData(0, 0, w, h);
      const code = jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" });
      if (code && code.data) {
        const now = Date.now();
        if (now - lastScanAt > 1500) {
          lastScanAt = now;
          const id = extractId(code.data);
          if (id) {
            camStatus.textContent = "QR хонда шуд: " + id;
            lookup(id);
          }
        }
      }
    }
    scanTimer = requestAnimationFrame(tick);
  }

  btnCamStart.addEventListener("click", startCamera);
  btnCamStop.addEventListener("click", stopCamera);

  document.querySelectorAll(".tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.dataset.tab !== "scan") stopCamera();
    });
  });

  listCameras();

  window.scanLookup = lookup;
  window.scanStopCamera = stopCamera;
})();

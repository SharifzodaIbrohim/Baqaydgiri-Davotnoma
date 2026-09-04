/* Results: score, filter, export, QR → jump to row */
(function () {
  "use strict";

  const tbody = document.querySelector("#resultsTable tbody");
  if (!tbody) return;

  let camStream = null;
  let scanTimer = null;
  let lastScanAt = 0;

  function fullName(r) {
    return [r.last_name, r.first_name, r.patronymic].filter(Boolean).join(" ");
  }

  function statusClass(st) {
    if (st === "Гузашт") return "status-pass";
    if (st === "Нагузашт") return "status-fail";
    return "";
  }

  function extractId(raw) {
    if (!raw) return "";
    const s = String(raw).trim();
    if (/^\d{10,24}$/.test(s)) return s;
    const m = s.match(/(?:\/scan\/|\/students\/|id=)(\d{10,24})/i);
    if (m) return m[1];
    const m2 = s.match(/(\d{12,22})/);
    return m2 ? m2[1] : s.replace(/\s+/g, "");
  }

  function esc(t) {
    const d = document.createElement("div");
    d.textContent = t == null ? "" : String(t);
    return d.innerHTML;
  }

  async function loadResults() {
    const params = new URLSearchParams();
    const school = (document.getElementById("fSchool") || {}).value || "";
    const cls = (document.getElementById("fClass") || {}).value || "";
    const subject = (document.getElementById("fSubject") || {}).value || "";
    const olympiad = (document.getElementById("fOlympiad") || {}).value || "";
    const status = (document.getElementById("fStatus") || {}).value || "";
    const q = (document.getElementById("fQ") || {}).value || "";
    if (school.trim()) params.set("school", school.trim());
    if (cls.trim()) params.set("class", cls.trim());
    if (subject) params.set("subject", subject);
    if (olympiad.trim()) params.set("olympiad", olympiad.trim());
    if (status) params.set("status", status);
    if (q.trim()) params.set("q", q.trim());

    try {
      const res = await fetch("/api/results?" + params.toString());
      const data = await res.json();
      if (!data.ok) return;
      render(data.results || []);
    } catch (e) {
      console.error(e);
    }
  }

  function render(rows) {
    tbody.innerHTML = "";
    if (!rows.length) {
      tbody.innerHTML =
        '<tr><td colspan="9" style="text-align:center;color:#5a7a6e">Сабт нест</td></tr>';
      return;
    }
    rows.forEach((r) => {
      const tr = document.createElement("tr");
      tr.dataset.sid = r.student_id;
      const score = r.score != null ? r.score : "";
      const st = r.status || "";
      tr.innerHTML =
        "<td>" + esc(fullName(r)) + "</td>" +
        '<td class="mono">' + esc(r.student_id) + "</td>" +
        "<td>" + esc(r.school) + "</td>" +
        "<td>" + esc(r.class_name) + "</td>" +
        "<td>" + esc(r.subject) + "</td>" +
        "<td>" + esc(r.olympiad_title) + "</td>" +
        '<td><input class="score-input" type="number" step="0.5" value="' +
        esc(score) +
        '" data-id="' +
        esc(r.student_id) +
        '"/></td>' +
        '<td class="status-cell ' + statusClass(st) + '">' + esc(st || "—") + "</td>" +
        "<td>" + esc(r.scored_at || "") + "</td>";
      tbody.appendChild(tr);
    });

    tbody.querySelectorAll(".score-input").forEach((inp) => {
      inp.addEventListener("change", () => saveRow(inp.dataset.id, inp.closest("tr")));
      inp.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter") {
          ev.preventDefault();
          saveRow(inp.dataset.id, inp.closest("tr"));
        }
      });
    });
  }

  async function saveRow(studentId, tr) {
    const scoreInp = tr.querySelector(".score-input");
    const score = scoreInp.value === "" ? null : Number(scoreInp.value);
    try {
      const res = await fetch("/api/results/" + encodeURIComponent(studentId), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ score, maxScore: 100 }),
      });
      const data = await res.json();
      if (!data.ok) {
        alert(data.error || "Хато");
        return;
      }
      const r = data.result;
      const stCell = tr.querySelector(".status-cell");
      stCell.textContent = r.status || "—";
      stCell.className = "status-cell " + statusClass(r.status);
      tr.cells[tr.cells.length - 1].textContent = r.scored_at || "";
    } catch (e) {
      alert("Хато: " + e.message);
    }
  }

  function focusRow(tr) {
    tbody.querySelectorAll("tr.row-highlight").forEach((r) => r.classList.remove("row-highlight"));
    tr.classList.add("row-highlight");
    tr.scrollIntoView({ behavior: "smooth", block: "center" });
    const inp = tr.querySelector(".score-input");
    if (inp) {
      inp.focus();
      inp.select();
    }
  }

  async function highlightStudent(raw) {
    const id = extractId(raw);
    if (!id) return;
    const resScanId = document.getElementById("resScanId");
    if (resScanId) resScanId.value = id;
    const fQ = document.getElementById("fQ");
    if (fQ) fQ.value = id;
    await loadResults();
    let found = null;
    tbody.querySelectorAll("tr[data-sid]").forEach((row) => {
      if (row.dataset.sid === id) found = row;
    });
    if (!found) {
      alert("Хонанда бо ID " + id + " ёфт нашуд");
      return;
    }
    focusRow(found);
  }

  document.getElementById("btnFilter").addEventListener("click", loadResults);
  let filterTimer = null;
  ["fSchool", "fClass", "fSubject", "fOlympiad", "fStatus", "fQ"].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        loadResults();
      }
    });
    el.addEventListener("input", () => {
      clearTimeout(filterTimer);
      filterTimer = setTimeout(loadResults, 280);
    });
    el.addEventListener("change", loadResults);
  });

  document.getElementById("btnExport").addEventListener("click", () => {
    const params = new URLSearchParams();
    ["school", "class", "subject", "olympiad", "status", "q"].forEach((key, i) => {
      const ids = ["fSchool", "fClass", "fSubject", "fOlympiad", "fStatus", "fQ"];
      const el = document.getElementById(ids[i]);
      const v = el ? el.value.trim() : "";
      if (v) params.set(key, v);
    });
    window.location.href = "/api/results/export.xlsx?" + params.toString();
  });

  const resScanId = document.getElementById("resScanId");
  const btnResLookup = document.getElementById("btnResLookup");
  const btnResCamStart = document.getElementById("btnResCamStart");
  const btnResCamStop = document.getElementById("btnResCamStop");
  const resCamSelect = document.getElementById("resCamSelect");
  const resCamStatus = document.getElementById("resCamStatus");
  const resCamWrap = document.getElementById("resCamWrap");
  const video = document.getElementById("resScanVideo");
  const canvas = document.getElementById("resScanCanvas");

  if (btnResLookup) {
    btnResLookup.addEventListener("click", () => highlightStudent(resScanId.value));
  }
  if (resScanId) {
    resScanId.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        highlightStudent(resScanId.value);
      }
    });
  }

  function stopResCam() {
    if (scanTimer) {
      cancelAnimationFrame(scanTimer);
      scanTimer = null;
    }
    if (camStream) {
      camStream.getTracks().forEach((t) => t.stop());
      camStream = null;
    }
    if (video) video.srcObject = null;
    if (resCamWrap) resCamWrap.hidden = true;
    if (resCamStatus) resCamStatus.textContent = "";
  }

  async function listCams() {
    if (!navigator.mediaDevices) return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cams = devices.filter((d) => d.kind === "videoinput");
      if (!resCamSelect) return;
      resCamSelect.innerHTML = "";
      cams.forEach((d, i) => {
        const o = document.createElement("option");
        o.value = d.deviceId;
        o.textContent = d.label || "Камера " + (i + 1);
        resCamSelect.appendChild(o);
      });
    } catch (e) {}
  }

  async function startResCam() {
    stopResCam();
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      if (resCamStatus) resCamStatus.textContent = "Камера дастгирӣ намешавад";
      return;
    }
    if (resCamWrap) resCamWrap.hidden = false;
    try {
      camStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: resCamSelect && resCamSelect.value
          ? { deviceId: { exact: resCamSelect.value } }
          : { facingMode: { ideal: "environment" } },
      });
      video.srcObject = camStream;
      await video.play();
      if (resCamStatus) resCamStatus.textContent = "QR-ро нишон диҳед…";
      await listCams();
      tick();
    } catch (e) {
      if (resCamStatus) resCamStatus.textContent = "Камера: " + e.message;
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
        if (now - lastScanAt > 1600) {
          lastScanAt = now;
          const id = extractId(code.data);
          if (id) {
            if (resCamStatus) resCamStatus.textContent = "Ёфт: " + id;
            highlightStudent(id);
          }
        }
      }
    }
    scanTimer = requestAnimationFrame(tick);
  }

  if (btnResCamStart) btnResCamStart.addEventListener("click", startResCam);
  if (btnResCamStop) btnResCamStop.addEventListener("click", stopResCam);

  document.querySelectorAll(".tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.dataset.tab !== "results") stopResCam();
    });
  });

  window.loadResults = loadResults;
  window.resultsHighlight = highlightStudent;
  loadResults();
})();

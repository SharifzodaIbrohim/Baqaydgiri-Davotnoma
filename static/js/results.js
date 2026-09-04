/* Results: manual score + manual status + QR jump */
(function () {
  "use strict";
  const tbody = document.querySelector("#resultsTable tbody");
  if (!tbody) return;
  let camStream = null, scanTimer = null, lastScanAt = 0;
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
    const map = { school: "fSchool", class: "fClass", subject: "fSubject", olympiad: "fOlympiad", status: "fStatus", q: "fQ" };
    Object.keys(map).forEach(function (k) {
      const el = document.getElementById(map[k]);
      const v = el ? el.value.trim() : "";
      if (v) params.set(k, v);
    });
    try {
      const res = await fetch("/api/results?" + params.toString());
      const data = await res.json();
      if (!data.ok) return;
      render(data.results || []);
    } catch (e) { console.error(e); }
  }
  function statusSelectHtml(current) {
    const opts = [["", "—"], ["Гузашт", "Гузашт"], ["Нагузашт", "Нагузашт"]];
    return '<select class="status-select">' + opts.map(function (o) {
      return '<option value="' + o[0] + '"' + (current === o[0] ? " selected" : "") + '>' + o[1] + '</option>';
    }).join('') + '</select>';
  }
  function render(rows) {
    tbody.innerHTML = "";
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:#5a7a6e">Сабт нест</td></tr>';
      return;
    }
    rows.forEach(function (r) {
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
        '<td><input class="score-input" type="number" step="0.5" value="' + esc(score) + '"/></td>' +
        '<td class="status-cell ' + statusClass(st) + '">' + statusSelectHtml(st) + "</td>" +
        "<td>" + esc(r.scored_at || "") + "</td>";
      tbody.appendChild(tr);
    });
    tbody.querySelectorAll("tr[data-sid]").forEach(function (tr) {
      const scoreInp = tr.querySelector(".score-input");
      const stSel = tr.querySelector(".status-select");
      function save() { saveRow(tr.dataset.sid, tr); }
      if (scoreInp) {
        scoreInp.addEventListener("change", save);
        scoreInp.addEventListener("keydown", function (ev) {
          if (ev.key === "Enter") { ev.preventDefault(); save(); }
        });
      }
      if (stSel) stSel.addEventListener("change", save);
    });
  }
  async function saveRow(studentId, tr) {
    const scoreInp = tr.querySelector(".score-input");
    const stSel = tr.querySelector(".status-select");
    const score = scoreInp && scoreInp.value !== "" ? Number(scoreInp.value) : null;
    const status = stSel ? stSel.value : "";
    try {
      const res = await fetch("/api/results/" + encodeURIComponent(studentId), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ score: score, maxScore: 100, status: status }),
      });
      const data = await res.json();
      if (!data.ok) { alert(data.error || "Хато"); return; }
      const r = data.result;
      const stCell = tr.querySelector(".status-cell");
      stCell.className = "status-cell " + statusClass(r.status);
      if (stSel && r.status != null) stSel.value = r.status || "";
      tr.cells[tr.cells.length - 1].textContent = r.scored_at || "";
    } catch (e) { alert("Хато: " + e.message); }
  }
  function focusRow(tr) {
    tbody.querySelectorAll("tr.row-highlight").forEach(function (r) { r.classList.remove("row-highlight"); });
    tr.classList.add("row-highlight");
    tr.scrollIntoView({ behavior: "smooth", block: "center" });
    const inp = tr.querySelector(".score-input");
    if (inp) { inp.focus(); inp.select(); }
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
    tbody.querySelectorAll("tr[data-sid]").forEach(function (row) {
      if (row.dataset.sid === id) found = row;
    });
    if (!found) { alert("Хонанда бо ID " + id + " ёфт нашуд"); return; }
    focusRow(found);
  }
  const btnFilter = document.getElementById("btnFilter");
  if (btnFilter) btnFilter.addEventListener("click", loadResults);
  let filterTimer = null;
  ["fSchool", "fClass", "fSubject", "fOlympiad", "fStatus", "fQ"].forEach(function (id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); loadResults(); }
    });
    el.addEventListener("input", function () {
      clearTimeout(filterTimer);
      filterTimer = setTimeout(loadResults, 280);
    });
    el.addEventListener("change", loadResults);
  });
  const btnExport = document.getElementById("btnExport");
  if (btnExport) {
    btnExport.addEventListener("click", function () {
      const params = new URLSearchParams();
      ["school", "class", "subject", "olympiad", "status", "q"].forEach(function (key, i) {
        const ids = ["fSchool", "fClass", "fSubject", "fOlympiad", "fStatus", "fQ"];
        const el = document.getElementById(ids[i]);
        const v = el ? el.value.trim() : "";
        if (v) params.set(key, v);
      });
      window.location.href = "/api/results/export.xlsx?" + params.toString();
    });
  }
  const resScanId = document.getElementById("resScanId");
  const btnResLookup = document.getElementById("btnResLookup");
  if (btnResLookup) btnResLookup.addEventListener("click", function () { highlightStudent(resScanId.value); });
  if (resScanId) resScanId.addEventListener("keydown", function (e) {
    if (e.key === "Enter") { e.preventDefault(); highlightStudent(resScanId.value); }
  });
  const btnResCamStart = document.getElementById("btnResCamStart");
  const btnResCamStop = document.getElementById("btnResCamStop");
  const resCamSelect = document.getElementById("resCamSelect");
  const resCamStatus = document.getElementById("resCamStatus");
  const resCamWrap = document.getElementById("resCamWrap");
  const video = document.getElementById("resScanVideo");
  const canvas = document.getElementById("resScanCanvas");
  function stopResCam() {
    if (scanTimer) { cancelAnimationFrame(scanTimer); scanTimer = null; }
    if (camStream) { camStream.getTracks().forEach(function (t) { t.stop(); }); camStream = null; }
    if (video) video.srcObject = null;
    if (resCamWrap) resCamWrap.hidden = true;
    if (resCamStatus) resCamStatus.textContent = "";
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
      (function tick() {
        if (!camStream || !video || video.readyState < 2) {
          scanTimer = requestAnimationFrame(tick);
          return;
        }
        const w = video.videoWidth, h = video.videoHeight;
        if (w && h && typeof jsQR === "function") {
          canvas.width = w; canvas.height = h;
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
      })();
    } catch (e) {
      if (resCamStatus) resCamStatus.textContent = "Камера: " + e.message;
    }
  }
  if (btnResCamStart) btnResCamStart.addEventListener("click", startResCam);
  if (btnResCamStop) btnResCamStop.addEventListener("click", stopResCam);
  window.loadResults = loadResults;
  window.resultsHighlight = highlightStudent;
  loadResults();
})();

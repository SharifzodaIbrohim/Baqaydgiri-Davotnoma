/* Results: manual score, filter, export */
(function () {
  "use strict";

  const tbody = document.querySelector("#resultsTable tbody");
  const passPct = window.PASS_PERCENT || 70;

  function fullName(r) {
    return [r.last_name, r.first_name, r.patronymic].filter(Boolean).join(" ");
  }

  function statusClass(st) {
    if (st === "Гузашт") return "status-pass";
    if (st === "Нагузашт") return "status-fail";
    return "";
  }

  async function loadResults() {
    const params = new URLSearchParams();
    const school = document.getElementById("fSchool").value.trim();
    const cls = document.getElementById("fClass").value.trim();
    const subject = document.getElementById("fSubject").value;
    const olympiad = document.getElementById("fOlympiad").value.trim();
    const status = document.getElementById("fStatus").value;
    const q = document.getElementById("fQ").value.trim();
    if (school) params.set("school", school);
    if (cls) params.set("class", cls);
    if (subject) params.set("subject", subject);
    if (olympiad) params.set("olympiad", olympiad);
    if (status) params.set("status", status);
    if (q) params.set("q", q);

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
      tbody.innerHTML = '<tr><td colspan="11" style="text-align:center;color:#5a7a6e">Сабт нест</td></tr>';
      return;
    }
    rows.forEach((r) => {
      const tr = document.createElement("tr");
      const score = r.score != null ? r.score : "";
      const maxS = r.max_score != null ? r.max_score : 100;
      const pct = r.percent != null ? r.percent : "";
      const st = r.status || "";
      tr.innerHTML =
        "<td>" + esc(fullName(r)) + "</td>" +
        '<td class="mono">' + esc(r.student_id) + "</td>" +
        "<td>" + esc(r.school) + "</td>" +
        "<td>" + esc(r.class_name) + "</td>" +
        "<td>" + esc(r.subject) + "</td>" +
        "<td>" + esc(r.olympiad_title) + "</td>" +
        '<td><input class="score-input" type="number" step="0.5" value="' + esc(score) + '" data-id="' + esc(r.student_id) + '"/></td>' +
        '<td><input class="max-input" type="number" step="1" value="' + esc(maxS) + '" data-id="' + esc(r.student_id) + '"/></td>' +
        '<td class="pct-cell">' + (pct !== "" ? pct + "%" : "—") + "</td>" +
        '<td class="status-cell ' + statusClass(st) + '">' + esc(st || "—") + "</td>" +
        "<td>" + esc(r.scored_at || "") + "</td>";
      tbody.appendChild(tr);
    });

    tbody.querySelectorAll(".score-input, .max-input").forEach((inp) => {
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
    const maxInp = tr.querySelector(".max-input");
    const score = scoreInp.value === "" ? null : Number(scoreInp.value);
    const maxScore = maxInp.value === "" ? 100 : Number(maxInp.value);
    try {
      const res = await fetch("/api/results/" + encodeURIComponent(studentId), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ score, maxScore }),
      });
      const data = await res.json();
      if (!data.ok) {
        alert(data.error || "Хато");
        return;
      }
      const r = data.result;
      tr.querySelector(".pct-cell").textContent =
        r.percent != null ? r.percent + "%" : "—";
      const stCell = tr.querySelector(".status-cell");
      stCell.textContent = r.status || "—";
      stCell.className = "status-cell " + statusClass(r.status);
      tr.cells[tr.cells.length - 1].textContent = r.scored_at || "";
    } catch (e) {
      alert("Хато: " + e.message);
    }
  }

  function esc(t) {
    const d = document.createElement("div");
    d.textContent = t == null ? "" : String(t);
    return d.innerHTML;
  }

  document.getElementById("btnFilter").addEventListener("click", loadResults);
  let filterTimer = null;
  function scheduleFilter() {
    clearTimeout(filterTimer);
    filterTimer = setTimeout(loadResults, 280);
  }
  ["fSchool", "fClass", "fSubject", "fOlympiad", "fStatus", "fQ"].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        loadResults();
      }
    });
    el.addEventListener("input", scheduleFilter);
    el.addEventListener("change", loadResults);
  });

  document.getElementById("btnExport").addEventListener("click", () => {
    const params = new URLSearchParams();
    const school = document.getElementById("fSchool").value.trim();
    const cls = document.getElementById("fClass").value.trim();
    const subject = document.getElementById("fSubject").value;
    const olympiad = document.getElementById("fOlympiad").value.trim();
    const status = document.getElementById("fStatus").value;
    const q = document.getElementById("fQ").value.trim();
    if (school) params.set("school", school);
    if (cls) params.set("class", cls);
    if (subject) params.set("subject", subject);
    if (olympiad) params.set("olympiad", olympiad);
    if (status) params.set("status", status);
    if (q) params.set("q", q);
    window.location.href = "/api/results/export.xlsx?" + params.toString();
  });

  window.loadResults = loadResults;
  loadResults();
})();

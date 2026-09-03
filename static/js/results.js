/* Results: manual score, filter, export */
(function () {
  "use strict";

  const tbody = document.querySelector("#resultsTable tbody");
  const fSchool = document.getElementById("fSchool");
  const fClass = document.getElementById("fClass");
  const fSubject = document.getElementById("fSubject");
  const fOlympiad = document.getElementById("fOlympiad");
  const fStatus = document.getElementById("fStatus");
  const fQ = document.getElementById("fQ");
  const btnFilter = document.getElementById("btnFilter");
  const btnExport = document.getElementById("btnExport");

  function fullName(r) {
    return [r.last_name, r.first_name, r.patronymic].filter(Boolean).join(" ");
  }

  function queryParams() {
    const p = new URLSearchParams();
    if (fSchool.value.trim()) p.set("school", fSchool.value.trim());
    if (fClass.value.trim()) p.set("class", fClass.value.trim());
    if (fSubject.value) p.set("subject", fSubject.value);
    if (fOlympiad.value.trim()) p.set("olympiad", fOlympiad.value.trim());
    if (fStatus.value) p.set("status", fStatus.value);
    if (fQ.value.trim()) p.set("q", fQ.value.trim());
    return p.toString();
  }

  async function loadResults() {
    try {
      const qs = queryParams();
      const res = await fetch("/api/results" + (qs ? "?" + qs : ""));
      const data = await res.json();
      if (!data.ok) return;
      render(data.results || []);
    } catch (e) {
      console.error(e);
    }
  }

  function render(rows) {
    tbody.innerHTML = "";
    rows.forEach((r) => {
      const tr = document.createElement("tr");
      const statusCls =
        r.status === "Гузашт"
          ? "status-pass"
          : r.status === "Нагузашт"
          ? "status-fail"
          : "";
      tr.innerHTML =
        "<td>" +
        fullName(r) +
        "</td>" +
        '<td class="id-cell">' +
        (r.student_id || "") +
        "</td>" +
        "<td>" +
        (r.school || "") +
        "</td>" +
        "<td>" +
        (r.class_name || "") +
        "</td>" +
        "<td>" +
        (r.subject || "") +
        "</td>" +
        "<td>" +
        (r.olympiad_title || "") +
        "</td>" +
        '<td><input class="score-edit" type="number" step="0.01" value="' +
        (r.score != null ? r.score : "") +
        '" data-id="' +
        r.student_id +
        '"/></td>' +
        "<td>" +
        (r.max_score != null ? r.max_score : 100) +
        "</td>" +
        "<td>" +
        (r.percent != null ? r.percent : "") +
        "</td>" +
        '<td class="' +
        statusCls +
        '">' +
        (r.status || "") +
        "</td>" +
        "<td>" +
        (r.scored_at || "") +
        "</td>";

      const inp = tr.querySelector(".score-edit");
      inp.addEventListener("change", async () => {
        const score = inp.value;
        const body = {
          score: score === "" ? null : parseFloat(score),
          maxScore: r.max_score != null ? r.max_score : 100,
        };
        try {
          const res = await fetch("/api/results/" + r.student_id, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
          const data = await res.json();
          if (data.ok) loadResults();
        } catch (e) {
          console.error(e);
        }
      });

      tbody.appendChild(tr);
    });
  }

  btnFilter.addEventListener("click", loadResults);
  btnExport.addEventListener("click", () => {
    const qs = queryParams();
    window.location.href = "/api/results/export.xlsx" + (qs ? "?" + qs : "");
  });

  // reload when switching to results tab
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      if (tab.dataset.tab === "results") loadResults();
    });
  });

  loadResults();
})();

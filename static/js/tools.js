/* Excel import + backup helpers */
(function () {
  "use strict";

  const fileInput = document.getElementById("importFile");
  const btnImport = document.getElementById("btnImportExcel");
  const importMsg = document.getElementById("importMsg");
  if (!btnImport) return;

  function showImportMsg(text, ok) {
    importMsg.hidden = false;
    importMsg.textContent = text;
    importMsg.className = "msg " + (ok ? "ok" : "err");
  }

  btnImport.addEventListener("click", async () => {
    const f = fileInput && fileInput.files && fileInput.files[0];
    if (!f) {
      showImportMsg("Аввал файли .xlsx-ро интихоб кунед", false);
      return;
    }
    const fd = new FormData();
    fd.append("file", f);
    btnImport.disabled = true;
    showImportMsg("Импорт идома дорад…", true);
    try {
      const res = await fetch("/api/students/import", { method: "POST", body: fd });
      const data = await res.json();
      if (!data.ok) {
        showImportMsg(data.error || "Хато", false);
        return;
      }
      let t = "Импорт шуд: " + data.created + " нафар";
      if (data.errors && data.errors.length) {
        t += " · Хатогиҳо: " + data.errors.length + " — " + data.errors.slice(0, 5).join("; ");
        if (data.errors.length > 5) t += " …";
      }
      showImportMsg(t, data.created > 0);
      const btn = document.getElementById("btnRefreshStudents");
      if (btn) btn.click();
    } catch (e) {
      showImportMsg("Хато: " + e.message, false);
    } finally {
      btnImport.disabled = false;
    }
  });
})();

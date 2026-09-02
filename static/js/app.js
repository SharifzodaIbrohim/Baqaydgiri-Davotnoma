/* Shared: login, tabs, logout */
(function () {
  "use strict";

  // ----- Login page -----
  const loginForm = document.getElementById("loginForm");
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const err = document.getElementById("loginError");
      err.hidden = true;
      const fd = new FormData(loginForm);
      try {
        const res = await fetch("/api/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: fd.get("username"),
            password: fd.get("password"),
          }),
        });
        const data = await res.json();
        if (!data.ok) {
          err.textContent = data.error || "Хато";
          err.hidden = false;
          return;
        }
        window.location.href = "/admin";
      } catch (ex) {
        err.textContent = "Пайвастшавӣ номумкин: " + ex.message;
        err.hidden = false;
      }
    });
  }

  // ----- Admin tabs -----
  const tabs = document.querySelectorAll(".tab");
  tabs.forEach((btn) => {
    btn.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("active"));
      btn.classList.add("active");
      document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
      const panel = document.getElementById("tab-" + btn.dataset.tab);
      if (panel) panel.classList.add("active");
      if (btn.dataset.tab === "results" && window.loadResults) {
        window.loadResults();
      }
    });
  });

  // ----- Logout -----
  const btnLogout = document.getElementById("btnLogout");
  if (btnLogout) {
    btnLogout.addEventListener("click", async () => {
      await fetch("/api/logout", { method: "POST" });
      window.location.href = "/login";
    });
  }
})();

/* Registration: form, camera, ID, list, save */
(function () {
  "use strict";

  let lastStudent = null;
  let camStream = null;
  let photoBase64 = "";

  const form = document.getElementById("regForm");
  const photoPreview = document.getElementById("photoPreview");
  const photoBase64Input = document.getElementById("photoBase64");
  const camVideo = document.getElementById("camVideo");
  const camCanvas = document.getElementById("camCanvas");
  const cameraSelect = document.getElementById("cameraSelect");
  const btnStartCam = document.getElementById("btnStartCam");
  const btnSnap = document.getElementById("btnSnap");
  const btnClearPhoto = document.getElementById("btnClearPhoto");
  const photoFile = document.getElementById("photoFile");
  const btnRegister = document.getElementById("btnRegister");
  const btnSaveLocal = document.getElementById("btnSaveLocal");
  const regMsg = document.getElementById("regMsg");
  const studentList = document.getElementById("studentList");
  const studentSearch = document.getElementById("studentSearch");
  const btnRefreshStudents = document.getElementById("btnRefreshStudents");

  function showMsg(text, ok) {
    regMsg.hidden = false;
    regMsg.textContent = text;
    regMsg.className = "msg " + (ok ? "ok" : "err");
  }

  async function loadCameras() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cams = devices.filter((d) => d.kind === "videoinput");
      cameraSelect.innerHTML = '<option value="">— камера —</option>';
      cams.forEach((c, i) => {
        const opt = document.createElement("option");
        opt.value = c.deviceId;
        opt.textContent = c.label || "Камера " + (i + 1);
        cameraSelect.appendChild(opt);
      });
    } catch (e) {
      console.warn("cameras", e);
    }
  }

  async function startCamera() {
    stopCamera();
    const deviceId = cameraSelect.value;
    const constraints = {
      video: deviceId ? { deviceId: { exact: deviceId } } : true,
      audio: false,
    };
    try {
      camStream = await navigator.mediaDevices.getUserMedia(constraints);
      camVideo.srcObject = camStream;
      camVideo.hidden = false;
      photoPreview.hidden = true;
      btnSnap.disabled = false;
      await loadCameras();
    } catch (e) {
      showMsg("Камера кушода нашуд. localhost / HTTPS лозим аст.", false);
      console.error(e);
    }
  }

  function stopCamera() {
    if (camStream) {
      camStream.getTracks().forEach((t) => t.stop());
      camStream = null;
    }
    camVideo.srcObject = null;
    camVideo.hidden = true;
    btnSnap.disabled = true;
  }

  function setPhotoFromDataUrl(dataUrl) {
    photoBase64 = dataUrl;
    photoBase64Input.value = dataUrl;
    photoPreview.src = dataUrl;
    photoPreview.hidden = false;
    camVideo.hidden = true;
  }

  function snapPhoto() {
    if (!camStream) return;
    const w = camVideo.videoWidth;
    const h = camVideo.videoHeight;
    camCanvas.width = w;
    camCanvas.height = h;
    const ctx = camCanvas.getContext("2d");
    ctx.drawImage(camVideo, 0, 0, w, h);
    const dataUrl = camCanvas.toDataURL("image/jpeg", 0.88);
    setPhotoFromDataUrl(dataUrl);
    stopCamera();
  }

  function clearPhoto() {
    photoBase64 = "";
    photoBase64Input.value = "";
    photoPreview.hidden = true;
    photoPreview.src = "";
    photoFile.value = "";
  }

  photoFile.addEventListener("change", () => {
    const f = photoFile.files && photoFile.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => setPhotoFromDataUrl(reader.result);
    reader.readAsDataURL(f);
  });

  btnStartCam.addEventListener("click", startCamera);
  btnSnap.addEventListener("click", snapPhoto);
  btnClearPhoto.addEventListener("click", clearPhoto);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    btnRegister.disabled = true;
    const fd = new FormData(form);
    if (photoBase64) fd.set("photo_base64", photoBase64);

    try {
      const res = await fetch("/api/students", { method: "POST", body: fd });
      const data = await res.json();
      if (!data.ok) {
        showMsg(data.error || "Хато", false);
        return;
      }
      lastStudent = data.student;
      showMsg("Бақайд шуд. ID: " + data.student.id, true);
      btnSaveLocal.disabled = false;
      form.reset();
      clearPhoto();
      loadStudents();
    } catch (err) {
      showMsg("Хатои шабака", false);
    } finally {
      btnRegister.disabled = false;
    }
  });

  btnSaveLocal.addEventListener("click", async () => {
    if (!lastStudent) return;
    try {
      const res = await fetch("/api/students/" + lastStudent.id + "/save-local", {
        method: "POST",
      });
      const data = await res.json();
      if (!data.ok) {
        showMsg(data.error || "Хато", false);
        return;
      }
      showMsg("Варақаҳо захира шуданд: " + (data.files || []).join(", "), true);
      // open print windows
      window.open("/api/students/" + lastStudent.id + "/davotnoma", "_blank");
      window.open("/api/students/" + lastStudent.id + "/exam-sheet", "_blank");
    } catch (err) {
      showMsg("Хатои захира", false);
    }
  });

  function fullName(s) {
    return [s.last_name, s.first_name, s.patronymic].filter(Boolean).join(" ");
  }

  async function loadStudents() {
    try {
      const res = await fetch("/api/students");
      const data = await res.json();
      if (!data.ok) return;
      renderStudents(data.students || []);
    } catch (e) {
      console.error(e);
    }
  }

  function renderStudents(list) {
    const q = (studentSearch.value || "").toLowerCase().trim();
    const filtered = q
      ? list.filter((s) => {
          const name = fullName(s).toLowerCase();
          return name.includes(q) || (s.id || "").includes(q);
        })
      : list;

    studentList.innerHTML = "";
    filtered.forEach((s) => {
      const div = document.createElement("div");
      div.className = "student-item";
      const imgSrc = s.photo_path ? "/data/" + s.photo_path : "";
      div.innerHTML =
        (imgSrc
          ? '<img class="avatar" src="' + imgSrc + '" alt=""/>'
          : '<div class="avatar"></div>') +
        '<div class="info"><strong>' +
        fullName(s) +
        "</strong><small>" +
        (s.id || "") +
        " · " +
        (s.school || "") +
        " · " +
        (s.subject || "") +
        "</small></div>" +
        '<div class="actions">' +
        '<button type="button" class="btn" data-act="dav">Даъватнома</button>' +
        '<button type="button" class="btn" data-act="exam">Варақа</button>' +
        '<button type="button" class="btn" data-act="save">Захира</button>' +
        '<button type="button" class="btn" data-act="del">Нест</button>' +
        "</div>";

      div.querySelector('[data-act="dav"]').onclick = () =>
        window.open("/api/students/" + s.id + "/davotnoma", "_blank");
      div.querySelector('[data-act="exam"]').onclick = () =>
        window.open("/api/students/" + s.id + "/exam-sheet", "_blank");
      div.querySelector('[data-act="save"]').onclick = async () => {
        const r = await fetch("/api/students/" + s.id + "/save-local", {
          method: "POST",
        });
        const d = await r.json();
        showMsg(d.ok ? "Захира шуд" : d.error || "Хато", !!d.ok);
      };
      div.querySelector('[data-act="del"]').onclick = async () => {
        if (!confirm("Нест карда шавад?")) return;
        await fetch("/api/students/" + s.id, { method: "DELETE" });
        loadStudents();
      };
      studentList.appendChild(div);
    });
  }

  studentSearch.addEventListener("input", () => loadStudents());
  btnRefreshStudents.addEventListener("click", loadStudents);

  // init
  if (navigator.mediaDevices) loadCameras();
  loadStudents();
})();

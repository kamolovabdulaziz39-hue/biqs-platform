// ===== INDUSTRIAL WEB PLATFORM JAVASCRIPT FOR JV UZ-TONG HONG CO. =====

let currentUser = null;
let allDepartments = [];
let allAssemblyLines = [];
let allIssues = [];
let chartStatusInstance = null;
let chartBiqsInstance = null;

let currentIssuePhotoUrl = "";
let currentVerifyPhotoUrl = "";

const BIQS_STANDARD_QUESTIONS = [
  { section: "Standardized Work", question_ru: "Рабочий точно соблюдает SOS (Standard Operation Sheet) и карту действий?", question_uz: "Ishchi SOS yoʻriqnomasiga va harakatlar ketma-ketligiga qatʼiy amal qilmoqdami?" },
  { section: "Quality Gate", question_ru: "Проводится ли 100% самоконтроль затяжки и критических параметров перед передачей?", question_uz: "Keyingi postga uzatishdan oldin 100% oʻz-oʻzini nazorat qilish bajarilmoqdami?" },
  { section: "Error Proofing (Poka-Yoke)", question_ru: "Исправны ли датчики наличия деталей, блокираторы и сенсоры оснастки?", question_uz: "Detallar mavjudligi sensorlari va Poka-Yoke toʻsiqlari soz holatdami?" },
  { section: "5S & Безопасность", question_ru: "Рабочая зона 5S свободна от посторонних предметов, инструмент на своих местах?", question_uz: "5S ish zonasi tartiblangan, asboblar oʻz oʻrnida va xavfsizlik taʼminlanganmi?" },
  { section: "Fast Response & Red Box", question_ru: "Все выявленные несоответствия изолированы в карантинной зоне (Red Box)?", question_uz: "Aniqlangan barcha nuqsonli qismlar Red Box (Qizil quti) zonasiga izolyatsiya qilinganmi?" }
];

document.addEventListener("DOMContentLoaded", () => {
  checkAuth();
  setupAuthEventListeners();
  setupIssueUploadHandlers();
  setupAdminCreateUserHandler();
  setupLineCreateHandler();
});

// ==================== AUTHENTICATION LOGIC ====================

function toggleAdminAuth(showAdmin) {
  const boxInvite = document.getElementById("auth-box-invite");
  const boxAdmin = document.getElementById("auth-box-admin");

  if (showAdmin) {
    boxInvite.classList.add("hidden");
    boxAdmin.classList.remove("hidden");
    document.getElementById("input-admin-pass").focus();
  } else {
    boxAdmin.classList.add("hidden");
    boxInvite.classList.remove("hidden");
    document.getElementById("input-invite-only-code").focus();
  }
}

async function enterGuestMode() {
  try {
    const res = await fetch("/api/auth/guest-login", { method: "POST" });
    const data = await res.json();
    if (res.ok && data.status === "success") {
      currentUser = data.user;
      showDashboard();
    }
  } catch (err) {
    alert("Ошибка подключения к серверу");
  }
}

function fillInviteCode(code) {
  toggleAdminAuth(false);
  const input = document.getElementById("input-invite-only-code");
  input.value = code;
  input.focus();
}

function setupAuthEventListeners() {
  // 1. Login via Invite Code
  const formInviteLogin = document.getElementById("form-invite-login");
  if (formInviteLogin) {
    formInviteLogin.addEventListener("submit", async (e) => {
      e.preventDefault();
      const invite_code = document.getElementById("input-invite-only-code").value.trim();
      const full_name = document.getElementById("input-inspector-name").value.trim();
      const errBox = document.getElementById("invite-login-error");
      const errTxt = document.getElementById("invite-login-error-text");
      errBox.classList.add("hidden");

      try {
        const res = await fetch("/api/auth/invite-code-login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ invite_code, full_name })
        });
        const data = await res.json();
        if (res.ok && data.status === "success") {
          currentUser = data.user;
          showDashboard();
        } else {
          errTxt.textContent = data.detail || "Неверный код приглашения";
          errBox.classList.remove("hidden");
        }
      } catch (err) {
        errTxt.textContent = t("errConnection");
        errBox.classList.remove("hidden");
      }
    });
  }

  // 2. Admin Login
  const formAdminLogin = document.getElementById("form-admin-login");
  if (formAdminLogin) {
    formAdminLogin.addEventListener("submit", async (e) => {
      e.preventDefault();
      const username = document.getElementById("input-admin-user").value.trim();
      const password = document.getElementById("input-admin-pass").value.trim();
      const errBox = document.getElementById("admin-login-error");
      const errTxt = document.getElementById("admin-login-error-text");
      errBox.classList.add("hidden");

      try {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        if (res.ok && data.status === "success") {
          currentUser = data.user;
          showDashboard();
        } else {
          errTxt.textContent = data.detail || "Неверный логин или пароль";
          errBox.classList.remove("hidden");
        }
      } catch (err) {
        errTxt.textContent = t("errConnection");
        errBox.classList.remove("hidden");
      }
    });
  }

  // Logout
  const btnLogout = document.getElementById("btn-logout");
  if (btnLogout) {
    btnLogout.addEventListener("click", async () => {
      await fetch("/api/auth/logout", { method: "POST" });
      location.reload();
    });
  }

  // Export PDF
  const btnExport = document.getElementById("btn-export-pdf");
  if (btnExport) {
    btnExport.addEventListener("click", () => {
      window.print();
    });
  }
}

async function checkAuth() {
  try {
    const res = await fetch("/api/auth/me");
    const data = await res.json();
    if (data.authenticated && data.user) {
      currentUser = data.user;
      showDashboard();
    } else {
      document.getElementById("auth-screen").classList.remove("hidden");
      document.getElementById("dashboard-screen").classList.add("hidden");
    }
  } catch (err) {
    document.getElementById("auth-screen").classList.remove("hidden");
  }
}

async function showDashboard() {
  document.getElementById("auth-screen").classList.add("hidden");
  document.getElementById("dashboard-screen").classList.remove("hidden");

  // Populate User Profile Header
  document.getElementById("user-display-name").textContent = currentUser.full_name || currentUser.username;
  
  const roleDisplayNames = {
    admin: "Главный Администратор",
    director: t("roleDirector"),
    shop_head: t("roleShopHead"),
    operator: t("roleOperator"),
    auditor: t("roleAuditor"),
    user: t("roleUser"),
    guest: t("roleGuest")
  };
  document.getElementById("user-display-role").textContent = roleDisplayNames[currentUser.role] || currentUser.role;

  await loadDepartments();
  await loadAssemblyLines();
  setupDepartmentIsolation();

  // Navigation Access Control
  const navMod1 = document.getElementById("nav-btn-mod1");
  const navMod2 = document.getElementById("nav-btn-mod2");
  const navMod3 = document.getElementById("nav-btn-mod3");
  const navMod4 = document.getElementById("nav-btn-mod4");

  if (currentUser.role === "admin") {
    navMod1.classList.remove("hidden");
    navMod2.classList.remove("hidden");
    navMod3.classList.remove("hidden");
    navMod4.classList.remove("hidden");
    switchModule("mod1");
  } else if (currentUser.role === "director") {
    navMod1.classList.remove("hidden");
    navMod2.classList.remove("hidden");
    navMod3.classList.remove("hidden");
    navMod4.classList.add("hidden");
    switchModule("mod3");
  } else if (currentUser.role === "guest") {
    navMod1.classList.add("hidden");
    navMod2.classList.remove("hidden");
    navMod3.classList.add("hidden");
    navMod4.classList.add("hidden");
    const banner = document.getElementById("guest-mode-banner");
    if (banner) banner.classList.remove("hidden");
    switchModule("mod2");
  } else {
    // Workers with Invite Code
    navMod1.classList.remove("hidden");
    navMod2.classList.remove("hidden");
    navMod3.classList.add("hidden");
    navMod4.classList.add("hidden");
    switchModule("mod1");
  }

  await loadIssues();
  await loadAudits();

  if (currentUser.role === "admin" || currentUser.role === "director") {
    await loadExecutiveSummary();
  }

  if (currentUser.role === "admin") {
    await loadAdminKeys();
    await loadAdminLines();
    await loadAdminUsers();
    await loadAdminLogs();
  }
}

// ==================== DEPARTMENTS & ASSEMBLY LINES ====================

async function loadDepartments() {
  try {
    const res = await fetch("/api/departments");
    const data = await res.json();
    allDepartments = data.departments || [];
    const isUz = getLanguage() === "uz";

    const deptSelect = document.getElementById("filter-dept-select");
    if (deptSelect) {
      deptSelect.innerHTML = `<option value="all">${t("filterAllDepts")}</option>` + 
        allDepartments.map(d => `<option value="${d.id}">${d.code}: ${isUz ? d.name_uz : d.name_ru}</option>`).join("");
    }

    const issueDeptSelect = document.getElementById("issue-target-dept");
    if (issueDeptSelect) {
      issueDeptSelect.innerHTML = allDepartments.map(d => `<option value="${d.id}">${d.code}: ${isUz ? d.name_uz : d.name_ru}</option>`).join("");
    }

    const auditDeptSelect = document.getElementById("audit-dept-select");
    if (auditDeptSelect) {
      auditDeptSelect.innerHTML = allDepartments.map(d => `<option value="${d.id}">${d.code}: ${isUz ? d.name_uz : d.name_ru}</option>`).join("");
    }

    const keyDeptSelect = document.getElementById("key-dept-select");
    if (keyDeptSelect) {
      keyDeptSelect.innerHTML = `<option value="all">${t("deptAll")}</option>` + 
        allDepartments.map(d => `<option value="${d.id}">${d.code}: ${isUz ? d.name_uz : d.name_ru}</option>`).join("");
    }

    const adminNewDept = document.getElementById("admin-new-dept");
    if (adminNewDept) {
      adminNewDept.innerHTML = `<option value="all">${t("deptAll")}</option>` + 
        allDepartments.map(d => `<option value="${d.id}">${d.code}: ${isUz ? d.name_uz : d.name_ru}</option>`).join("");
    }

    const lineDeptSelect = document.getElementById("line-dept-select");
    if (lineDeptSelect) {
      lineDeptSelect.innerHTML = allDepartments.map(d => `<option value="${d.id}">${d.code}: ${isUz ? d.name_uz : d.name_ru}</option>`).join("");
    }

  } catch (err) {
    console.error("Error loading departments:", err);
  }
}

async function loadAssemblyLines() {
  try {
    const res = await fetch("/api/lines");
    const data = await res.json();
    allAssemblyLines = data.lines || [];
  } catch (err) {
    console.error("Error loading lines:", err);
  }
}

function onIssueDeptChange() {
  const deptId = document.getElementById("issue-target-dept").value;
  const lineInput = document.getElementById("issue-line-name");
  const filtered = allAssemblyLines.filter(l => l.department_id === deptId);
  if (filtered.length > 0) {
    lineInput.value = filtered[0].name;
  }
}

function setupDepartmentIsolation() {
  const badge = document.getElementById("user-dept-badge");
  const isUz = getLanguage() === "uz";

  if (currentUser.department_id && currentUser.department_id !== "all") {
    const dept = allDepartments.find(d => d.id === currentUser.department_id);
    const deptName = dept ? (isUz ? dept.name_uz : dept.name_ru) : currentUser.department_id;
    badge.textContent = `${dept ? dept.code : ""}: ${deptName}`;
  } else {
    badge.textContent = t("deptAll");
  }
}

function switchModule(modId) {
  document.querySelectorAll(".module-nav-btn").forEach(b => b.classList.remove("active"));
  document.querySelectorAll(".module-section").forEach(s => s.classList.add("hidden"));

  const navBtn = document.getElementById(`nav-btn-${modId}`);
  const section = document.getElementById(`section-${modId}`);

  if (navBtn) navBtn.classList.add("active");
  if (section) section.classList.remove("hidden");

  if (modId === "mod3") {
    loadExecutiveSummary();
  }
}

// ==================== MODULE 1: LINE ISSUES & REPORTING ====================

async function loadIssues() {
  const deptSelect = document.getElementById("filter-dept-select");
  const selectedDept = deptSelect ? deptSelect.value : "all";

  try {
    const url = selectedDept !== "all" ? `/api/issues?department_id=${selectedDept}` : "/api/issues";
    const res = await fetch(url);
    const data = await res.json();
    allIssues = data.issues || [];
    renderIssues(allIssues);
  } catch (err) {
    console.error("Error loading issues:", err);
  }
}

function filterIssuesByStatus() {
  const status = document.getElementById("filter-status-select").value;
  if (status === "all") {
    renderIssues(allIssues);
  } else {
    renderIssues(allIssues.filter(i => i.status === status));
  }
}

function renderIssues(issues) {
  const container = document.getElementById("issues-list-container");
  if (!container) return;
  const isUz = getLanguage() === "uz";

  if (!issues || issues.length === 0) {
    container.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-muted); background: #ffffff; border-radius: 12px; border: 1px solid var(--bg-card-border);"><i class="fa-solid fa-circle-check" style="font-size: 32px; color: var(--accent-emerald); margin-bottom: 12px;"></i><br>${t("noIssuesFound")}</div>`;
    return;
  }

  container.innerHTML = issues.map(issue => {
    const deptName = isUz ? issue.dept_name_uz : issue.dept_name_ru;
    const severityBadge = getSeverityBadge(issue.severity);
    const stepperHtml = renderStepper(issue.status);
    const reporterName = issue.reporter_name || issue.created_by_user;

    return `
      <div class="issue-card">
        <div class="issue-card-top">
          <div style="display: flex; align-items: center; gap: 6px;">
            <span class="ticket-code">${issue.ticket_number}</span>
            <span class="badge-tag badge-blue">${issue.dept_code || 'WS'}</span>
          </div>
          ${severityBadge}
        </div>

        <div>
          <h3 class="issue-title">${issue.defect_type}</h3>
          <div class="issue-line-sub">
            <i class="fa-solid fa-location-dot" style="color: var(--primary-blue);"></i>
            <span>${issue.line_name} (${deptName || ''})</span>
          </div>
          <div style="font-size: 11px; color: var(--text-muted); margin-top: 4px; display: flex; gap: 12px; flex-wrap: wrap;">
            <span><i class="fa-solid fa-user-pen"></i> ${t("lblReporter")} <strong>${reporterName}</strong></span>
            ${issue.downtime_minutes > 0 ? `<span style="color: #b91c1c; font-weight: 700;"><i class="fa-solid fa-clock-rotate-left"></i> ${t("lblDowntime")} ${issue.downtime_minutes} min</span>` : ''}
          </div>
        </div>

        ${stepperHtml}

        <div class="issue-desc-box">
          <strong>${t("defectDescLabel")}</strong> ${issue.description}
          ${issue.assigned_to ? `<div style="margin-top: 6px; font-weight: 600; color: var(--primary-blue-dark);"><i class="fa-solid fa-user-check"></i> ${t("assignedToLabel")} ${issue.assigned_to}</div>` : ''}
          ${issue.action_taken ? `<div style="margin-top: 6px; font-weight: 600; color: #15803d;"><i class="fa-solid fa-wrench"></i> ${t("actionTakenLabel")} ${issue.action_taken}</div>` : ''}
        </div>

        <div class="photos-compare-grid">
          ${issue.initial_photo_url ? `
            <div class="photo-compare-item" onclick="openPhotoViewer('${issue.initial_photo_url}', '${issue.ticket_number}')">
              <img src="${issue.initial_photo_url}" alt="Rasm">
              <div class="photo-compare-label"><i class="fa-solid fa-magnifying-glass"></i> ${t("lblBeforeFix")}</div>
            </div>
          ` : `
            <div class="photo-compare-placeholder">
              <i class="fa-solid fa-image"></i>
              <span>${t("lblNoPhotoDefect")}</span>
            </div>
          `}

          ${issue.verification_photo_url ? `
            <div class="photo-compare-item" onclick="openPhotoViewer('${issue.verification_photo_url}', '${issue.ticket_number}')">
              <img src="${issue.verification_photo_url}" alt="Rasm">
              <div class="photo-compare-label" style="background: rgba(16, 185, 129, 0.9);"><i class="fa-solid fa-check"></i> ${t("lblAfterFix")}</div>
            </div>
          ` : `
            <div class="photo-compare-placeholder">
              <i class="fa-solid fa-camera-rotate"></i>
              <span>${t("lblWaitingPhotoVerify")}</span>
            </div>
          `}
        </div>

        <div class="issue-action-btn-row">
          ${renderIssueActionButtons(issue)}
        </div>
      </div>
    `;
  }).join("");
}

function getSeverityBadge(severity) {
  if (severity === "critical_stop") {
    return `<span class="badge-tag badge-stop-pulse"><i class="fa-solid fa-hand"></i> ${t("severityStop")}</span>`;
  } else if (severity === "major") {
    return `<span class="badge-tag badge-warning"><i class="fa-solid fa-triangle-exclamation"></i> ${t("severityMajor")}</span>`;
  } else {
    return `<span class="badge-tag badge-blue"><i class="fa-solid fa-circle-info"></i> ${t("severityMinor")}</span>`;
  }
}

function renderStepper(status) {
  const steps = [
    { key: "open", num: 1, label: t("statusOpen") },
    { key: "assigned", num: 2, label: "Usta" },
    { key: "in_progress", num: 3, label: "Ta'mirlash" },
    { key: "verification", num: 4, label: "Foto-tekshiruv" },
    { key: "closed", num: 5, label: "Yopildi" }
  ];

  const order = { open: 1, assigned: 2, in_progress: 3, verification: 4, closed: 5 };
  const currentLevel = order[status] || 1;

  return `
    <div class="lifecycle-stepper">
      ${steps.map(s => {
        let cls = "";
        if (s.num < currentLevel) cls = "completed";
        else if (s.num === currentLevel) cls = "active";
        return `
          <div class="stepper-step ${cls}">
            <div class="stepper-circle">${cls === "completed" ? '<i class="fa-solid fa-check"></i>' : s.num}</div>
            <div class="stepper-label">${s.label}</div>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

function renderIssueActionButtons(issue) {
  if (currentUser && currentUser.role === "guest") return "";

  switch (issue.status) {
    case "open":
      return `
        <button class="btn-card-action" style="background: var(--primary-blue); color: #ffffff;" onclick="openAssignModal('${issue.id}')">
          <i class="fa-solid fa-user-plus"></i> <span>${t("btnAssignMaster")}</span>
        </button>
      `;
    case "assigned":
      return `
        <button class="btn-card-action" style="background: #0284c7; color: #ffffff;" onclick="startIssueWork('${issue.id}')">
          <i class="fa-solid fa-play"></i> <span>${t("btnTakeInWork")}</span>
        </button>
      `;
    case "in_progress":
      return `
        <button class="btn-card-action" style="background: #f59e0b; color: #ffffff;" onclick="openVerifyModal('${issue.id}')">
          <i class="fa-solid fa-camera-retro"></i> <span>${t("btnSendVerification")}</span>
        </button>
      `;
    case "verification":
      return `
        <button class="btn-card-action" style="background: #10b981; color: #ffffff;" onclick="closeIssueAction('${issue.id}')">
          <i class="fa-solid fa-circle-check"></i> <span>${t("btnCloseIssue")}</span>
        </button>
      `;
    case "closed":
      return `
        <div style="text-align: center; color: #15803d; font-weight: 700; font-size: 12px;">
          <i class="fa-solid fa-circle-check"></i> ${t("statusClosed")}
        </div>
      `;
    default:
      return "";
  }
}

function openAssignModal(issueId) {
  document.getElementById("assign-issue-id").value = issueId;
  document.getElementById("modal-assign-issue").classList.remove("hidden");
}

document.getElementById("form-assign-issue").addEventListener("submit", async (e) => {
  e.preventDefault();
  const issueId = document.getElementById("assign-issue-id").value;
  const assigned_to = document.getElementById("assign-input-name").value.trim();

  try {
    const res = await fetch(`/api/issues/${issueId}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assigned_to })
    });
    if (res.ok) {
      closeModal("modal-assign-issue");
      document.getElementById("assign-input-name").value = "";
      await loadIssues();
    }
  } catch (err) {
    alert("Ошибка назначения мастера");
  }
});

async function startIssueWork(issueId) {
  try {
    const res = await fetch(`/api/issues/${issueId}/start`, { method: "POST" });
    if (res.ok) {
      await loadIssues();
    }
  } catch (err) {
    alert("Ошибка перевода в работу");
  }
}

function openVerifyModal(issueId) {
  document.getElementById("verify-issue-id").value = issueId;
  document.getElementById("verify-action-taken").value = "";
  document.getElementById("verify-photo-url").value = "";
  document.getElementById("verify-photo-preview").classList.add("hidden");
  currentVerifyPhotoUrl = "";
  document.getElementById("modal-verify-issue").classList.remove("hidden");
}

document.getElementById("form-verify-issue").addEventListener("submit", async (e) => {
  e.preventDefault();
  const issueId = document.getElementById("verify-issue-id").value;
  const action_taken = document.getElementById("verify-action-taken").value.trim();
  const photoUrl = document.getElementById("verify-photo-url").value.trim() || currentVerifyPhotoUrl;

  if (!photoUrl) {
    alert(t("errSelectPhoto"));
    return;
  }

  try {
    const res = await fetch(`/api/issues/${issueId}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action_taken, verification_photo_url: photoUrl })
    });
    if (res.ok) {
      closeModal("modal-verify-issue");
      await loadIssues();
    }
  } catch (err) {
    alert("Ошибка отправки фото устранения");
  }
});

async function closeIssueAction(issueId) {
  if (!confirm("Подтвердить закрытие задачи?")) return;
  try {
    const res = await fetch(`/api/issues/${issueId}/close`, { method: "POST" });
    if (res.ok) {
      await loadIssues();
    }
  } catch (err) {
    alert("Ошибка закрытия задачи");
  }
}

function openNewIssueModal() {
  document.getElementById("form-create-issue").reset();
  removeIssuePhoto();
  if (currentUser) {
    document.getElementById("issue-reporter-name").value = currentUser.full_name || currentUser.username;
  }
  onIssueDeptChange();
  document.getElementById("modal-new-issue").classList.remove("hidden");
}

function setupIssueUploadHandlers() {
  const formCreateIssue = document.getElementById("form-create-issue");
  if (formCreateIssue) {
    formCreateIssue.addEventListener("submit", async (e) => {
      e.preventDefault();
      const reporter_name = document.getElementById("issue-reporter-name").value.trim();
      const department_id = document.getElementById("issue-target-dept").value;
      const line_name = document.getElementById("issue-line-name").value.trim();
      const defect_type = document.getElementById("issue-defect-type").value.trim();
      const severity = document.getElementById("issue-severity").value;
      const downtime_minutes = parseInt(document.getElementById("issue-downtime-minutes").value) || 0;
      const description = document.getElementById("issue-description").value.trim();
      const photoUrl = document.getElementById("issue-photo-url").value.trim() || currentIssuePhotoUrl;

      try {
        const res = await fetch("/api/issues/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reporter_name,
            department_id,
            line_name,
            defect_type,
            severity,
            downtime_minutes,
            description,
            initial_photo_url: photoUrl
          })
        });
        if (res.ok) {
          closeModal("modal-new-issue");
          await loadIssues();
          alert("Проблема успешно зафиксирована!");
        }
      } catch (err) {
        alert("Ошибка отправки данных");
      }
    });
  }
}

function handleIssueFileSelect(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (e) => {
    const base64Data = e.target.result;
    document.getElementById("issue-preview-img").src = base64Data;
    document.getElementById("issue-photo-preview").classList.remove("hidden");

    try {
      const res = await fetch("/api/upload/photo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_data: base64Data, filename_prefix: "defect" })
      });
      const data = await res.json();
      if (res.ok && data.photo_url) {
        currentIssuePhotoUrl = data.photo_url;
        document.getElementById("issue-photo-url").value = data.photo_url;
      }
    } catch (err) {
      currentIssuePhotoUrl = base64Data;
    }
  };
  reader.readAsDataURL(file);
}

function removeIssuePhoto() {
  currentIssuePhotoUrl = "";
  document.getElementById("issue-photo-url").value = "";
  document.getElementById("issue-preview-img").src = "";
  document.getElementById("issue-photo-preview").classList.add("hidden");
}

function handleVerifyFileSelect(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (e) => {
    const base64Data = e.target.result;
    document.getElementById("verify-preview-img").src = base64Data;
    document.getElementById("verify-photo-preview").classList.remove("hidden");

    try {
      const res = await fetch("/api/upload/photo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_data: base64Data, filename_prefix: "resolved" })
      });
      const data = await res.json();
      if (res.ok && data.photo_url) {
        currentVerifyPhotoUrl = data.photo_url;
        document.getElementById("verify-photo-url").value = data.photo_url;
      }
    } catch (err) {
      currentVerifyPhotoUrl = base64Data;
    }
  };
  reader.readAsDataURL(file);
}

// ==================== MODULE 2: BIQS AUDITS ====================

async function loadAudits() {
  try {
    const res = await fetch("/api/audits/biqs");
    const data = await res.json();
    const audits = data.audits || [];
    renderAudits(audits);
  } catch (err) {
    console.error("Error loading audits:", err);
  }
}

function renderAudits(audits) {
  const container = document.getElementById("audits-list-container");
  if (!container) return;
  const isUz = getLanguage() === "uz";

  if (!audits || audits.length === 0) {
    container.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-muted); background: #ffffff; border-radius: 12px; border: 1px solid var(--bg-card-border);"><i class="fa-solid fa-clipboard-check" style="font-size: 32px; color: var(--primary-blue); margin-bottom: 12px;"></i><br>Аудитов качества пока не зафиксировано.</div>`;
    return;
  }

  container.innerHTML = audits.map(audit => {
    const deptName = isUz ? audit.dept_name_uz : audit.dept_name_ru;
    return `
      <div class="audit-card">
        <div class="audit-card-header">
          <div>
            <div style="font-size: 11px; font-weight: 700; color: var(--primary-blue-dark); text-transform: uppercase;">
              ${audit.dept_code}: ${deptName || ''}
            </div>
            <h3 style="font-size: 15px; font-weight: 800; color: var(--primary-navy); margin-top: 2px;">
              ${audit.line_name}
            </h3>
          </div>
          <div class="audit-score-pill">
            ${audit.compliance_score}%
          </div>
        </div>

        <div style="font-size: 11px; color: var(--text-muted); display: flex; align-items: center; gap: 8px;">
          <span><i class="fa-solid fa-user-tie"></i> ${audit.auditor_name}</span>
          <span>•</span>
          <span><i class="fa-solid fa-clock"></i> ${audit.created_at}</span>
        </div>

        <div class="audit-worker-box">
          <strong><i class="fa-solid fa-person-circle-question"></i> ${t("workerKnowledgeLabel")}</strong><br>
          ${audit.worker_name} — <span style="font-weight: 700; color: ${audit.worker_knowledge_status.includes('Знает') || audit.worker_knowledge_status.includes('biladi') ? '#15803d' : '#b45309'};">${audit.worker_knowledge_status}</span>
        </div>

        <div class="audit-questions-box">
          ${(audit.questions || []).map(q => `
            <div class="audit-q-item">
              <div style="max-width: 80%;">
                <strong>${q.section}</strong>: ${q.question}<br>
                ${q.comment ? `<span style="color: var(--text-muted); font-size: 10px;">${q.comment}</span>` : ''}
              </div>
              <span class="badge-tag ${q.status === 'passed' ? 'badge-green' : 'badge-danger'}">
                ${q.status === 'passed' ? t("statusPassed") : t("statusViolation")}
              </span>
            </div>
          `).join("")}
        </div>

        ${audit.violation_photos && audit.violation_photos.length > 0 ? `
          <div>
            <div style="font-size: 11px; font-weight: 700; color: var(--text-muted); margin-bottom: 4px;"><i class="fa-solid fa-camera"></i> ${t("violationPhotosLabel")}</div>
            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
              ${audit.violation_photos.map(p => `
                <img src="${p}" style="width: 80px; height: 60px; object-fit: cover; border-radius: 6px; cursor: pointer; border: 1px solid var(--bg-card-border);" onclick="openPhotoViewer('${p}', 'Фото нарушения BIQS')" alt="Фото нарушения">
              `).join("")}
            </div>
          </div>
        ` : ''}

        ${audit.comments ? `
          <div style="font-size: 11px; font-style: italic; color: var(--text-muted); background: #f1f5f9; padding: 6px 10px; border-radius: 4px;">
            <i class="fa-solid fa-quote-left"></i> ${audit.comments}
          </div>
        ` : ''}
      </div>
    `;
  }).join("");
}

function openNewAuditModal() {
  const isUz = getLanguage() === "uz";
  document.getElementById("audit-auditor-name").value = currentUser.full_name || currentUser.username;
  document.getElementById("audit-line-input").value = "";
  document.getElementById("audit-worker-name").value = "";
  document.getElementById("audit-violation-photo").value = "";
  document.getElementById("audit-comments").value = "";

  const container = document.getElementById("audit-questions-container");
  container.innerHTML = BIQS_STANDARD_QUESTIONS.map((q, idx) => `
    <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 8px 12px; border-radius: 6px; margin-bottom: 6px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
        <span style="font-size: 12px; font-weight: 700; color: var(--primary-navy);">${q.section}</span>
        <div style="display: flex; gap: 8px;">
          <label style="font-size: 11px; font-weight: 600; color: #15803d; cursor: pointer;">
            <input type="radio" name="audit_q_${idx}" value="passed" checked> ${t("statusPassed")}
          </label>
          <label style="font-size: 11px; font-weight: 600; color: #b91c1c; cursor: pointer;">
            <input type="radio" name="audit_q_${idx}" value="violation"> ${t("statusViolation")}
          </label>
        </div>
      </div>
      <div style="font-size: 11px; color: var(--text-muted);">${isUz ? q.question_uz : q.question_ru}</div>
      <input type="text" id="audit_comment_${idx}" class="form-input" placeholder="Комментарий..." style="margin-top: 6px; padding: 4px 8px; font-size: 11px;">
    </div>
  `).join("");

  document.getElementById("modal-biqs-audit").classList.remove("hidden");
}

const formCreateAudit = document.getElementById("form-create-audit");
if (formCreateAudit) {
  formCreateAudit.addEventListener("submit", async (e) => {
    e.preventDefault();
    const department_id = document.getElementById("audit-dept-select").value;
    const line_name = document.getElementById("audit-line-input").value.trim();
    const auditor_name = document.getElementById("audit-auditor-name").value.trim();
    const worker_name = document.getElementById("audit-worker-name").value.trim();
    const worker_knowledge_status = document.getElementById("audit-worker-knowledge").value;
    const violation_photo = document.getElementById("audit-violation-photo").value.trim();
    const comments = document.getElementById("audit-comments").value.trim();

    let passedCount = 0;
    const isUz = getLanguage() === "uz";
    const questions = BIQS_STANDARD_QUESTIONS.map((q, idx) => {
      const radio = document.querySelector(`input[name="audit_q_${idx}"]:checked`);
      const status = radio ? radio.value : "passed";
      if (status === "passed") passedCount++;
      const comment = document.getElementById(`audit_comment_${idx}`).value.trim();
      return {
        section: q.section,
        question: isUz ? q.question_uz : q.question_ru,
        status,
        comment
      };
    });

    const compliance_score = Math.round((passedCount / BIQS_STANDARD_QUESTIONS.length) * 1000) / 10;
    const violation_photos = violation_photo ? [violation_photo] : [];

    try {
      const res = await fetch("/api/audits/biqs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          department_id,
          line_name,
          auditor_name,
          worker_name,
          worker_knowledge_status,
          compliance_score,
          questions,
          violation_photos,
          comments
        })
      });
      if (res.ok) {
        closeModal("modal-biqs-audit");
        await loadAudits();
        if (currentUser.role === "admin" || currentUser.role === "director") {
          await loadExecutiveSummary();
        }
      }
    } catch (err) {
      alert("Ошибка сохранения аудита");
    }
  });
}

// ==================== MODULE 3: EXECUTIVE SUMMARY ====================

async function loadExecutiveSummary() {
  try {
    const res = await fetch("/api/dashboard/summary");
    const data = await res.json();

    document.getElementById("kpi-total-val").textContent = data.total_issues || 0;
    document.getElementById("kpi-open-val").textContent = data.open_issues || 0;
    document.getElementById("kpi-active-val").textContent = data.active_issues || 0;
    document.getElementById("kpi-closed-val").textContent = data.closed_issues || 0;
    document.getElementById("kpi-biqs-val").textContent = `${data.avg_biqs_score}%`;
    document.getElementById("kpi-sla-val").textContent = `${data.total_downtime_minutes || 0} мин`;

    renderExecutiveCharts(data);
    renderExecutiveTable(data.departments_matrix || []);
  } catch (err) {
    console.error("Error loading summary:", err);
  }
}

function renderExecutiveCharts(data) {
  const ctxStatus = document.getElementById("chartIssuesStatus");
  if (ctxStatus) {
    if (chartStatusInstance) chartStatusInstance.destroy();
    chartStatusInstance = new Chart(ctxStatus, {
      type: "doughnut",
      data: {
        labels: [t("statusOpen"), t("kpiInWork"), t("statusClosed")],
        datasets: [{
          data: [data.open_issues || 0, data.active_issues || 0, data.closed_issues || 0],
          backgroundColor: ["#ef4444", "#f59e0b", "#10b981"],
          borderWidth: 2,
          borderColor: "#ffffff"
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "70%",
        plugins: {
          legend: { position: "bottom", labels: { font: { size: 11 }, boxWidth: 12 } }
        }
      }
    });
  }

  const ctxBiqs = document.getElementById("chartBiqsDepts");
  if (ctxBiqs && data.departments_matrix) {
    if (chartBiqsInstance) chartBiqsInstance.destroy();
    const labels = data.departments_matrix.map(d => d.code);
    const scores = data.departments_matrix.map(d => d.compliance_score);

    chartBiqsInstance = new Chart(ctxBiqs, {
      type: "bar",
      data: {
        labels,
        datasets: [{
          label: t("kpiBiqsIndex") + " (%)",
          data: scores,
          backgroundColor: scores.map(s => s >= 95 ? "rgba(16, 185, 129, 0.85)" : "rgba(245, 158, 11, 0.85)"),
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { min: 80, max: 100, grid: { color: "#e2e8f0" } },
          x: { grid: { display: false } }
        },
        plugins: {
          legend: { display: false }
        }
      }
    });
  }
}

function renderExecutiveTable(depts) {
  const tbody = document.getElementById("executive-dept-rows");
  if (!tbody) return;
  const isUz = getLanguage() === "uz";

  tbody.innerHTML = depts.map(d => `
    <tr>
      <td><strong>${d.code}</strong></td>
      <td><strong>${isUz ? d.name_uz : d.name_ru}</strong></td>
      <td>${d.head_name}</td>
      <td style="font-weight: 700; color: var(--primary-blue-dark);">${d.issue_count || 0}</td>
      <td><span class="badge-tag ${(d.open_count || 0) > 0 ? 'badge-danger' : 'badge-green'}">${d.open_count || 0}</span></td>
      <td><span class="badge-tag badge-green">${d.closed_count || 0}</span></td>
      <td><strong style="color: #15803d;">${d.compliance_score}%</strong></td>
      <td><span class="badge-tag badge-green">В норме</span></td>
    </tr>
  `).join("");
}

// ==================== MODULE 4: ADMIN PANEL SUBTABS ====================

function switchAdminSubTab(tabName) {
  document.querySelectorAll("#section-mod4 .filter-select").forEach(b => b.classList.remove("active"));
  document.querySelectorAll(".admin-subtab").forEach(s => s.classList.add("hidden"));

  const btn = document.getElementById(`admin-tab-btn-${tabName}`);
  const target = document.getElementById(`admin-subtab-${tabName}`);

  if (btn) btn.classList.add("active");
  if (target) target.classList.remove("hidden");

  if (tabName === "keys") loadAdminKeys();
  if (tabName === "lines") loadAdminLines();
  if (tabName === "users") loadAdminUsers();
  if (tabName === "logs") loadAdminLogs();
}

async function loadAdminKeys() {
  try {
    const res = await fetch("/api/admin/invite-keys");
    const data = await res.json();
    const tbody = document.getElementById("invite-keys-rows");
    if (!tbody) return;
    const keys = data.keys || [];

    tbody.innerHTML = keys.map(k => `
      <tr>
        <td>
          <code style="font-weight: 800; font-size: 13px; color: var(--primary-blue-dark); cursor: pointer;" onclick="copyKey('${k.key_code}')" title="Кликните для копирования">
            ${k.key_code} <i class="fa-solid fa-copy" style="font-size: 11px;"></i>
          </code>
        </td>
        <td><span class="badge-tag badge-blue">${k.role}</span></td>
        <td>${k.dept_code ? `${k.dept_code} (${k.dept_name_ru})` : 'Все цеха'}</td>
        <td><strong>${k.used_count}</strong> / ${k.max_uses}</td>
        <td>
          <span class="badge-tag ${k.is_active ? 'badge-green' : 'badge-danger'}">
            ${k.is_active ? 'Активен' : 'Исчерпан / Отозван'}
          </span>
        </td>
        <td style="color: var(--text-muted); font-size: 11px;">${k.note || '—'}</td>
        <td>
          <button type="button" class="btn-primary-block" style="padding: 4px 8px; font-size: 11px; width: auto; background: ${k.is_active ? '#fee2e2' : '#dcfce7'}; color: ${k.is_active ? '#dc2626' : '#15803d'}; border: 1px solid ${k.is_active ? '#fca5a5' : '#86efac'};" onclick="toggleKey('${k.id}')">
            ${k.is_active ? t("btnRevoke") : t("btnActivate")}
          </button>
        </td>
      </tr>
    `).join("");
  } catch (err) {
    console.error("Error loading keys:", err);
  }
}

async function loadAdminLines() {
  try {
    const res = await fetch("/api/lines");
    const data = await res.json();
    const tbody = document.getElementById("admin-lines-rows");
    if (!tbody) return;
    const lines = data.lines || [];

    tbody.innerHTML = lines.map(l => `
      <tr>
        <td><span class="badge-tag badge-blue">${l.dept_code || l.department_id}</span></td>
        <td><strong>${l.name}</strong></td>
        <td style="color: var(--text-muted); font-size: 12px;">${l.description || '—'}</td>
        <td><span class="badge-tag ${l.is_active ? 'badge-green' : 'badge-danger'}">${l.is_active ? 'Активна' : 'Отключена'}</span></td>
        <td>
          <button type="button" class="btn-cancel" style="padding: 3px 8px; font-size: 11px; color: #dc2626;" onclick="deleteLine('${l.id}')">
            <i class="fa-solid fa-trash"></i> Удалить
          </button>
        </td>
      </tr>
    `).join("");
  } catch (err) {
    console.error("Error loading admin lines:", err);
  }
}

async function loadAdminUsers() {
  try {
    const res = await fetch("/api/admin/users");
    const data = await res.json();
    const tbody = document.getElementById("admin-users-rows");
    if (!tbody) return;
    const users = data.users || [];

    tbody.innerHTML = users.map(u => `
      <tr>
        <td><strong>${u.username}</strong></td>
        <td>${u.full_name}</td>
        <td><span class="badge-tag badge-blue">${u.role}</span></td>
        <td>${u.dept_code ? `${u.dept_code} (${u.dept_name_ru})` : 'Все цеха'}</td>
        <td>
          <span class="badge-tag ${u.is_active !== 0 ? 'badge-green' : 'badge-danger'}">
            ${u.is_active !== 0 ? 'Активен' : 'Заблокирован'}
          </span>
        </td>
        <td style="color: var(--text-muted); font-size: 11px;">${u.created_at}</td>
        <td>
          <button type="button" class="btn-cancel" style="padding: 3px 8px; font-size: 11px;" onclick="toggleUserActive('${u.id}')">
            ${u.is_active !== 0 ? 'Заблокировать' : 'Разблокировать'}
          </button>
        </td>
      </tr>
    `).join("");
  } catch (err) {
    console.error("Error loading users:", err);
  }
}

async function loadAdminLogs() {
  try {
    const res = await fetch("/api/admin/logs");
    const data = await res.json();
    const tbody = document.getElementById("admin-logs-rows");
    if (!tbody) return;
    const logs = data.logs || [];

    tbody.innerHTML = logs.map(l => `
      <tr>
        <td style="font-size: 11px; color: var(--text-muted);">${l.created_at}</td>
        <td><strong>${l.username || 'Система'}</strong></td>
        <td><span class="badge-tag badge-blue">${l.action}</span></td>
        <td style="font-size: 11px;">${l.detail || '—'}</td>
        <td style="font-size: 11px; font-family: monospace;">${l.ip_address || '—'}</td>
      </tr>
    `).join("");
  } catch (err) {
    console.error("Error loading logs:", err);
  }
}

function openCreateLineModal() {
  document.getElementById("form-create-line").reset();
  const lineDeptSelect = document.getElementById("line-dept-select");
  if (lineDeptSelect && allDepartments.length > 0) {
    const isUz = getLanguage() === "uz";
    lineDeptSelect.innerHTML = allDepartments.map(d => `<option value="${d.id}">${d.code}: ${isUz ? d.name_uz : d.name_ru}</option>`).join("");
  }
  document.getElementById("modal-create-line").classList.remove("hidden");
}

function setupLineCreateHandler() {
  const form = document.getElementById("form-create-line");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const department_id = document.getElementById("line-dept-select").value;
    const name = document.getElementById("line-name-input").value.trim();
    const description = document.getElementById("line-desc-input").value.trim();

    try {
      const res = await fetch("/api/admin/lines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ department_id, name, description })
      });
      if (res.ok) {
        closeModal("modal-create-line");
        await loadAssemblyLines();
        await loadAdminLines();
        alert("Линия сборки успешно добавлена!");
      }
    } catch (err) {
      alert("Ошибка создания линии");
    }
  });
}

async function deleteLine(lineId) {
  if (!confirm("Удалить эту линию сборки?")) return;
  try {
    const res = await fetch(`/api/admin/lines/${lineId}`, { method: "DELETE" });
    if (res.ok) {
      await loadAssemblyLines();
      await loadAdminLines();
    }
  } catch (err) {
    alert("Ошибка удаления линии");
  }
}

async function toggleUserActive(userId) {
  try {
    const res = await fetch(`/api/admin/users/${userId}/toggle`, { method: "POST" });
    if (res.ok) {
      await loadAdminUsers();
    }
  } catch (err) {
    alert("Ошибка изменения статуса пользователя");
  }
}

function setupAdminCreateUserHandler() {
  const form = document.getElementById("form-admin-create-user");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = document.getElementById("admin-new-username").value.trim();
    const password = document.getElementById("admin-new-password").value.trim();
    const full_name = document.getElementById("admin-new-fullname").value.trim();
    const role = document.getElementById("admin-new-role").value;
    const department_id = document.getElementById("admin-new-dept").value;
    const msgBox = document.getElementById("admin-create-user-msg");

    try {
      const res = await fetch("/api/admin/create-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, full_name, role, department_id })
      });
      const data = await res.json();
      if (res.ok && data.status === "success") {
        msgBox.textContent = t("msgUserCreatedSuccess");
        msgBox.style.background = "#dcfce7";
        msgBox.style.color = "#15803d";
        msgBox.classList.remove("hidden");
        form.reset();
        await loadAdminUsers();
        setTimeout(() => msgBox.classList.add("hidden"), 5000);
      } else {
        msgBox.textContent = data.detail || "Ошибка создания пользователя";
        msgBox.style.background = "#fee2e2";
        msgBox.style.color = "#b91c1c";
        msgBox.classList.remove("hidden");
      }
    } catch (err) {
      alert("Ошибка отправки данных");
    }
  });
}

function openCreateKeyModal() {
  document.getElementById("form-create-key").reset();
  document.getElementById("modal-create-key").classList.remove("hidden");
}

const formCreateKey = document.getElementById("form-create-key");
if (formCreateKey) {
  formCreateKey.addEventListener("submit", async (e) => {
    e.preventDefault();
    const role = document.getElementById("key-role-select").value;
    const department_id = document.getElementById("key-dept-select").value;
    const max_uses = parseInt(document.getElementById("key-max-uses").value) || 10;
    const note = document.getElementById("key-note").value.trim();

    try {
      const res = await fetch("/api/admin/invite-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, department_id, max_uses, note })
      });
      const data = await res.json();
      if (res.ok && data.status === "success") {
        closeModal("modal-create-key");
        copyKey(data.key_code);
        alert(`${t("msgSuccessKeyCreated")}\n\nКод: ${data.key_code}`);
        await loadAdminKeys();
      }
    } catch (err) {
      alert("Ошибка генерации ключа");
    }
  });
}

async function toggleKey(keyId) {
  try {
    await fetch(`/api/admin/invite-keys/${keyId}/toggle`, { method: "POST" });
    await loadAdminKeys();
  } catch (err) {
    alert("Ошибка изменения статуса ключа");
  }
}

function copyKey(code) {
  navigator.clipboard.writeText(code);
}

function openPhotoViewer(url, title) {
  document.getElementById("photo-viewer-title").textContent = title || "Фотоматериал";
  document.getElementById("photo-viewer-img").src = url;
  document.getElementById("modal-photo-viewer").classList.remove("hidden");
}

function closeModal(modalId) {
  document.getElementById(modalId).classList.add("hidden");
}

function updateDynamicTexts() {
  if (currentUser) {
    const roleDisplayNames = {
      admin: "Главный Администратор",
      director: t("roleDirector"),
      shop_head: t("roleShopHead"),
      operator: t("roleOperator"),
      auditor: t("roleAuditor"),
      user: t("roleUser")
    };
    document.getElementById("user-display-role").textContent = roleDisplayNames[currentUser.role] || currentUser.role;
    setupDepartmentIsolation();
  }
  loadDepartments();
}

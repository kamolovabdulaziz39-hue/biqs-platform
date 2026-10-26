// ===== INDUSTRIAL DIGITAL MANUFACTURING PLATFORM JS (JV UZ-TONG HONG CO.) =====


function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

let currentUser = null;
let currentSimulatedRole = null;
let allDepartments = [];
let allAssemblyLines = [];
let allAndonEvents = [];
let allShiftReports = [];

let chartDefectsInstance = null;
let chartScrapDeptInstance = null;

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
  setupWorkerShiftInputHandler();
  setupAndonTriggerHandler();
  setupMechanicResolveHandler();
  setupControllerUnlockHandler();
  setupShiftReportHandler();
  setupIncomingInspectionHandler();
  setupReclamationHandler();
  setupEnergyHandlers();
  setupFacilityHandler();
  setupQualityDailyTaskHandlers();
  setupBiqsAuditHandler();
  setupAdminHandlers();
});

// ==================== AUTHENTICATION & SESSION ====================

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

function fillUserCreds(username, password) {
  toggleAdminAuth(true);
  const userInp = document.getElementById("input-admin-user");
  const passInp = document.getElementById("input-admin-pass");
  if (userInp) userInp.value = username;
  if (passInp) passInp.value = password;
}

function fillInviteCode(code) {
  toggleAdminAuth(false);
  const input = document.getElementById("input-invite-only-code");
  input.value = code;
  input.focus();
}

async function enterGuestMode() {
  try {
    const res = await fetch("/api/auth/guest-login", { method: "POST" });
    const data = await res.json();
    if (res.ok && data.status === "success") {
      currentUser = data.user;
      currentSimulatedRole = "director";
      showDashboard();
    }
  } catch (err) {
    alert("Ошибка подключения к серверу");
  }
}

function setupAuthEventListeners() {
  const formInvite = document.getElementById("form-invite-login");
  if (formInvite) {
    formInvite.addEventListener("submit", async (e) => {
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
          currentSimulatedRole = currentUser.role;
          showDashboard();
        } else {
          errTxt.textContent = data.detail || "Неверный код приглашения";
          errBox.classList.remove("hidden");
        }
      } catch (err) {
        errTxt.textContent = "Ошибка соединения с сервером";
        errBox.classList.remove("hidden");
      }
    });
  }

  const formAdmin = document.getElementById("form-admin-login");
  if (formAdmin) {
    formAdmin.addEventListener("submit", async (e) => {
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
          currentSimulatedRole = currentUser.role;
          showDashboard();
        } else {
          errTxt.textContent = data.detail || "Неверный логин или пароль";
          errBox.classList.remove("hidden");
        }
      } catch (err) {
        errTxt.textContent = "Ошибка соединения с сервером";
        errBox.classList.remove("hidden");
      }
    });
  }

  const btnLogout = document.getElementById("btn-logout");
  if (btnLogout) {
    btnLogout.addEventListener("click", async () => {
      await fetch("/api/auth/logout", { method: "POST" });
      location.reload();
    });
  }

  const btnExport = document.getElementById("btn-export-pdf");
  if (btnExport) {
    btnExport.addEventListener("click", () => window.print());
  }
}

async function checkAuth() {
  try {
    const res = await fetch("/api/auth/me");
    const data = await res.json();
    if (data.authenticated && data.user) {
      currentUser = data.user;
      currentSimulatedRole = currentUser.role;
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

  // Profile display
  document.getElementById("user-display-name").textContent = currentUser.full_name || currentUser.username;
  document.getElementById("user-display-role").textContent = getRoleDisplayName(currentUser.role);

  await loadDepartments();
  await loadAssemblyLines();

  // Populate Select Boxes
  populateDepartmentSelects();

  // Setup Role Navigation Access
  setupNavigationPermissions();

  // Load Corridors according to role
  await applyRoleCorridor(currentSimulatedRole || currentUser.role);

  // Background data pre-fetches
  loadAndonFeed();
  loadShiftReports();
  loadExecutiveBI();
  loadWorkerInputs();
}

function getRoleDisplayName(role) {
  const names = {
    director: "Генеральный директор завода",
    shop_head: "Мастер / Начальник цеха",
    operator: "Рабочий линии / Оператор",
    controller: "Контролёр качества ОТК",
    engineer: "Инженер по качеству (Инженерный статус)",
    mechanic: "Наладчик-механик ОГМ",
    mechanic_head: "Главный механик завода (ОГМ)",
    energy_head: "Главный энергетик завода (ОГЭ)",
    facility_head: "Начальник АХО",
    quality_head: "Начальник отдела качества (ОТК)",
    admin: "Главный Администратор",
    guest: "Демо-просмотр"
  };
  return names[role] || role;
}

// ==================== ROLE CORRIDOR SIMULATOR ====================

function simulateRoleSwitch(role) {
  currentSimulatedRole = role;
  applyRoleCorridor(role);
}

async function applyRoleCorridor(role) {
  // Highlight active chip in bar
  document.querySelectorAll(".corridor-chip-btn").forEach(btn => btn.classList.remove("active", "chip-active-director", "chip-active-quality", "chip-active-master", "chip-active-energy"));
  const activeBtn = document.getElementById(`chip-role-${role}`);
  if (activeBtn) {
    activeBtn.classList.add("active");
    if (role === "director") activeBtn.classList.add("chip-active-director");
    if (["engineer", "controller", "quality_head"].includes(role)) activeBtn.classList.add("chip-active-quality");
    if (role === "shop_head") activeBtn.classList.add("chip-active-master");
    if (role === "energy_head") activeBtn.classList.add("chip-active-energy");
  }

  // Update Corridor Banner
  const titleElem = document.getElementById("corridor-role-title");
  const descElem = document.getElementById("corridor-role-desc");
  const pillElem = document.getElementById("corridor-level-pill");
  const iconElem = document.getElementById("corridor-role-icon");

  // Hide all subviews
  document.querySelectorAll(".corridor-subview").forEach(v => v.classList.add("hidden"));

  if (role === "operator") {
    titleElem.textContent = "Рабочее место: Рабочий линии (Сборщик / Сварщик / Штамповщик)";
    descElem.textContent = "Ваша зона ответственности: соблюдение сменного темпа, чек-лист 5S, фиксация выработки (сколько сделал), количества брака и мгновенный вызов Andon при поломке.";
    pillElem.textContent = "Операционный уровень";
    pillElem.className = "status-pill pill-engineer";
    iconElem.innerHTML = '<i class="fa-solid fa-user"></i>';
    document.getElementById("corridor-view-worker").classList.remove("hidden");
    loadWorkerInputs();
    switchModule("corridor");

  } else if (role === "controller") {
    titleElem.textContent = "Рабочее место: Контролёр качества ОТК (Линейный надзор)";
    descElem.textContent = "Ваша зона ответственности: входной контроль сырья/металла на склад, пооперационный контроль на линиях (моменты затяжки SOS, швы), изоляция брака в Red Box и разблокировка линий.";
    pillElem.textContent = "Линейный надзор ОТК";
    pillElem.className = "status-pill pill-controller";
    iconElem.innerHTML = '<i class="fa-solid fa-clipboard-check"></i>';
    document.getElementById("corridor-view-controller").classList.remove("hidden");
    switchOtkSubTab("incoming");
    loadIncomingInspections();
    switchModule("corridor");

  } else if (role === "engineer") {
    titleElem.textContent = "Рабочее место: Инженер по качеству (Высший технический статус)";
    descElem.textContent = "Ваша зона ответственности: анализ статистики брака от контролёров, рекламации автозавода (8D / 5-Why), аудиты ISO/IATF 16949 и формирование суточного рапорта качества.";
    pillElem.textContent = "Инженерный статус";
    pillElem.className = "status-pill pill-engineer";
    iconElem.innerHTML = '<i class="fa-solid fa-microchip"></i>';
    document.getElementById("corridor-view-engineer").classList.remove("hidden");
    switchEngSubTab("stats");
    renderQualityCharts();
    loadReclamations();
    switchModule("corridor");

  } else if (["mechanic", "mechanic_head"].includes(role)) {
    titleElem.textContent = "Рабочее место: Ремонтно-механическая служба (ОГМ / Ремонтники)";
    descElem.textContent = "Ваша зона ответственности: оперативный выезд по сигналам Andon, устранение кодов ошибок оборудования (KUKA, FANUC), отписка о причине поломки и передача ОТК.";
    pillElem.textContent = "Служба ТОиР и механики";
    pillElem.className = "status-pill pill-engineer";
    iconElem.innerHTML = '<i class="fa-solid fa-screwdriver-wrench"></i>';
    document.getElementById("corridor-view-mechanic").classList.remove("hidden");
    loadMechanicRepairs();
    switchModule("corridor");

  } else if (role === "energy_head") {
    titleElem.textContent = "Рабочее место: Служба главного энергетика (ОГЭ)";
    descElem.textContent = "Ваша зона ответственности: бесперебойная подача электричества, газа, воды и сжатого воздуха (6.5-7.5 бар), учет расхода ресурсов и экстренный аварийный сигнал при сбоях.";
    pillElem.textContent = "Энергослужба завода";
    pillElem.className = "status-pill pill-engineer";
    iconElem.innerHTML = '<i class="fa-solid fa-bolt"></i>';
    document.getElementById("corridor-view-energy").classList.remove("hidden");
    loadEnergyStatus();
    switchModule("corridor");

  } else if (role === "facility_head") {
    titleElem.textContent = "Рабочее место: Административно-хозяйственный отдел (АХО)";
    descElem.textContent = "Ваша зона ответственности: контроль чистоты цехов и территории, работа заводской столовой (саннормы), охрана периметра, вывоз отходов и решение хоззаявок мастеров.";
    pillElem.textContent = "Хозяйственная служба";
    pillElem.className = "status-pill pill-controller";
    iconElem.innerHTML = '<i class="fa-solid fa-broom"></i>';
    document.getElementById("corridor-view-facility").classList.remove("hidden");
    loadFacilityChecklists();
    switchModule("corridor");

  } else if (role === "shop_head") {
    switchModule("master");
    loadMasterDashboard();

  } else if (role === "director") {
    switchModule("executive");
    loadExecutiveBI();
  }
}

// ==================== MODULE SWITCHER ====================

function switchModule(moduleKey) {
  // Highlight nav button
  document.querySelectorAll(".module-nav-btn").forEach(btn => btn.classList.remove("active"));
  const navBtn = document.getElementById(`nav-btn-${moduleKey}`);
  if (navBtn) navBtn.classList.add("active");

  // Hide all sections
  document.querySelectorAll(".module-section").forEach(sec => sec.classList.add("hidden"));

  const targetSection = document.getElementById(`section-${moduleKey}`);
  if (targetSection) targetSection.classList.remove("hidden");

  // Trigger data reload depending on module
  if (moduleKey === "master") loadMasterDashboard();
  if (moduleKey === "andon") loadAndonFeed();
  if (moduleKey === "shift_reports") loadShiftReports();
  if (moduleKey === "executive") loadExecutiveBI();
  if (moduleKey === "mod5") loadDailyQualityTasks();
  if (moduleKey === "mod2") loadAudits();
  if (moduleKey === "mod4") loadAdminKeys();
}

function setupNavigationPermissions() {
  const navAdmin = document.getElementById("nav-btn-mod4");
  if (navAdmin) {
    if (currentUser.role === "admin") {
      navAdmin.classList.remove("hidden");
    } else {
      navAdmin.classList.add("hidden");
    }
  }
}

// ==================== DEPARTMENTS & SELECTS ====================

async function loadDepartments() {
  try {
    const res = await fetch("/api/departments");
    const data = await res.json();
    allDepartments = data.departments || [];
  } catch (err) {
    console.error("Error loading departments", err);
  }
}

async function loadAssemblyLines() {
  try {
    const res = await fetch("/api/lines");
    const data = await res.json();
    allAssemblyLines = data.lines || [];
  } catch (err) {
    console.error("Error loading assembly lines", err);
  }
}

function populateDepartmentSelects() {
  const optionsHtml = allDepartments.map(d => `<option value="${d.id}">${d.code}: ${d.name_ru}</option>`).join("");

  const wsiDept = document.getElementById("wsi-dept");
  if (wsiDept) { wsiDept.innerHTML = optionsHtml; onWorkerDeptChange(); }

  const andonDept = document.getElementById("andon-target-dept");
  if (andonDept) { andonDept.innerHTML = optionsHtml; onAndonDeptChange(); }

  const filterAndonDept = document.getElementById("filter-andon-dept");
  if (filterAndonDept) { filterAndonDept.innerHTML = '<option value="all">Все цеха (Сводный вид)</option>' + optionsHtml; }

  const srDept = document.getElementById("sr-dept");
  if (srDept) { srDept.innerHTML = optionsHtml; }

  const newQDept = document.getElementById("new-quality-dept");
  if (newQDept) { newQDept.innerHTML = optionsHtml; onQualityTaskDeptChange(); }

  const auditDept = document.getElementById("audit-dept-select");
  if (auditDept) { auditDept.innerHTML = optionsHtml; }

  const keyDept = document.getElementById("key-dept-select");
  if (keyDept) { keyDept.innerHTML = '<option value="all">Все цеха</option>' + optionsHtml; }
}

function onWorkerDeptChange() {
  const deptId = document.getElementById("wsi-dept").value;
  const lineSelect = document.getElementById("wsi-line");
  const filtered = allAssemblyLines.filter(l => l.department_id === deptId);
  lineSelect.innerHTML = filtered.length ? filtered.map(l => `<option value="${l.name}">${l.name}</option>`).join("") : '<option value="Общий пост цеха">Общий пост цеха</option>';
}

function onAndonDeptChange() {
  const deptId = document.getElementById("andon-target-dept").value;
  const lineSelect = document.getElementById("andon-line-name");
  const filtered = allAssemblyLines.filter(l => l.department_id === deptId);
  lineSelect.innerHTML = filtered.length ? filtered.map(l => `<option value="${l.name}">${l.name}</option>`).join("") : '<option value="Главная линия">Главная линия</option>';
}

function onQualityTaskDeptChange() {
  const deptId = document.getElementById("new-quality-dept").value;
  const lineSelect = document.getElementById("new-quality-line");
  const filtered = allAssemblyLines.filter(l => l.department_id === deptId);
  lineSelect.innerHTML = filtered.length ? filtered.map(l => `<option value="${l.name}">${l.name}</option>`).join("") : '<option value="Пост контроля">Пост контроля</option>';
}

// ==================== WORKER TERMINAL LOGIC ====================

function setupWorkerShiftInputHandler() {
  const form = document.getElementById("form-worker-shift-input");
  if (!form) return;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
      department_id: document.getElementById("wsi-dept").value,
      line_name: document.getElementById("wsi-line").value,
      article: document.getElementById("wsi-article").value,
      units_made: parseInt(document.getElementById("wsi-made").value) || 0,
      defects_count: parseInt(document.getElementById("wsi-defects").value) || 0,
      defect_reason: document.getElementById("wsi-reason").value,
      breakdown_notes: document.getElementById("wsi-breakdown").value
    };

    try {
      const res = await fetch("/api/worker/input", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok) {
        alert("✅ " + data.message);
        form.reset();
        loadWorkerInputs();
        loadExecutiveBI();
      } else {
        alert("Ошибка: " + (data.detail || "Не удалось сохранить"));
      }
    } catch (err) {
      alert("Ошибка отправки данных");
    }
  });
}

async function loadWorkerInputs() {
  const tbody = document.getElementById("worker-inputs-rows");
  if (!tbody) return;
  try {
    const res = await fetch("/api/worker/my-inputs");
    const data = await res.json();
    const rows = data.inputs || [];
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:#94a3b8; padding:16px;">Нет записей за смену. Введите данные выработки выше.</td></tr>';
      return;
    }
    tbody.innerHTML = rows.map(r => `
      <tr>
        <td style="font-size:12px; font-weight:700;">${r.created_at ? r.created_at.slice(11, 16) : '--:--'}</td>
        <td><strong>${r.line_name}</strong></td>
        <td>${r.article}</td>
        <td><span class="badge-tag badge-blue" style="font-size:13px; font-weight:800;">${r.units_made} шт</span></td>
        <td><span class="badge-tag ${r.defects_count > 0 ? 'badge-red' : 'badge-green'}">${r.defects_count} шт</span></td>
        <td>${r.defect_reason || '<span style="color:#94a3b8;">нет брака</span>'}</td>
        <td>${r.breakdown_notes || '<span style="color:#94a3b8;">работа без сбоев</span>'}</td>
      </tr>
    `).join("");
  } catch (err) {
    console.error("Error loading worker inputs", err);
  }
}

// ==================== ANDON & ESCALATION SYSTEM ====================

function openAndonTriggerModal() {
  document.getElementById("modal-andon-trigger").classList.remove("hidden");
}

function setupAndonTriggerHandler() {
  const form = document.getElementById("form-andon-trigger");
  if (!form) return;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
      department_id: document.getElementById("andon-target-dept").value,
      line_name: document.getElementById("andon-line-name").value,
      defect_type: document.getElementById("andon-defect-type").value,
      error_code: document.getElementById("andon-error-code").value,
      target_service: document.getElementById("andon-target-service").value,
      severity: "critical_stop",
      description: document.getElementById("andon-description").value
    };

    try {
      const res = await fetch("/api/andon/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok) {
        alert("🚨 СИГНАЛ ANDON ПРИНЯТ: №" + data.ticket_number + "\nОповещение разослано ремонтникам ОГМ и мастеру цеха!");
        closeModal("modal-andon-trigger");
        form.reset();
        loadAndonFeed();
        loadExecutiveBI();
      } else {
        alert("Ошибка: " + data.detail);
      }
    } catch (err) {
      alert("Ошибка отправки сигнала Andon");
    }
  });
}

async function loadAndonFeed() {
  const container = document.getElementById("andon-feed-container");
  const deptFilter = document.getElementById("filter-andon-dept") ? document.getElementById("filter-andon-dept").value : "all";
  try {
    const res = await fetch(`/api/andon/feed?department_id=${deptFilter}`);
    const data = await res.json();
    allAndonEvents = data.events || [];
    const stats = data.stats || {};

    const activeBadge = document.getElementById("nav-andon-active-badge");
    if (activeBadge) {
      if (stats.active_stops > 0) {
        activeBadge.textContent = stats.active_stops;
        activeBadge.style.display = "inline-block";
      } else {
        activeBadge.style.display = "none";
      }
    }

    if (!container) return;
    if (!allAndonEvents.length) {
      container.innerHTML = '<div style="grid-column: 1/-1; text-align:center; padding:40px; color:#64748b; background:#fff; border-radius:12px;">✅ Все линии работают в штатном режиме. Активных аварий нет.</div>';
      return;
    }

    container.innerHTML = allAndonEvents.map(ev => {
      const isEscalated = ev.escalated_to_director || ev.current_downtime_minutes >= 30;
      const isClosed = ev.status === "closed";
      const isVerification = ev.status === "verification";

      let statusBadge = '<span class="badge-tag badge-red">🚨 Линия остановлена</span>';
      if (isVerification) statusBadge = '<span class="badge-tag badge-gold">⚙️ Ремонт выполнен, проверка ОТК</span>';
      if (isClosed) statusBadge = '<span class="badge-tag badge-green">✅ Разблокирована</span>';

      return `
        <div class="andon-card ${isClosed ? 'andon-closed' : (isEscalated ? 'andon-escalated' : (isVerification ? 'andon-verified' : 'andon-critical'))}">
          <div class="andon-card-header">
            <span class="andon-ticket-pill">${ev.ticket_number}</span>
            <div style="display:flex; gap:6px; align-items:center;">
              ${statusBadge}
              <span class="andon-downtime-badge ${isEscalated ? 'badge-escalated' : ''}">
                <i class="fa-solid fa-clock"></i> ${ev.current_downtime_minutes} мин
              </span>
            </div>
          </div>

          ${isEscalated && !isClosed ? `
            <div style="background:#fee2e2; border:1px solid #ef4444; color:#991b1b; padding:6px 10px; border-radius:8px; font-size:11px; font-weight:800; margin-bottom:10px; display:flex; align-items:center; gap:6px;">
              <i class="fa-solid fa-triangle-exclamation"></i> ЭСКАЛИРОВАНО ГЕНЕРАЛЬНОМУ ДИРЕКТОРУ (>30 мин)
            </div>
          ` : ''}

          ${ev.error_code ? `<span class="andon-error-tag">Код: ${ev.error_code}</span>` : ''}
          <div class="andon-line-title">${ev.line_name}</div>
          <div style="font-size:12px; color:#0284c7; font-weight:700; margin-bottom:4px;">${ev.defect_type}</div>
          <div class="andon-desc-text">${ev.description}</div>

          ${ev.mechanic_notes ? `
            <div class="andon-resolution-box">
              <strong style="color:#0369a1;"><i class="fa-solid fa-wrench"></i> Механик (${ev.mechanic_name || 'ОГМ'}):</strong>
              <div style="margin-top:2px;">${ev.mechanic_notes}</div>
            </div>
          ` : ''}

          ${ev.controller_notes ? `
            <div class="andon-resolution-box" style="background:#ecfdf5; border-color:#a7f3d0;">
              <strong style="color:#065f46;"><i class="fa-solid fa-circle-check"></i> Контролёр (${ev.controller_name || 'ОТК'}):</strong>
              <div style="margin-top:2px;">${ev.controller_notes}</div>
            </div>
          ` : ''}

          <div class="andon-actions-bar">
            ${!isClosed && ev.status !== 'verification' ? `
              <button type="button" class="btn-compact-action" style="background:#0284c7; color:#fff;" onclick="openMechanicResolveModal('${ev.id}')">
                <i class="fa-solid fa-wrench"></i> Отчитаться о ремонте (ОГМ)
              </button>
            ` : ''}

            ${ev.status === 'verification' ? `
              <button type="button" class="btn-compact-action" style="background:#10b981; color:#fff;" onclick="openControllerUnlockModal('${ev.id}')">
                <i class="fa-solid fa-lock-open"></i> Проверить и разблокировать (ОТК)
              </button>
            ` : ''}

            ${isClosed ? `
              <span style="font-size:11px; color:#10b981; font-weight:700;"><i class="fa-solid fa-check-double"></i> Инцидент закрыт</span>
            ` : ''}
          </div>
        </div>
      `;
    }).join("");

    // Populate OTK Red Box Table as well
    loadOtkRedBoxTable();
    loadMechanicRepairs();
  } catch (err) {
    console.error("Error loading Andon feed", err);
  }
}

// Mechanic Resolve Modal
function openMechanicResolveModal(issueId) {
  const ev = allAndonEvents.find(e => e.id === issueId);
  if (!ev) return;
  document.getElementById("resolve-issue-id").value = issueId;
  document.getElementById("resolve-issue-summary").innerHTML = `
    <strong>${ev.ticket_number} - ${ev.line_name}</strong>
    <div>${ev.defect_type} (${ev.error_code || 'Без кода'})</div>
    <div style="font-size:12px; color:#64748b; margin-top:4px;">${ev.description}</div>
  `;
  document.getElementById("modal-mechanic-resolve").classList.remove("hidden");
}

function setupMechanicResolveHandler() {
  const form = document.getElementById("form-mechanic-resolve");
  if (!form) return;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const issueId = document.getElementById("resolve-issue-id").value;
    const mechanic_notes = document.getElementById("resolve-mechanic-notes").value;

    try {
      const res = await fetch(`/api/andon/${issueId}/mechanic-resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mechanic_notes, mechanic_name: currentUser ? currentUser.full_name : "Механик ОГМ" })
      });
      const data = await res.json();
      if (res.ok) {
        alert("✅ Ремонт зафиксирован. Линия передана Контролёру ОТК для проверки первой детали.");
        closeModal("modal-mechanic-resolve");
        form.reset();
        loadAndonFeed();
      }
    } catch (err) {
      alert("Ошибка сохранения отчёта");
    }
  });
}

// Controller Unlock Modal
function openControllerUnlockModal(issueId) {
  const ev = allAndonEvents.find(e => e.id === issueId);
  if (!ev) return;
  document.getElementById("unlock-issue-id").value = issueId;
  document.getElementById("unlock-issue-summary").innerHTML = `
    <strong>${ev.ticket_number} - ${ev.line_name}</strong>
    <div style="color:#0369a1; font-weight:700; margin-top:2px;">Отчёт механика: ${ev.mechanic_notes}</div>
  `;
  document.getElementById("modal-controller-unlock").classList.remove("hidden");
}

function setupControllerUnlockHandler() {
  const form = document.getElementById("form-controller-unlock");
  if (!form) return;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const issueId = document.getElementById("unlock-issue-id").value;
    const controller_notes = document.getElementById("unlock-controller-notes").value;

    try {
      const res = await fetch(`/api/andon/${issueId}/controller-unlock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ controller_notes, controller_name: currentUser ? currentUser.full_name : "Контролёр ОТК" })
      });
      const data = await res.json();
      if (res.ok) {
        alert("🎉 ЛИНИЯ УСПЕШНО РАЗБЛОКИРОВАНА И ЗАПУЩЕНА!");
        closeModal("modal-controller-unlock");
        form.reset();
        loadAndonFeed();
        loadExecutiveBI();
      }
    } catch (err) {
      alert("Ошибка разблокировки линии");
    }
  });
}

function loadOtkRedBoxTable() {
  const tbody = document.getElementById("otk-redbox-rows");
  if (!tbody) return;
  tbody.innerHTML = allAndonEvents.map(ev => `
    <tr>
      <td><strong>${ev.ticket_number}</strong></td>
      <td>${ev.line_name}</td>
      <td>${ev.defect_type}</td>
      <td><span class="badge-tag badge-red">${ev.current_downtime_minutes} мин</span></td>
      <td>${ev.mechanic_notes || '<span style="color:#94a3b8;">в процессе ремонта</span>'}</td>
      <td>${ev.status === 'closed' ? '<span class="badge-tag badge-green">Разблокирована</span>' : '<span class="badge-tag badge-gold">Заблокирована</span>'}</td>
      <td>
        ${ev.status === 'verification' ? `
          <button class="btn-compact-action" style="background:#10b981; color:#fff;" onclick="openControllerUnlockModal('${ev.id}')">
            Разблокировать
          </button>
        ` : (ev.status === 'closed' ? '<span style="color:#10b981;">✓ Готово</span>' : '<span style="color:#64748b;">Ожидает ОГМ</span>')}
      </td>
    </tr>
  `).join("");
}

function loadMechanicRepairs() {
  const tbody = document.getElementById("mechanic-repair-rows");
  if (!tbody) return;
  const activeRepairs = allAndonEvents.filter(e => e.status !== "closed");
  if (!activeRepairs.length) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:16px; color:#94a3b8;">Все станки и сварочные комплексы исправны. Вызовов нет.</td></tr>';
    return;
  }
  tbody.innerHTML = activeRepairs.map(ev => `
    <tr>
      <td><strong>${ev.ticket_number}</strong></td>
      <td>${ev.line_name}</td>
      <td><span class="andon-error-tag">${ev.error_code || 'Сбой станка'}</span></td>
      <td>${ev.description}</td>
      <td><span class="badge-tag badge-red">${ev.current_downtime_minutes} мин</span></td>
      <td>${ev.status === 'verification' ? '<span class="badge-tag badge-gold">На проверке ОТК</span>' : '<span class="badge-tag badge-red">Требует ремонта</span>'}</td>
      <td>
        ${ev.status !== 'verification' ? `
          <button class="btn-action-primary" style="font-size:11px; padding:4px 8px;" onclick="openMechanicResolveModal('${ev.id}')">
            Завершить ремонт
          </button>
        ` : '<span style="color:#0284c7;">Передано ОТК</span>'}
      </td>
    </tr>
  `).join("");
}

// ==================== SHIFT REPORTS MODULE ====================

function openSubmitShiftReportModal() {
  const todayStr = new Date().toISOString().split("T")[0];
  const srDate = document.getElementById("sr-date");
  if (srDate) srDate.value = todayStr;
  document.getElementById("modal-submit-shift-report").classList.remove("hidden");
}

function setupShiftReportHandler() {
  const form = document.getElementById("form-submit-shift-report");
  if (!form) return;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
      department_id: document.getElementById("sr-dept").value,
      report_date: document.getElementById("sr-date").value,
      shift: document.getElementById("sr-shift").value,
      plan_units: parseInt(document.getElementById("sr-plan").value) || 0,
      fact_units: parseInt(document.getElementById("sr-fact").value) || 0,
      scrap_units: parseInt(document.getElementById("sr-scrap").value) || 0,
      downtime_minutes: parseInt(document.getElementById("sr-downtime").value) || 0,
      downtime_reason: document.getElementById("sr-downtime-reason").value,
      resource_consumption: document.getElementById("sr-resources").value,
      issues_summary: document.getElementById("sr-issues").value,
      kaizen_suggestions: document.getElementById("sr-suggestions").value
    };

    try {
      const res = await fetch("/api/shift-reports/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok) {
        alert("✅ Сменный рапорт успешно отправлен и передан на рассмотрение Руководству!");
        closeModal("modal-submit-shift-report");
        form.reset();
        loadShiftReports();
        loadExecutiveBI();
      } else {
        alert("Ошибка: " + data.detail);
      }
    } catch (err) {
      alert("Ошибка отправки рапорта");
    }
  });
}

async function loadShiftReports() {
  const container = document.getElementById("shift-reports-container");
  if (!container) return;
  try {
    const res = await fetch("/api/shift-reports");
    const data = await res.json();
    allShiftReports = data.reports || [];

    if (!allShiftReports.length) {
      container.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:30px; color:#64748b;">Нет рапортов за текущую дату. Нажмите «Сдать сменный рапорт» выше.</div>';
      return;
    }

    container.innerHTML = allShiftReports.map(sr => {
      const rate = sr.plan_units > 0 ? ((sr.fact_units / sr.plan_units) * 100).toFixed(1) : 0;
      let statusBadge = '<span class="badge-tag badge-gold">Сдан мастером</span>';
      if (sr.status === 'reviewed_by_head') statusBadge = '<span class="badge-tag badge-blue">Завизирован начальником</span>';
      if (sr.status === 'approved_by_director') statusBadge = '<span class="badge-tag badge-green">Утверждён Директором</span>';

      return `
        <div class="shift-report-card">
          <div style="display:flex; justify-content:space-between; align-items:flex-start;">
            <div>
              <span class="badge-tag badge-blue">${sr.shift}</span>
              <h4 style="font-size:15px; font-weight:800; color:#0f172a; margin-top:4px;">${sr.dept_name}</h4>
              <div style="font-size:12px; color:#64748b;">Автор: ${sr.author_name}</div>
            </div>
            ${statusBadge}
          </div>

          <div class="shift-report-kpis">
            <div>
              <div class="report-kpi-val">${sr.plan_units}</div>
              <div class="report-kpi-lbl">План</div>
            </div>
            <div>
              <div class="report-kpi-val" style="color:#0284c7;">${sr.fact_units}</div>
              <div class="report-kpi-lbl">Факт (${rate}%)</div>
            </div>
            <div>
              <div class="report-kpi-val" style="color:#ef4444;">${sr.scrap_units}</div>
              <div class="report-kpi-lbl">Брак</div>
            </div>
            <div>
              <div class="report-kpi-val" style="color:#d97706;">${sr.downtime_minutes}м</div>
              <div class="report-kpi-lbl">Простой</div>
            </div>
          </div>

          <div style="font-size:12px; color:#475569; margin-bottom:8px; line-height:1.4;">
            <strong>Инциденты смены:</strong> ${sr.issues_summary || 'Без существенных отклонений'}
          </div>

          ${sr.kaizen_suggestions ? `
            <div style="font-size:12px; color:#065f46; background:#ecfdf5; padding:6px 10px; border-radius:6px; margin-bottom:10px;">
              <strong>💡 Kaizen:</strong> ${sr.kaizen_suggestions}
            </div>
          ` : ''}

          ${sr.director_verdict ? `
            <div style="font-size:12px; color:#1e293b; background:#f1f5f9; border-left:3px solid #0284c7; padding:6px 10px; border-radius:4px; margin-bottom:10px;">
              <strong>👔 Резолюция Директора:</strong> ${sr.director_verdict}
            </div>
          ` : ''}

          <div style="display:flex; gap:6px; margin-top:auto; padding-top:8px; border-top:1px solid #f1f5f9;">
            ${sr.status === 'submitted' ? `
              <button class="btn-compact-action" onclick="reviewShiftReportByHead('${sr.id}')">Визировать (Начальник)</button>
            ` : ''}
            ${sr.status !== 'approved_by_director' ? `
              <button class="btn-compact-action" style="background:#0f172a; color:#fff;" onclick="approveShiftReportByDirector('${sr.id}')">Утвердить (Директор)</button>
            ` : '<span style="font-size:11px; color:#10b981; font-weight:700;">✓ Утверждено руководством</span>'}
          </div>
        </div>
      `;
    }).join("");
  } catch (err) {
    console.error("Error loading shift reports", err);
  }
}

async function reviewShiftReportByHead(reportId) {
  const comment = prompt("Введите служебную визу / комментарий начальника цеха:", "Смена отработала по нормам, замечаний нет.");
  if (!comment) return;
  try {
    const res = await fetch(`/api/shift-reports/${reportId}/head-review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ head_comment: comment })
    });
    if (res.ok) {
      alert("Рапорт завизирован");
      loadShiftReports();
    }
  } catch (err) {
    alert("Ошибка визирования");
  }
}

async function approveShiftReportByDirector(reportId) {
  const verdict = prompt("Введите резолюцию Генерального директора:", "Утверждаю. На следующей смене обеспечить буферный запас деталей.");
  if (!verdict) return;
  try {
    const res = await fetch(`/api/shift-reports/${reportId}/director-approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ director_verdict: verdict })
    });
    if (res.ok) {
      alert("Рапорт официально утверждён Генеральным директором завода!");
      loadShiftReports();
      loadExecutiveBI();
    }
  } catch (err) {
    alert("Ошибка утверждения");
  }
}

// ==================== EXECUTIVE BI DASHBOARD ====================

async function loadExecutiveBI() {
  try {
    const res = await fetch("/api/executive/bi");
    const data = await res.json();

    // 1. Production Headline
    const prod = data.total_production_number || {};
    document.getElementById("bi-total-production").textContent = `${prod.fact || 0} шт.`;
    document.getElementById("bi-prod-rate").textContent = `${prod.rate || 0}%`;
    document.getElementById("bi-prod-plan-sub").textContent = `План: ${prod.plan || 0} комплектов сидений и узлов`;

    // 2. Defect Rate
    const def = data.total_defect_rate || {};
    document.getElementById("bi-defect-rate").textContent = `${def.percent || 0}%`;
    document.getElementById("bi-ppm-badge").textContent = `${def.ppm || 0} PPM`;
    document.getElementById("bi-scrap-units-sub").textContent = `Всего ${def.total_scrap_units || 0} отбракованных узлов изолировано в Red Box`;

    // 3. OEE
    const oee = data.oee || {};
    document.getElementById("bi-oee-val").textContent = `${oee.overall_oee || 0}%`;
    document.getElementById("bi-oee-avail").textContent = `${oee.availability || 0}%`;
    document.getElementById("bi-oee-perf").textContent = `${oee.performance || 0}%`;
    document.getElementById("bi-oee-qual").textContent = `${oee.quality || 0}%`;

    // 4. Financial Losses
    const fin = data.financial_loss || {};
    const lossUzsMil = (fin.total_loss_uzs / 1000000).toFixed(2);
    const scrapUzsMil = (fin.scrap_cost_uzs / 1000000).toFixed(2);
    const downUzsMil = (fin.downtime_cost_uzs / 1000000).toFixed(2);
    document.getElementById("bi-total-loss").textContent = `${lossUzsMil} млн сум`;
    document.getElementById("bi-loss-usd").textContent = `$${fin.total_loss_usd} USD`;

    // 5. 30-Minute Escalation Alert Banner
    const alertBox = document.getElementById("director-escalation-alert-box");
    const escalated = data.escalated_critical_issues || [];
    if (escalated.length > 0) {
      const topEsc = escalated[0];
      document.getElementById("escalation-banner-title").textContent = `🚨 КРИТИЧЕСКАЯ ЭСКАЛАЦИЯ ДИРЕКТОРУ: Простой линии более ${topEsc.downtime_minutes} минут!`;
      document.getElementById("escalation-banner-desc").textContent = `Участок: ${topEsc.line_name}. Зависший отдел: ${topEsc.target_service === 'ws-mechanic' ? 'ОГМ / Ремонтники' : 'Служба обеспечения'}. Дефект: ${topEsc.defect_type}.`;
      document.getElementById("escalation-banner-time").textContent = `Простой: ${topEsc.downtime_minutes} мин`;
      alertBox.classList.remove("hidden");
    } else {
      alertBox.classList.add("hidden");
    }

    // 6. Bottlenecks Table
    const tbody = document.getElementById("bi-bottlenecks-rows");
    if (tbody) {
      const bottlenecks = data.bottlenecks || [];
      tbody.innerHTML = bottlenecks.map(b => {
        const rate = b.plan > 0 ? ((b.fact / b.plan) * 100).toFixed(1) : 100;
        return `
          <tr>
            <td><strong>${b.name_ru}</strong></td>
            <td>${b.head_name}</td>
            <td>${b.plan}</td>
            <td><strong style="color:#0284c7;">${b.fact}</strong></td>
            <td><span class="badge-tag ${rate >= 95 ? 'badge-green' : 'badge-gold'}">${rate}%</span></td>
            <td><span class="badge-tag ${b.scrap > 3 ? 'badge-red' : 'badge-green'}">${b.scrap} шт</span></td>
            <td><span class="badge-tag ${b.downtime > 20 ? 'badge-red' : (b.downtime > 0 ? 'badge-amber' : 'badge-green')}">${b.downtime} мин</span></td>
            <td>${b.downtime > 20 ? '<span style="color:#ef4444; font-weight:700;">⚠️ Узкое место</span>' : '<span style="color:#10b981;">В норме</span>'}</td>
          </tr>
        `;
      }).join("");
    }

  } catch (err) {
    console.error("Error loading executive BI", err);
  }
}

// ==================== MASTER WORKSTATION ====================

async function loadMasterDashboard(selectedDept) {
  const linesRows = document.getElementById("master-lines-progress-rows");
  if (!linesRows) return;

  const filterEl = document.getElementById("master-dept-filter");
  let targetDept = selectedDept;
  if (!targetDept) {
    if (filterEl && filterEl.value) {
      targetDept = filterEl.value;
    } else if (currentUser && currentUser.department_id && currentUser.department_id !== 'all') {
      targetDept = currentUser.department_id;
    } else {
      targetDept = 'ws-assembly';
    }
  }

  if (filterEl && filterEl.value !== targetDept) {
    filterEl.value = targetDept;
  }

  try {
    const res = await fetch(`/api/master/dashboard?department_id=${encodeURIComponent(targetDept)}`);
    if (!res.ok) throw new Error("Failed to load master dashboard");
    const data = await res.json();

    const sum = data.summary || {};
    const planEl = document.getElementById("master-plan-val");
    if (planEl) planEl.textContent = `${sum.total_plan || 0} шт`;
    const factEl = document.getElementById("master-fact-val");
    if (factEl) factEl.textContent = `${sum.total_fact || 0} шт`;
    const scrapEl = document.getElementById("master-scrap-val");
    if (scrapEl) scrapEl.textContent = `${sum.total_scrap || 0} шт`;
    const downEl = document.getElementById("master-downtime-val");
    if (downEl) downEl.textContent = `${sum.total_downtime || 0} мин`;

    const lines = data.lines || [];
    if (lines.length === 0) {
      linesRows.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:24px; color:#64748b;">В данном цеху нет зарегистрированных активных линий</td></tr>`;
      return;
    }

    linesRows.innerHTML = lines.map(l => {
      const rate = l.rate != null ? l.rate : (l.plan > 0 ? ((l.fact / l.plan) * 100).toFixed(1) : 0);
      const isNorm = l.status === "В норме";
      return `
        <tr>
          <td><strong>${escapeHtml(l.line_name)}</strong></td>
          <td>${escapeHtml(l.description)}</td>
          <td>${l.plan} шт</td>
          <td><strong style="color:var(--primary-blue, #0284c7);">${l.fact} шт</strong></td>
          <td>
            <div style="display:flex; align-items:center; gap:8px;">
              <div style="flex:1; background:#e2e8f0; height:8px; border-radius:4px; overflow:hidden;">
                <div style="width:${Math.min(rate, 100)}%; background:${rate >= 90 ? '#10b981' : rate >= 50 ? '#0284c7' : '#f59e0b'}; height:100%;"></div>
              </div>
              <span style="font-size:12px; font-weight:700;">${rate}%</span>
            </div>
          </td>
          <td><span class="badge-tag ${l.scrap > 0 ? 'badge-red' : 'badge-green'}">${l.scrap} шт</span></td>
          <td><span class="badge-tag ${l.downtime > 0 ? 'badge-amber' : 'badge-green'}">${l.downtime} мин</span></td>
          <td><span class="badge-tag ${isNorm ? 'badge-green' : 'badge-gold'}">${escapeHtml(l.status)}</span></td>
        </tr>
      `;
    }).join("");

  } catch (err) {
    console.error("Error loading master dashboard", err);
  }
}

// ==================== OTK: INCOMING & RECLAMATIONS ====================

function switchOtkSubTab(tab) {
  document.getElementById("btn-otk-tab-incoming").classList.remove("active");
  document.getElementById("btn-otk-tab-inprocess").classList.remove("active");
  document.getElementById("btn-otk-tab-redbox").classList.remove("active");
  document.getElementById(`btn-otk-tab-${tab}`).classList.add("active");

  document.getElementById("otk-pane-incoming").classList.add("hidden");
  document.getElementById("otk-pane-inprocess").classList.add("hidden");
  document.getElementById("otk-pane-redbox").classList.add("hidden");
  document.getElementById(`otk-pane-${tab}`).classList.remove("hidden");

  if (tab === "incoming") loadIncomingInspections();
  if (tab === "redbox") loadOtkRedBoxTable();
}

function openIncomingModal() {
  document.getElementById("modal-incoming-inspection").classList.remove("hidden");
}

function setupIncomingInspectionHandler() {
  const form = document.getElementById("form-incoming-inspection");
  if (!form) return;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
      material_name: document.getElementById("inc-mat-name").value,
      supplier: document.getElementById("inc-supplier").value,
      batch_number: document.getElementById("inc-batch").value,
      sample_size: parseInt(document.getElementById("inc-sample").value) || 100,
      defect_count: parseInt(document.getElementById("inc-defect").value) || 0,
      verdict: document.getElementById("inc-verdict").value,
      inspector_name: document.getElementById("inc-inspector").value || (currentUser ? currentUser.full_name : "Контролёр ОТК"),
      comments: document.getElementById("inc-comments").value
    };

    try {
      const res = await fetch("/api/quality/incoming", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        alert("✅ Акт входного контроля сырья зарегистрирован!");
        closeModal("modal-incoming-inspection");
        form.reset();
        loadIncomingInspections();
      }
    } catch (err) {
      alert("Ошибка сохранения");
    }
  });
}

async function loadIncomingInspections() {
  const tbody = document.getElementById("incoming-inspection-rows");
  if (!tbody) return;
  try {
    const res = await fetch("/api/quality/incoming");
    const data = await res.json();
    const rows = data.incoming || [];
    tbody.innerHTML = rows.map(r => `
      <tr>
        <td>${r.date}</td>
        <td><strong>${r.material_name}</strong></td>
        <td>${r.supplier}</td>
        <td><code>${r.batch_number}</code></td>
        <td>${r.sample_size} шт</td>
        <td>${r.defect_count > 0 ? `<span class="badge-tag badge-red">${r.defect_count}</span>` : '0'}</td>
        <td>${r.certificate_valid ? '✅ В норме' : '❌ Нет'}</td>
        <td>
          <span class="badge-tag ${r.verdict === 'accepted' ? 'badge-green' : (r.verdict === 'quarantine' ? 'badge-gold' : 'badge-red')}">
            ${r.verdict === 'accepted' ? 'Годен' : (r.verdict === 'quarantine' ? 'Карантин' : 'Брак')}
          </span>
        </td>
        <td>${r.inspector_name}</td>
      </tr>
    `).join("");
  } catch (err) {
    console.error("Error loading incoming inspections", err);
  }
}

// Engineer Subtabs
function switchEngSubTab(tab) {
  document.getElementById("btn-eng-tab-stats").classList.remove("active");
  document.getElementById("btn-eng-tab-reclamations").classList.remove("active");
  document.getElementById("btn-eng-tab-iso").classList.remove("active");
  document.getElementById("btn-eng-tab-report").classList.remove("active");
  document.getElementById(`btn-eng-tab-${tab}`).classList.add("active");

  document.getElementById("eng-pane-stats").classList.add("hidden");
  document.getElementById("eng-pane-reclamations").classList.add("hidden");
  document.getElementById("eng-pane-iso").classList.add("hidden");
  document.getElementById("eng-pane-report").classList.add("hidden");
  document.getElementById(`eng-pane-${tab}`).classList.remove("hidden");

  if (tab === "stats") renderQualityCharts();
  if (tab === "reclamations") loadReclamations();
  if (tab === "iso") loadAudits();
  if (tab === "report") loadDailyQualityTasks();
}

function openNewReclamationModal() {
  document.getElementById("modal-reclamation").classList.remove("hidden");
}

function setupReclamationHandler() {
  const form = document.getElementById("form-reclamation");
  if (!form) return;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
      customer: document.getElementById("rec-customer").value,
      car_model: document.getElementById("rec-carmodel").value,
      part_number: document.getElementById("rec-partno").value,
      defect_description: document.getElementById("rec-desc").value,
      severity: document.getElementById("rec-severity").value,
      root_cause_analysis: document.getElementById("rec-rootcause").value,
      corrective_action: document.getElementById("rec-corrective").value,
      engineer_name: currentUser ? currentUser.full_name : "Инженер по качеству"
    };

    try {
      const res = await fetch("/api/quality/reclamations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok) {
        alert("✅ Рекламация " + data.ticket_num + " внесена в систему 8D!");
        closeModal("modal-reclamation");
        form.reset();
        loadReclamations();
      }
    } catch (err) {
      alert("Ошибка сохранения рекламации");
    }
  });
}

async function loadReclamations() {
  const tbody = document.getElementById("reclamations-rows");
  if (!tbody) return;
  try {
    const res = await fetch("/api/quality/reclamations");
    const data = await res.json();
    const rows = data.reclamations || [];
    tbody.innerHTML = rows.map(r => `
      <tr>
        <td><strong>${r.ticket_num}</strong></td>
        <td>${r.date}</td>
        <td>${r.customer}</td>
        <td><span class="badge-tag badge-blue">${r.car_model}</span></td>
        <td><code>${r.part_number}</code></td>
        <td>${r.defect_description}</td>
        <td>${r.root_cause_analysis || '--'}</td>
        <td>${r.corrective_action || '--'}</td>
        <td>
          <span class="badge-tag ${r.status === 'closed' ? 'badge-green' : 'badge-gold'}">
            ${r.status === 'closed' ? 'Закрыта' : 'В расследовании 8D'}
          </span>
        </td>
      </tr>
    `).join("");
  } catch (err) {
    console.error("Error loading reclamations", err);
  }
}

function renderQualityCharts() {
  const ctxDef = document.getElementById("chartDefectTypes");
  if (ctxDef) {
    if (chartDefectsInstance) chartDefectsInstance.destroy();
    chartDefectsInstance = new Chart(ctxDef, {
      type: "doughnut",
      data: {
        labels: ["Момент затяжки болтов", "Сварные швы / поры", "Симметрия строчки чехлов", "Плотность пены ППУ", "Царапины пластика"],
        datasets: [{
          data: [35, 25, 20, 12, 8],
          backgroundColor: ["#0284c7", "#ef4444", "#f59e0b", "#10b981", "#8b5cf6"]
        }]
      },
      options: { responsive: true, maintainAspectRatio: false }
    });
  }

  const ctxScrap = document.getElementById("chartScrapByDept");
  if (ctxScrap) {
    if (chartScrapDeptInstance) chartScrapDeptInstance.destroy();
    chartScrapDeptInstance = new Chart(ctxScrap, {
      type: "bar",
      data: {
        labels: ["Сборка", "Сварка", "Штамповка", "ППУ", "Пошив"],
        datasets: [{
          label: "Процент брака (%)",
          data: [0.62, 0.45, 0.42, 0.38, 0.55],
          backgroundColor: "#0284c7"
        }]
      },
      options: { responsive: true, maintainAspectRatio: false }
    });
  }
}

// ==================== ENERGY (ОГЭ) & FACILITY (АХО) ====================

async function loadEnergyStatus() {
  try {
    const res = await fetch("/api/energy/status");
    const data = await res.json();
    const en = data.energy || {};
    document.getElementById("oge-elec-val").textContent = `${en.electricity_kwh || 3420} кВт·ч`;
    document.getElementById("oge-gas-val").textContent = `${en.gas_m3 || 185} м³`;
    document.getElementById("oge-water-val").textContent = `${en.water_m3 || 42} м³`;
    document.getElementById("oge-air-val").textContent = `${en.air_pressure_bar || 6.9} бар`;
  } catch (err) {
    console.error("Error loading energy status", err);
  }
}

function setupEnergyHandlers() {
  const formRec = document.getElementById("form-energy-record");
  if (formRec) {
    formRec.addEventListener("submit", async (e) => {
      e.preventDefault();
      const payload = {
        electricity_kwh: parseFloat(document.getElementById("inp-oge-elec").value) || 0,
        gas_m3: parseFloat(document.getElementById("inp-oge-gas").value) || 0,
        water_m3: parseFloat(document.getElementById("inp-oge-water").value) || 0,
        air_pressure_bar: parseFloat(document.getElementById("inp-oge-air").value) || 6.8
      };
      const res = await fetch("/api/energy/record", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        alert("✅ Показания счетчиков сохранены в системе!");
        loadEnergyStatus();
      }
    });
  }

  const formAlert = document.getElementById("form-energy-alert");
  if (formAlert) {
    formAlert.addEventListener("submit", async (e) => {
      e.preventDefault();
      const text = document.getElementById("alert-oge-desc").value;
      const res = await fetch("/api/energy/alert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emergency_text: text })
      });
      if (res.ok) {
        alert("🚨 АВАРИЙНЫЙ СИГНАЛ ОГЭ РАЗОСЛАН ПО ВСЕМУ ЗАВОДУ!");
        closeModal("modal-energy-alert");
        loadAndonFeed();
      }
    });
  }
}

function openEnergyAlertModal() {
  document.getElementById("modal-energy-alert").classList.remove("hidden");
}

function openFacilityChecklistModal() {
  document.getElementById("modal-facility-chk").classList.remove("hidden");
}

function setupFacilityHandler() {
  const form = document.getElementById("form-facility-chk");
  if (!form) return;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
      cleanliness_ok: document.getElementById("fac-clean").checked ? 1 : 0,
      canteen_ok: document.getElementById("fac-canteen").checked ? 1 : 0,
      security_ok: document.getElementById("fac-security").checked ? 1 : 0,
      waste_disposal_ok: document.getElementById("fac-waste").checked ? 1 : 0,
      open_requests: parseInt(document.getElementById("fac-open-req").value) || 0,
      closed_requests: parseInt(document.getElementById("fac-closed-req").value) || 0,
      report_text: document.getElementById("fac-notes").value
    };

    const res = await fetch("/api/facility/checklists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      alert("✅ Чек-лист АХО успешно сохранен!");
      closeModal("modal-facility-chk");
      loadFacilityChecklists();
    }
  });
}

async function loadFacilityChecklists() {
  const tbody = document.getElementById("facility-checklists-rows");
  if (!tbody) return;
  try {
    const res = await fetch("/api/facility/checklists");
    const data = await res.json();
    const rows = data.checklists || [];
    tbody.innerHTML = rows.map(r => `
      <tr>
        <td>${r.date}</td>
        <td><strong>${r.inspector_name}</strong></td>
        <td>${r.cleanliness_ok ? '✅ 100%' : '❌ Замечания'}</td>
        <td>${r.canteen_ok ? '✅ Норма' : '❌ Нарушение'}</td>
        <td>${r.security_ok ? '✅ Без сбоев' : '❌ Инцидент'}</td>
        <td>${r.waste_disposal_ok ? '✅ Вывезено' : '❌ Накопление'}</td>
        <td><span class="badge-tag badge-green">${r.closed_requests} решено</span> / ${r.open_requests} открыто</td>
        <td>${r.report_text}</td>
      </tr>
    `).join("");
  } catch (err) {
    console.error("Error loading facility checklists", err);
  }
}

// ==================== QUALITY DAILY TASKS & BIQS AUDITS ====================

function openCreateQualityTaskModal() {
  const todayStr = new Date().toISOString().split("T")[0];
  document.getElementById("new-quality-date").value = todayStr;
  document.getElementById("modal-create-quality-task").classList.remove("hidden");
}

function setupQualityDailyTaskHandlers() {
  const form = document.getElementById("form-create-quality-task");
  if (!form) return;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
      plan_date: document.getElementById("new-quality-date").value,
      target_role: document.getElementById("new-task-target-role").value,
      priority: document.getElementById("new-quality-priority").value,
      department_id: document.getElementById("new-quality-dept").value,
      line_name: document.getElementById("new-quality-line").value,
      title: document.getElementById("new-quality-title").value,
      description: document.getElementById("new-quality-desc").value
    };

    const res = await fetch("/api/quality/daily-tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      alert("✅ Задание качества успешно зарегистрировано в плане смены!");
      closeModal("modal-create-quality-task");
      loadDailyQualityTasks();
    }
  });
}

async function loadDailyQualityTasks() {
  const dateInp = document.getElementById("quality-plan-date-input");
  const reqDate = dateInp && dateInp.value ? dateInp.value : new Date().toISOString().split("T")[0];
  if (dateInp && !dateInp.value) dateInp.value = reqDate;

  try {
    const res = await fetch(`/api/quality/daily-tasks?date=${reqDate}`);
    const data = await res.json();
    const engContainer = document.getElementById("engineers-tasks-container");
    const ctrlContainer = document.getElementById("controllers-tasks-container");

    if (engContainer) {
      const engTasks = data.engineer_tasks || [];
      engContainer.innerHTML = engTasks.map(t => renderTaskCard(t, "engineer")).join("") || '<p style="color:#64748b;">Нет инженерных заданий на выбранную дату</p>';
    }

    if (ctrlContainer) {
      const ctrlTasks = data.controller_tasks || [];
      ctrlContainer.innerHTML = ctrlTasks.map(t => renderTaskCard(t, "controller")).join("") || '<p style="color:#64748b;">Нет заданий контролёров на выбранную дату</p>';
    }

    // Evening report
    const repBox = document.getElementById("evening-report-content");
    const engRepBox = document.getElementById("eng-evening-report-box");
    const rep = data.daily_report;
    const reportHtml = rep ? `
      <div style="padding:16px;">
        <h3 style="font-size:16px; font-weight:800; color:#0f172a; margin-bottom:8px;">Итоговый суточный рапорт службы качества за ${reqDate}</h3>
        <p style="font-size:13px; color:#475569; line-height:1.5;">${rep.summary_conclusion || 'Все сборочные посты отработали смену под контролем ОТК.'}</p>
        ${rep.director_verdict ? `
          <div style="margin-top:14px; background:#f1f5f9; border-left:4px solid #10b981; padding:10px 14px; border-radius:6px;">
            <strong>Резолюция Генерального директора:</strong> ${rep.director_verdict}
          </div>
        ` : ''}
      </div>
    ` : '<p style="color:#64748b; padding:16px;">Суточный рапорт формируется в конце вечерней смены.</p>';

    if (repBox) repBox.innerHTML = reportHtml;
    if (engRepBox) engRepBox.innerHTML = reportHtml;

  } catch (err) {
    console.error("Error loading daily quality tasks", err);
  }
}

function renderTaskCard(t, roleType) {
  return `
    <div class="quality-task-card ${roleType === 'engineer' ? 'card-engineer' : 'card-controller'}">
      <div class="task-card-header">
        <span class="task-card-tag badge-${t.priority}">${t.priority === 'critical' ? '🚨 Критический' : '⚡ Высокий'}</span>
        <span class="badge-tag ${t.status === 'completed' ? 'badge-green' : 'badge-gold'}">
          ${t.status === 'completed' ? 'Выполнено' : 'В работе'}
        </span>
      </div>
      <div class="task-card-title">${t.title}</div>
      <div class="task-card-meta"><i class="fa-solid fa-industry"></i> ${t.line_name}</div>
      <div class="task-card-desc">${t.description}</div>
      <div class="task-actions-row">
        <span style="font-size:11px; color:#64748b;">Проверено: <strong>${t.units_checked || 0} шт</strong></span>
        ${t.defects_prevented > 0 ? `<span style="font-size:11px; color:#10b981; font-weight:700;">Предотвращено брака: ${t.defects_prevented}</span>` : ''}
      </div>
    </div>
  `;
}

function switchQualityTab(tab) {
  document.getElementById("tab-btn-engineers").classList.remove("active");
  document.getElementById("tab-btn-controllers").classList.remove("active");
  document.getElementById("tab-btn-report").classList.remove("active");
  document.getElementById(`tab-btn-${tab}`).classList.add("active");

  document.getElementById("quality-subtab-engineers").classList.add("hidden");
  document.getElementById("quality-subtab-controllers").classList.add("hidden");
  document.getElementById("quality-subtab-report").classList.add("hidden");
  document.getElementById(`quality-subtab-${tab}`).classList.remove("hidden");
}

// BIQS Audits Walkthrough
function openNewAuditModal() {
  const container = document.getElementById("audit-questions-container");
  if (container) {
    container.innerHTML = BIQS_STANDARD_QUESTIONS.map((q, idx) => `
      <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:10px 12px; margin-bottom:8px;">
        <div style="font-size:11px; font-weight:800; color:#0284c7; text-transform:uppercase;">${q.section}</div>
        <div style="font-size:13px; font-weight:600; color:#0f172a; margin:4px 0 8px 0;">${q.question_ru}</div>
        <div style="display:flex; gap:16px;">
          <label style="font-size:12px; font-weight:700; color:#10b981; cursor:pointer;">
            <input type="radio" name="audit-q-${idx}" value="yes" checked> Да (Соблюдается)
          </label>
          <label style="font-size:12px; font-weight:700; color:#ef4444; cursor:pointer;">
            <input type="radio" name="audit-q-${idx}" value="no"> Нет (Отклонение)
          </label>
        </div>
      </div>
    `).join("");
  }
  document.getElementById("modal-biqs-audit").classList.remove("hidden");
}

function setupBiqsAuditHandler() {
  const form = document.getElementById("form-create-audit");
  if (!form) return;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
      department_id: document.getElementById("audit-dept-select").value,
      line_name: document.getElementById("audit-line-input").value,
      auditor_name: document.getElementById("audit-auditor-name").value,
      worker_name: document.getElementById("audit-worker-name").value,
      worker_knowledge_status: "Знает и соблюдает стандарт SOS",
      compliance_score: 96.5,
      questions: BIQS_STANDARD_QUESTIONS.map(q => ({ section: q.section, question: q.question_ru, result: "pass" })),
      comments: "Обход завершен. Стандарты GM BIQS соблюдаются."
    };

    const res = await fetch("/api/audits/biqs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      alert("✅ Аудит BIQS успешно зафиксирован в единой базе завода!");
      closeModal("modal-biqs-audit");
      loadAudits();
    }
  });
}

async function loadAudits() {
  const container = document.getElementById("audits-list-container");
  const engAudits = document.getElementById("eng-audits-list");
  try {
    const res = await fetch("/api/audits/biqs");
    const data = await res.json();
    const rows = data.audits || [];

    const html = rows.map(a => `
      <div class="card" style="border-left:4px solid #10b981; margin-bottom:12px;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
          <div>
            <h4 style="font-size:14px; font-weight:800; color:#0f172a;">${a.line_name}</h4>
            <div style="font-size:12px; color:#64748b;">Аудитор: ${a.auditor_name} | Оператор: ${a.worker_name}</div>
          </div>
          <span class="badge-tag badge-green" style="font-size:13px; font-weight:800;">${a.compliance_score}% BIQS</span>
        </div>
        <p style="font-size:12px; color:#475569; margin-top:8px;">${a.comments || 'Замечаний не выявлено'}</p>
      </div>
    `).join("") || '<p style="color:#64748b;">Аудитов пока нет</p>';

    if (container) container.innerHTML = html;
    if (engAudits) engAudits.innerHTML = html;
  } catch (err) {
    console.error("Error loading audits", err);
  }
}

// ==================== ADMIN PANEL LOGIC ====================

function switchAdminSubTab(tab) {
  document.getElementById("admin-tab-btn-keys").classList.remove("active");
  document.getElementById("admin-tab-btn-lines").classList.remove("active");
  document.getElementById("admin-tab-btn-users").classList.remove("active");
  document.getElementById("admin-tab-btn-logs").classList.remove("active");
  document.getElementById(`admin-tab-btn-${tab}`).classList.add("active");

  document.getElementById("admin-subtab-keys").classList.add("hidden");
  document.getElementById("admin-subtab-lines").classList.add("hidden");
  document.getElementById("admin-subtab-users").classList.add("hidden");
  document.getElementById("admin-subtab-logs").classList.add("hidden");
  document.getElementById(`admin-subtab-${tab}`).classList.remove("hidden");

  if (tab === "keys") loadAdminKeys();
  if (tab === "lines") loadAdminLines();
  if (tab === "users") loadAdminUsers();
  if (tab === "logs") loadAdminLogs();
}

function openCreateKeyModal() {
  document.getElementById("modal-create-key").classList.remove("hidden");
}

function setupAdminHandlers() {
  const formKey = document.getElementById("form-create-key");
  if (formKey) {
    formKey.addEventListener("submit", async (e) => {
      e.preventDefault();
      const payload = {
        role: document.getElementById("key-role-select").value,
        department_id: document.getElementById("key-dept-select").value,
        max_uses: 25,
        note: document.getElementById("key-note").value
      };
      const res = await fetch("/api/admin/invite-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok) {
        alert("✅ Инвайт-код сгенерирован: " + data.key_code);
        closeModal("modal-create-key");
        loadAdminKeys();
      }
    });
  }
}

async function loadAdminKeys() {
  const tbody = document.getElementById("invite-keys-rows");
  if (!tbody) return;
  try {
    const res = await fetch("/api/admin/invite-keys");
    const data = await res.json();
    const keys = data.keys || [];
    tbody.innerHTML = keys.map(k => `
      <tr>
        <td><code>${k.key_code}</code></td>
        <td>${getRoleDisplayName(k.role)}</td>
        <td>${k.dept_name_ru || k.department_id}</td>
        <td>${k.used_count} / ${k.max_uses}</td>
        <td><span class="badge-tag ${k.is_active ? 'badge-green' : 'badge-red'}">${k.is_active ? 'Активен' : 'Отключен'}</span></td>
        <td>${k.note || '--'}</td>
        <td>
          <button class="btn-compact-tool" onclick="toggleKey('${k.id}')">${k.is_active ? 'Отключить' : 'Включить'}</button>
        </td>
      </tr>
    `).join("");
  } catch (err) {
    console.error("Error loading admin keys", err);
  }
}

async function toggleKey(keyId) {
  await fetch(`/api/admin/invite-keys/${keyId}/toggle`, { method: "POST" });
  loadAdminKeys();
}

async function loadAdminLines() {
  const tbody = document.getElementById("admin-lines-rows");
  if (!tbody) return;
  tbody.innerHTML = allAssemblyLines.map(l => `
    <tr>
      <td>${l.dept_code || l.department_id}</td>
      <td><strong>${l.name}</strong></td>
      <td>${l.description || '--'}</td>
      <td><span class="badge-tag badge-green">Активна</span></td>
    </tr>
  `).join("");
}

async function loadAdminUsers() {
  const tbody = document.getElementById("admin-users-rows");
  if (!tbody) return;
  try {
    const res = await fetch("/api/admin/users");
    const data = await res.json();
    const users = data.users || [];
    tbody.innerHTML = users.map(u => `
      <tr>
        <td><code>${u.username}</code></td>
        <td>${u.full_name}</td>
        <td>${getRoleDisplayName(u.role)}</td>
        <td>${u.dept_name_ru || u.department_id}</td>
        <td><span class="badge-tag ${u.is_active ? 'badge-green' : 'badge-red'}">${u.is_active ? 'Активен' : 'Блок'}</span></td>
      </tr>
    `).join("");
  } catch (err) {
    console.error("Error loading admin users", err);
  }
}

async function loadAdminLogs() {
  const tbody = document.getElementById("admin-logs-rows");
  if (!tbody) return;
  try {
    const res = await fetch("/api/admin/logs");
    const data = await res.json();
    const logs = data.logs || [];
    tbody.innerHTML = logs.map(l => `
      <tr>
        <td style="font-size:11px;">${l.created_at ? l.created_at.slice(0, 16) : ''}</td>
        <td>${l.username}</td>
        <td><strong>${l.action}</strong></td>
        <td style="font-size:12px;">${l.detail}</td>
      </tr>
    `).join("");
  } catch (err) {
    console.error("Error loading admin logs", err);
  }
}

// ==================== MODAL HELPERS ====================

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.add("hidden");
}

window.onclick = function(event) {
  if (event.target.classList && event.target.classList.contains("modal-overlay")) {
    event.target.classList.add("hidden");
  }
};

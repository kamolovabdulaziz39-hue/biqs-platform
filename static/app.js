// ===== JV UZ-TONG HONG CO. DIGITAL MES PLATFORM JAVASCRIPT =====

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
let currentWorkspace = "worker"; // "worker" | "master" | "director" | "andon" | "shift_reports" | "biqs" | "admin"
let allDepartments = [];
let allAssemblyLines = [];
let allAndonEvents = [];
let allShiftReports = [];

// Chart.js instances
let chartHourlyInstance = null;
let chartWorkshopInstance = null;
let chartDefectParetoInstance = null;
let chartDowntimeInstance = null;

// Standard GM BIQS Audit Questions
const BIQS_STANDARD_QUESTIONS = [
  { section: "Standardized Work (SOS)", question: "Рабочий соблюдает последовательность SOS и карту действий?" },
  { section: "Quality Gate & Затяжка", question: "Выполнен 100% контроль критических моментов затяжки перед передачей?" },
  { section: "Poka-Yoke & Сенсоры", question: "Оптические датчики наличия деталей и блокираторы оснастки исправны?" },
  { section: "5S & Безопасность", question: "Рабочая зона свободна от мусора, инструмент на калиброванных подвесах?" },
  { section: "Red Box & Изоляция", question: "Все выявленные несоответствия изолированы в карантинной зоне Red Box?" }
];

document.addEventListener("DOMContentLoaded", () => {
  startLiveClock();
  checkAuth();
  setupAuthEventListeners();
  setupWorkerFormHandler();
  setupAndonTriggerHandler();
  setupMechanicResolveHandler();
  setupControllerUnlockHandler();
  setupShiftReportHandler();
  setupDirectorApproveHandler();
  setupHeadReviewHandler();
  setupBiqsAuditHandler();
  setupAdminHandlers();

  // Start Real-Time Factory Defect & Andon Alert Broadcast Poller (GM BIQS)
  pollFactoryAlerts();
  setInterval(pollFactoryAlerts, 4000);
});

// ==================== TOAST NOTIFICATIONS ====================
function showToast(message, type = "info") {
  const container = document.getElementById("toast-container");
  if (!container) return;
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  
  const iconMap = {
    success: '<i class="fa-solid fa-circle-check" style="color:var(--accent-emerald); font-size:16px;"></i>',
    error: '<i class="fa-solid fa-circle-xmark" style="color:var(--accent-danger); font-size:16px;"></i>',
    warning: '<i class="fa-solid fa-triangle-exclamation" style="color:var(--accent-amber); font-size:16px;"></i>',
    info: '<i class="fa-solid fa-circle-info" style="color:var(--primary-blue); font-size:16px;"></i>'
  };

  toast.innerHTML = `${iconMap[type] || ""} <span>${escapeHtml(message)}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(100%)";
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// ==================== LIVE DIGITAL CLOCK ====================
function startLiveClock() {
  function update() {
    const el = document.getElementById("live-clock-display");
    if (!el) return;
    const now = new Date();
    el.textContent = now.toTimeString().split(" ")[0];
  }
  update();
  setInterval(update, 1000);
}

// ==================== AUTHENTICATION & SESSION ====================

function switchAuthTab(tab) {
  document.getElementById("btn-tab-auth-cred").classList.remove("active");
  document.getElementById("btn-tab-auth-invite").classList.remove("active");
  document.getElementById(`btn-tab-auth-${tab}`).classList.add("active");

  document.getElementById("pane-auth-cred").classList.add("hidden");
  document.getElementById("pane-auth-invite").classList.add("hidden");
  document.getElementById(`pane-auth-${tab}`).classList.remove("hidden");
}

async function quickLoginRole(roleKey) {
  try {
    const res = await fetch("/api/auth/quick-role-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role_key: roleKey })
    });
    const data = await res.json();
    if (res.ok && data.status === "success") {
      currentUser = data.user;
      showToast(`✅ Добро пожаловать: ${currentUser.full_name}`, "success");
      await initDashboardForRole(roleKey);
    } else {
      showToast(data.detail || "Ошибка авторизации", "error");
    }
  } catch (err) {
    showToast("Ошибка соединения с сервером", "error");
  }
}

async function checkAuth() {
  try {
    const res = await fetch("/api/auth/me");
    const data = await res.json();
    if (data.authenticated && data.user) {
      currentUser = data.user;
      const roleMap = {
        operator: "worker",
        shop_head: "master",
        director: "director",
        admin: "director",
        controller: "worker",
        engineer: "director",
        mechanic: "master"
      };
      await initDashboardForRole(roleMap[currentUser.role] || "worker");
    } else {
      document.getElementById("auth-screen").classList.remove("hidden");
      document.getElementById("dashboard-screen").classList.add("hidden");
    }
  } catch (err) {
    document.getElementById("auth-screen").classList.remove("hidden");
  }
}

async function enterGuestMode() {
  try {
    const res = await fetch("/api/auth/guest-login", { method: "POST" });
    const data = await res.json();
    if (res.ok && data.status === "success") {
      currentUser = data.user;
      showToast("Гостевой режим активирован", "info");
      await initDashboardForRole("director");
    }
  } catch (err) {
    showToast("Ошибка соединения", "error");
  }
}

async function logoutUser() {
  try {
    await fetch("/api/auth/logout", { method: "POST" });
  } catch (e) {}
  currentUser = null;
  location.reload();
}

function setupAuthEventListeners() {
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
          showToast(`✅ Авторизован: ${currentUser.full_name}`, "success");
          const roleMap = { operator: "worker", shop_head: "master", director: "director", admin: "director" };
          await initDashboardForRole(roleMap[currentUser.role] || "worker");
        } else {
          errTxt.textContent = data.detail || "Неверный логин или пароль";
          errBox.classList.remove("hidden");
        }
      } catch (err) {
        errTxt.textContent = "Ошибка соединения";
        errBox.classList.remove("hidden");
      }
    });
  }

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
          showToast(`✅ Вход по коду: ${currentUser.full_name}`, "success");
          await initDashboardForRole(currentUser.role === "shop_head" ? "master" : (currentUser.role === "director" ? "director" : "worker"));
        } else {
          errTxt.textContent = data.detail || "Неверный код";
          errBox.classList.remove("hidden");
        }
      } catch (err) {
        errTxt.textContent = "Ошибка соединения";
        errBox.classList.remove("hidden");
      }
    });
  }
}

// ==================== DASHBOARD INITIALIZATION ====================

function applyRolePermissions(user) {
  const role = user ? user.role : 'operator';

  const btnWorker = document.getElementById("nav-btn-worker");
  const btnMaster = document.getElementById("nav-btn-master");
  const btnDirector = document.getElementById("nav-btn-director");
  const btnShiftReports = document.getElementById("nav-btn-shift_reports");
  const btnBiqs = document.getElementById("nav-btn-biqs");
  const btnAndon = document.getElementById("nav-btn-andon");
  const btnAdmin = document.getElementById("nav-btn-admin");
  const roleSwitcher = document.getElementById("nav-role-switcher");

  // First hide all role tabs and switcher
  [btnWorker, btnMaster, btnDirector, btnShiftReports, btnBiqs, btnAndon, btnAdmin].forEach(b => {
    if (b) b.classList.add("hidden");
  });
  if (roleSwitcher) roleSwitcher.classList.add("hidden");

  let defaultWs = "worker";

  if (role === "operator" || role === "worker") {
    // 1. WORKER: ONLY Worker desktop + Andon alerts
    if (btnWorker) btnWorker.classList.remove("hidden");
    if (btnAndon) btnAndon.classList.remove("hidden");
    defaultWs = "worker";
  } 
  else if (role === "shop_head" || role === "master" || role === "mechanic" || role === "energy_head" || role === "facility_head") {
    // 2. SHOP HEAD / MASTER: ONLY My Shop + Shift Reports + Andon
    // (NO Worker counter desk, NO Director executive BI, NO Admin)
    if (btnMaster) btnMaster.classList.remove("hidden");
    if (btnShiftReports) btnShiftReports.classList.remove("hidden");
    if (btnAndon) btnAndon.classList.remove("hidden");
    defaultWs = "master";
  } 
  else if (role === "director") {
    // 3. PLANT DIRECTOR: Director BI (whole plant) + Shift reports (approval) + Andon
    // (NO Worker counter desk, NO My Shop single workshop desk, NO Admin)
    if (btnDirector) btnDirector.classList.remove("hidden");
    if (btnShiftReports) btnShiftReports.classList.remove("hidden");
    if (btnAndon) btnAndon.classList.remove("hidden");
    defaultWs = "director";
  } 
  else if (role === "controller" || role === "engineer") {
    // 4. QUALITY CONTROLLER / BIQS ENGINEER: BIQS Audits + Shift reports + Andon
    if (btnBiqs) btnBiqs.classList.remove("hidden");
    if (btnShiftReports) btnShiftReports.classList.remove("hidden");
    if (btnAndon) btnAndon.classList.remove("hidden");
    defaultWs = "biqs";
  } 
  else if (role === "admin") {
    // 5. ADMIN: Access to all panels and switcher
    [btnWorker, btnMaster, btnDirector, btnShiftReports, btnBiqs, btnAndon, btnAdmin].forEach(b => {
      if (b) b.classList.remove("hidden");
    });
    if (roleSwitcher) roleSwitcher.classList.remove("hidden");
    defaultWs = "admin";
  } 
  else if (role === "guest") {
    // 6. GUEST DEMO: Show primary desks and switcher
    if (btnWorker) btnWorker.classList.remove("hidden");
    if (btnMaster) btnMaster.classList.remove("hidden");
    if (btnDirector) btnDirector.classList.remove("hidden");
    if (btnAndon) btnAndon.classList.remove("hidden");
    if (btnShiftReports) btnShiftReports.classList.remove("hidden");
    if (roleSwitcher) roleSwitcher.classList.remove("hidden");
    defaultWs = "director";
  }

  return defaultWs;
}

async function initDashboardForRole(roleKey) {
  document.getElementById("auth-screen").classList.add("hidden");
  document.getElementById("dashboard-screen").classList.remove("hidden");

  // User Header Display
  const displayName = currentUser ? (currentUser.full_name || currentUser.username) : "Сотрудник";
  document.getElementById("user-display-name").textContent = displayName;
  document.getElementById("user-display-role").textContent = getRoleDisplayName(currentUser ? currentUser.role : "operator");
  document.getElementById("user-avatar-text").textContent = displayName.charAt(0).toUpperCase();

  // Apply strict role permissions
  const targetWs = applyRolePermissions(currentUser);

  // Load Base Plant Configuration
  await loadDepartments();
  await loadAssemblyLines();
  populateGlobalSelects();

  // Switch to the target workspace
  switchMainWorkspace(roleKey || targetWs);
}

function getRoleDisplayName(role) {
  const map = {
    operator: "Работник / Оператор",
    shop_head: "Начальник цеха / Мастер",
    director: "Генеральный директор",
    controller: "Контролёр качества ОТК",
    engineer: "Инженер по качеству BIQS",
    mechanic: "Наладчик-механик ОГМ",
    energy_head: "Главный энергетик завода",
    facility_head: "Начальник АХО",
    admin: "Главный Администратор",
    guest: "Гостевой просмотр (Демо)"
  };
  return map[role] || role;
}

// ==================== MAIN WORKSPACE NAVIGATION ====================

function switchMainWorkspace(wsKey) {
  const role = currentUser ? currentUser.role : 'operator';

  // Strict Role Permission Guard:
  if (role === "operator" || role === "worker") {
    if (wsKey !== "worker" && wsKey !== "andon") {
      showToast("Доступ ограничен: Работник имеет доступ только к своему рабочему столу", "warning");
      return;
    }
  } else if (role === "shop_head" || role === "master" || role === "mechanic" || role === "energy_head" || role === "facility_head") {
    if (wsKey === "director" || wsKey === "admin" || wsKey === "worker") {
      showToast("Доступ ограничен: Начальник цеха управляет только своим цехом и рапортами", "warning");
      return;
    }
  } else if (role === "director") {
    if (wsKey === "worker" || wsKey === "admin") {
      showToast("Генеральный директор управляет сводными показателями завода", "info");
      return;
    }
  } else if (role === "controller" || role === "engineer") {
    if (wsKey === "director" || wsKey === "admin" || wsKey === "worker") {
      showToast("Служба качества работает с аудитами BIQS и инцидентами", "warning");
      return;
    }
  }

  currentWorkspace = wsKey;

  // Highlight navigation tab
  document.querySelectorAll(".ws-nav-btn").forEach(btn => btn.classList.remove("active"));
  const navBtn = document.getElementById(`nav-btn-${wsKey}`);
  if (navBtn) navBtn.classList.add("active");

  // Update switcher pills
  document.querySelectorAll(".role-switch-btn").forEach(p => p.classList.remove("active"));
  const pill = document.getElementById(`pill-ws-${wsKey}`);
  if (pill) pill.classList.add("active");

  // Hide all sections, show target
  document.querySelectorAll(".workspace-section").forEach(sec => sec.classList.add("hidden"));
  const targetSection = document.getElementById(`section-${wsKey}`);
  if (targetSection) targetSection.classList.remove("hidden");

  // Load relevant data
  if (wsKey === "worker") {
    loadWorkerDashboard();
  } else if (wsKey === "master") {
    loadMasterDashboard();
  } else if (wsKey === "director") {
    loadExecutiveBI();
  } else if (wsKey === "andon") {
    loadAndonFeed();
  } else if (wsKey === "shift_reports") {
    loadShiftReports();
  } else if (wsKey === "biqs") {
    loadAudits();
  } else if (wsKey === "admin") {
    loadAdminKeys();
  }
}

// ==================== 1. WORKER WORKSTATION LOGIC ====================

let workerMadeUnits = 10;
let workerDefects = 0;

function adjustWorkerUnits(delta) {
  workerMadeUnits = Math.max(0, workerMadeUnits + delta);
  document.getElementById("worker-made-display").textContent = workerMadeUnits;
  document.getElementById("wsi-made").value = workerMadeUnits;
}

function adjustWorkerDefects(delta) {
  workerDefects = Math.max(0, workerDefects + delta);
  document.getElementById("worker-defects-display").textContent = workerDefects;
  document.getElementById("wsi-defects").value = workerDefects;
}

function selectDefectTag(reason) {
  document.getElementById("wsi-reason").value = reason;
  adjustWorkerDefects(1);
  showToast(`Выбран дефект: ${reason}`, "warning");
}

function onChecklistChange() {
  const c1 = document.getElementById("chk-5s").checked;
  const c2 = document.getElementById("chk-poka").checked;
  const c3 = document.getElementById("chk-tool").checked;
  const c4 = document.getElementById("chk-parts").checked;
  if (!c1 || !c2 || !c3 || !c4) {
    showToast("Внимание: для допуска к работе все 4 пункта 5S должны быть включены", "warning");
  }
}

function saveWorkerChecklist() {
  const c1 = document.getElementById("chk-5s").checked;
  const c2 = document.getElementById("chk-poka").checked;
  const c3 = document.getElementById("chk-tool").checked;
  const c4 = document.getElementById("chk-parts").checked;
  if (c1 && c2 && c3 && c4) {
    showToast("✅ Чек-лист смены 5S и Poka-Yoke успешно подтвержден!", "success");
  } else {
    showToast("⚠️ Чек-лист сохранен с замечаниями. Устраните несоответствия!", "warning");
  }
}

async function loadWorkerDashboard(targetLine) {
  try {
    let url = "/api/worker/dashboard";
    if (targetLine) url += `?line_name=${encodeURIComponent(targetLine)}`;

    const res = await fetch(url);
    if (!res.ok) throw new Error("Dashboard error");
    const data = await res.json();

    // Banner texts
    const titleEl = document.getElementById("worker-title-name");
    if (titleEl) titleEl.textContent = `Рабочий стол: ${data.worker_name}`;

    const deptBadge = document.getElementById("worker-dept-badge");
    if (deptBadge) deptBadge.textContent = `${data.department.name_ru} (${data.department.code})`;

    // Progress bar
    const progressText = document.getElementById("worker-progress-percent");
    if (progressText) {
      progressText.textContent = `${data.today_made} / ${data.target_pace} шт (${data.completion_rate}%)`;
    }
    const progressFill = document.getElementById("worker-progress-bar-fill");
    if (progressFill) {
      progressFill.style.width = `${Math.min(data.completion_rate, 100)}%`;
    }

    const lineText = document.getElementById("worker-line-target-text");
    if (lineText) lineText.textContent = data.current_line;

    // Load recent worker inputs table
    loadWorkerInputs();

  } catch (err) {
    console.error("Error loading worker dashboard", err);
  }
}

function setupWorkerFormHandler() {
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
        showToast(`✅ Зафиксировано: +${payload.units_made} деталей в журнал!`, "success");
        if (payload.defects_count > 0) {
          showToast(`🚨 Внимание: Брак (${payload.defects_count} шт) передан на общезаводское табло!`, "warning");
          pollFactoryAlerts();
        }
        // Reset counters back to standard default
        adjustWorkerUnits(10 - workerMadeUnits);
        adjustWorkerDefects(0 - workerDefects);
        document.getElementById("wsi-reason").value = "";
        document.getElementById("wsi-breakdown").value = "";
        loadWorkerDashboard(payload.line_name);
      } else {
        showToast(data.detail || "Ошибка при сохранении", "error");
      }
    } catch (err) {
      showToast("Ошибка отправки данных", "error");
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
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:#94a3b8; padding:16px;">Нет записей за смену. Нажмите «Зафиксировать выработку» выше.</td></tr>';
      return;
    }
    tbody.innerHTML = rows.map(r => `
      <tr>
        <td style="font-weight:700; font-size:12px;">${r.created_at ? r.created_at.slice(11, 16) : '--:--'}</td>
        <td><strong>${escapeHtml(r.line_name)}</strong></td>
        <td>${escapeHtml(r.article)}</td>
        <td><span class="badge-tag badge-blue" style="font-weight:800;">${r.units_made} шт</span></td>
        <td><span class="badge-tag ${r.defects_count > 0 ? 'badge-red' : 'badge-green'}">${r.defects_count} шт</span></td>
        <td>${escapeHtml(r.defect_reason || '—')}</td>
        <td>${escapeHtml(r.breakdown_notes || 'В норме')}</td>
      </tr>
    `).join("");
  } catch (err) {
    console.error("Error loading worker inputs", err);
  }
}

// ==================== 2. MASTER WORKSHOP LOGIC ====================

let currentMasterDept = "ws-assembly";

function onMasterDeptChange(deptId) {
  currentMasterDept = deptId;
  loadMasterDashboard(deptId);
}

async function loadMasterDashboard(selectedDept) {
  const targetDept = selectedDept || currentMasterDept;
  currentMasterDept = targetDept;

  const filterEl = document.getElementById("master-dept-filter");
  if (filterEl && filterEl.value !== targetDept) {
    filterEl.value = targetDept;
  }

  try {
    const res = await fetch(`/api/master/dashboard?department_id=${encodeURIComponent(targetDept)}`);
    if (!res.ok) throw new Error("Master dashboard error");
    const data = await res.json();

    const info = data.department_info || {};
    const sum = data.summary || {};

    // Header Passport
    const titleEl = document.getElementById("master-shop-title");
    if (titleEl) titleEl.textContent = info.name_ru || "Производственный цех";

    const codeBadge = document.getElementById("master-shop-code-badge");
    if (codeBadge) codeBadge.textContent = info.code || "WS";

    const headInfo = document.getElementById("master-shop-head-info");
    if (headInfo) {
      headInfo.textContent = `Начальник цеха: ${info.head_name || 'Мастер'} | GM BIQS Стандарт: ${info.compliance_score || 96.0}% | Состояние: ${info.status || 'В норме'}`;
    }

    // 4 KPI Counters
    const planEl = document.getElementById("master-plan-val");
    if (planEl) planEl.textContent = `${sum.total_plan || 0} шт`;

    const factEl = document.getElementById("master-fact-val");
    if (factEl) factEl.textContent = `${sum.total_fact || 0} шт`;

    const rateEl = document.getElementById("master-rate-val");
    if (rateEl) rateEl.textContent = `${sum.completion_rate || 0}%`;

    const scrapEl = document.getElementById("master-scrap-val");
    if (scrapEl) scrapEl.textContent = `${sum.total_scrap || 0} шт`;

    const downEl = document.getElementById("master-downtime-val");
    if (downEl) downEl.textContent = `${sum.total_downtime || 0} мин`;

    // Lines table
    const linesRows = document.getElementById("master-lines-progress-rows");
    if (linesRows) {
      const lines = data.lines || [];
      if (!lines.length) {
        linesRows.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:20px; color:#94a3b8;">В цеху нет активных линий</td></tr>';
      } else {
        linesRows.innerHTML = lines.map(l => {
          const rate = l.rate != null ? l.rate : 0;
          let statusBadge = '<span class="badge-tag badge-green">🟢 В норме</span>';
          if (l.status === 'Остановка / Ремонт') statusBadge = '<span class="badge-tag badge-red">🚨 Остановка</span>';
          if (l.status === 'План выполнен') statusBadge = '<span class="badge-tag badge-blue">✓ Выполнен</span>';

          return `
            <tr>
              <td><strong>${escapeHtml(l.line_name)}</strong></td>
              <td>${escapeHtml(l.description)}</td>
              <td>${l.plan} шт</td>
              <td><strong style="color:var(--primary-blue);">${l.fact} шт</strong></td>
              <td>
                <div style="display:flex; align-items:center; gap:8px;">
                  <div style="flex:1; background:#e2e8f0; height:8px; border-radius:4px; overflow:hidden;">
                    <div style="width:${Math.min(rate, 100)}%; background:${rate >= 90 ? '#10b981' : rate >= 50 ? '#2563eb' : '#f59e0b'}; height:100%;"></div>
                  </div>
                  <span style="font-size:12px; font-weight:800;">${rate}%</span>
                </div>
              </td>
              <td><span class="badge-tag ${l.scrap > 0 ? 'badge-red' : 'badge-green'}">${l.scrap} шт</span></td>
              <td><span class="badge-tag ${l.downtime > 0 ? 'badge-amber' : 'badge-green'}">${l.downtime} мин</span></td>
              <td>${statusBadge}</td>
            </tr>
          `;
        }).join("");
      }
    }

    // Active Andon Issues in Workshop
    const issuesBadge = document.getElementById("master-issues-badge");
    const issuesBox = document.getElementById("master-active-issues-box");
    const issues = data.active_issues || [];

    if (issuesBadge) {
      issuesBadge.textContent = `${issues.length} инцидентов`;
      issuesBadge.className = `badge-tag ${issues.length > 0 ? 'badge-red' : 'badge-green'}`;
    }

    if (issuesBox) {
      if (!issues.length) {
        issuesBox.innerHTML = '<p style="color:#059669; font-size:13px; font-weight:700;"><i class="fa-solid fa-circle-check"></i> Все технологические посты цеха работают стабильно. Оцепок Andon нет.</p>';
      } else {
        issuesBox.innerHTML = issues.map(iss => `
          <div style="background:#fef2f2; border:1px solid #fecaca; border-radius:8px; padding:12px 16px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
            <div>
              <div style="font-size:14px; font-weight:800; color:#991b1b;">${escapeHtml(iss.ticket_number)}: ${escapeHtml(iss.line_name)}</div>
              <div style="font-size:12px; color:#b91c1c;">${escapeHtml(iss.defect_type)} (${iss.downtime_minutes} мин простоя)</div>
              <div style="font-size:12px; color:#475569; margin-top:2px;">${escapeHtml(iss.description)}</div>
            </div>
            <button type="button" class="btn-compact-action" style="background:#ef4444;" onclick="openMechanicResolveModal('${iss.id}')">
              <i class="fa-solid fa-wrench"></i> Направить ОГМ
            </button>
          </div>
        `).join("");
      }
    }

    // Shift report summary
    const repBox = document.getElementById("master-report-summary-box");
    const repBadge = document.getElementById("master-report-status-badge");
    const rep = data.recent_report;
    if (rep) {
      if (repBadge) {
        repBadge.textContent = rep.status === "approved_by_director" ? "Утверждён Директором" : (rep.status === "reviewed_by_head" ? "Завизирован" : "Сдан мастером");
        repBadge.className = `badge-tag ${rep.status === 'approved_by_director' ? 'badge-green' : 'badge-amber'}`;
      }
      if (repBox) {
        repBox.innerHTML = `
          <div><strong>Дата:</strong> ${rep.report_date} (${rep.shift}) | <strong>Выпуск:</strong> ${rep.fact_units} из ${rep.plan_units} шт (${((rep.fact_units/rep.plan_units)*100).toFixed(1)}%)</div>
          <div><strong>Инциденты:</strong> ${escapeHtml(rep.issues_summary || 'Без существенных отклонений')}</div>
          ${rep.director_verdict ? `<div style="margin-top:6px; background:#eff6ff; padding:8px 12px; border-left:4px solid var(--primary-blue); border-radius:4px;"><strong>Резолюция Генерального директора:</strong> ${escapeHtml(rep.director_verdict)}</div>` : ''}
        `;
      }
    } else {
      if (repBadge) repBadge.textContent = "Не сдан";
      if (repBox) repBox.textContent = "Рапорт за смену еще не сдан. Нажмите «Сдать сменный рапорт цеха» выше.";
    }

  } catch (err) {
    console.error("Error loading master dashboard", err);
  }
}

// ==================== 3. EXECUTIVE DIRECTOR LOGIC (ALL FACTORY WITH CHARTS) ====================

async function loadExecutiveBI() {
  try {
    const res = await fetch("/api/executive/bi");
    if (!res.ok) throw new Error("BI API error");
    const data = await res.json();

    // 1. Output KPI
    const prod = data.total_production_number || {};
    document.getElementById("bi-total-production").textContent = `${prod.fact || 0} шт.`;
    document.getElementById("bi-prod-rate").textContent = `${prod.rate || 0}%`;
    document.getElementById("bi-prod-plan-sub").textContent = `План завода: ${prod.plan || 0} комплектов сидений`;

    // 2. Defect KPI
    const def = data.total_defect_rate || {};
    document.getElementById("bi-defect-rate").textContent = `${def.percent || 0}%`;
    document.getElementById("bi-ppm-badge").textContent = `${def.ppm || 0} PPM`;
    document.getElementById("bi-scrap-units-sub").textContent = `Всего ${def.total_scrap_units || 0} отбракованных узлов изолировано в Red Box`;

    // 3. OEE KPI
    const oee = data.oee || {};
    document.getElementById("bi-oee-val").textContent = `${oee.overall_oee || 0}%`;
    document.getElementById("bi-oee-avail").textContent = `${oee.availability || 0}%`;
    document.getElementById("bi-oee-perf").textContent = `${oee.performance || 0}%`;
    document.getElementById("bi-oee-qual").textContent = `${oee.quality || 0}%`;

    // 4. Financial Loss
    const fin = data.financial_loss || {};
    const lossMil = (fin.total_loss_uzs / 1000000).toFixed(2);
    document.getElementById("bi-total-loss").textContent = `${lossMil} млн сум`;
    document.getElementById("bi-loss-usd").textContent = `$${fin.total_loss_usd || 0} USD`;

    // 5. 30-min Critical Escalation Alert
    const alertBox = document.getElementById("director-escalation-alert-box");
    const escalated = data.escalated_critical_issues || [];
    if (escalated.length > 0) {
      const topEsc = escalated[0];
      document.getElementById("escalation-banner-title").textContent = `🚨 КРИТИЧЕСКАЯ ЭСКАЛАЦИЯ ДИРЕКТОРУ: Простой линии более ${topEsc.downtime_minutes} минут!`;
      document.getElementById("escalation-banner-desc").textContent = `Цех: ${topEsc.dept_name_ru || topEsc.department_id} • Линия: ${topEsc.line_name} • Проблема: ${topEsc.defect_type}`;
      document.getElementById("escalation-banner-time").textContent = `Простой: ${topEsc.downtime_minutes} мин`;
      alertBox.classList.remove("hidden");
    } else {
      alertBox.classList.add("hidden");
    }

    // 6. Draw 4 Interactive Charts
    renderDirectorCharts(data);

    // 7. Factory Floor Live 9-Card Grid
    renderFactoryFloorCards(data.bottlenecks || []);

    // 8. Bottlenecks Table
    renderBottlenecksTable(data.bottlenecks || []);

  } catch (err) {
    console.error("Error loading executive BI", err);
  }
}

function renderDirectorCharts(biData) {
  // Global Chart.js styling for Dark Theme
  Chart.defaults.color = '#94a3b8';
  Chart.defaults.borderColor = 'rgba(255, 255, 255, 0.07)';
  Chart.defaults.font.family = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";

  // Chart 1: Hourly Production Line Chart
  const ctxHourly = document.getElementById("chartHourlyProduction");
  if (ctxHourly) {
    const hourly = biData.hourly_production || [];
    const labels = hourly.map(h => h.hour);
    const planData = hourly.map(h => h.plan);
    const factData = hourly.map(h => h.fact);

    if (chartHourlyInstance) chartHourlyInstance.destroy();
    chartHourlyInstance = new Chart(ctxHourly, {
      type: "line",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Фактический выпуск завода (шт)",
            data: factData,
            borderColor: "#38bdf8",
            backgroundColor: "rgba(56, 189, 248, 0.15)",
            borderWidth: 3,
            fill: true,
            tension: 0.35,
            pointBackgroundColor: "#0284c7",
            pointBorderColor: "#38bdf8",
            pointBorderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 6
          },
          {
            label: "Плановый темп завода (шт)",
            data: planData,
            borderColor: "#64748b",
            borderWidth: 2,
            borderDash: [5, 5],
            fill: false,
            tension: 0.1,
            pointRadius: 2
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { position: "top", labels: { color: "#cbd5e1", boxWidth: 12, font: { weight: "600", size: 11 } } },
          tooltip: {
            backgroundColor: "rgba(15, 23, 42, 0.95)",
            titleColor: "#f8fafc",
            bodyColor: "#cbd5e1",
            borderColor: "rgba(56, 189, 248, 0.3)",
            borderWidth: 1
          }
        },
        scales: {
          y: {
            beginAtZero: false,
            grid: { color: "rgba(255, 255, 255, 0.06)" },
            ticks: { color: "#94a3b8" }
          },
          x: {
            grid: { color: "rgba(255, 255, 255, 0.03)" },
            ticks: { color: "#94a3b8" }
          }
        }
      }
    });
  }

  // Chart 2: Workshop Output Bar Chart
  const ctxShop = document.getElementById("chartWorkshopOutput");
  if (ctxShop) {
    const bnecks = (biData.bottlenecks || []).filter(b => b.plan > 10);
    const labels = bnecks.map(b => b.name_ru.split(" ")[0]);
    const planData = bnecks.map(b => b.plan);
    const factData = bnecks.map(b => b.fact);

    if (chartWorkshopInstance) chartWorkshopInstance.destroy();
    chartWorkshopInstance = new Chart(ctxShop, {
      type: "bar",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Факт (шт)",
            data: factData,
            backgroundColor: "#10b981",
            borderRadius: 6
          },
          {
            label: "План (шт)",
            data: planData,
            backgroundColor: "rgba(148, 163, 184, 0.3)",
            borderColor: "rgba(148, 163, 184, 0.5)",
            borderWidth: 1,
            borderRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "top", labels: { color: "#cbd5e1", boxWidth: 12, font: { weight: "600", size: 11 } } },
          tooltip: {
            backgroundColor: "rgba(15, 23, 42, 0.95)",
            titleColor: "#f8fafc",
            bodyColor: "#cbd5e1",
            borderColor: "rgba(16, 185, 129, 0.3)",
            borderWidth: 1
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: "rgba(255, 255, 255, 0.06)" },
            ticks: { color: "#94a3b8" }
          },
          x: {
            grid: { display: false },
            ticks: { color: "#94a3b8" }
          }
        }
      }
    });
  }

  // Chart 3: Defect Pareto Doughnut Chart
  const ctxDefect = document.getElementById("chartDefectPareto");
  if (ctxDefect) {
    const defects = biData.defect_categories || [];
    const labels = defects.map(d => d.name);
    const counts = defects.map(d => d.count);
    const colors = defects.map(d => d.color || "#0284c7");

    if (chartDefectParetoInstance) chartDefectParetoInstance.destroy();
    chartDefectParetoInstance = new Chart(ctxDefect, {
      type: "doughnut",
      data: {
        labels: labels,
        datasets: [{
          data: counts,
          backgroundColor: colors,
          borderWidth: 2,
          borderColor: "#0f172a"
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "bottom", labels: { color: "#cbd5e1", boxWidth: 10, font: { size: 11 } } },
          tooltip: {
            backgroundColor: "rgba(15, 23, 42, 0.95)",
            titleColor: "#f8fafc",
            bodyColor: "#cbd5e1",
            borderColor: "rgba(255, 255, 255, 0.15)",
            borderWidth: 1
          }
        },
        cutout: "65%"
      }
    });
  }

  // Chart 4: Downtime Reasons Horizontal Bar
  const ctxDown = document.getElementById("chartDowntimeReasons");
  if (ctxDown) {
    const downtime = biData.downtime_by_reason || [];
    const labels = downtime.map(d => d.reason);
    const minutes = downtime.map(d => d.minutes);
    const colors = downtime.map(d => d.color || "#ef4444");

    if (chartDowntimeInstance) chartDowntimeInstance.destroy();
    chartDowntimeInstance = new Chart(ctxDown, {
      type: "bar",
      data: {
        labels: labels,
        datasets: [{
          label: "Простой (минут)",
          data: minutes,
          backgroundColor: colors,
          borderRadius: 6
        }]
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: "rgba(15, 23, 42, 0.95)",
            titleColor: "#f8fafc",
            bodyColor: "#cbd5e1",
            borderColor: "rgba(239, 68, 68, 0.3)",
            borderWidth: 1
          }
        },
        scales: {
          x: {
            beginAtZero: true,
            grid: { color: "rgba(255, 255, 255, 0.06)" },
            ticks: { color: "#94a3b8" }
          },
          y: {
            grid: { display: false },
            ticks: { color: "#94a3b8" }
          }
        }
      }
    });
  }
}

function renderFactoryFloorCards(departments) {
  const container = document.getElementById("factory-floors-grid");
  if (!container) return;

  container.innerHTML = departments.map(d => {
    const rate = d.plan > 0 ? ((d.fact / d.plan) * 100).toFixed(1) : 100;
    const isAlert = d.downtime > 20 || d.scrap > 3;

    return `
      <div class="floor-card" onclick="openWorkshopFromDirector('${d.id}')">
        <div class="floor-card-top">
          <span class="floor-code-badge">${d.code}</span>
          <span class="badge-tag ${isAlert ? 'badge-red' : 'badge-green'}">
            ${isAlert ? '⚠️ Внимание' : '🟢 В норме'}
          </span>
        </div>
        <div class="floor-name-title">${escapeHtml(d.name_ru)}</div>
        <div style="font-size:12px; color:var(--text-muted); margin-bottom:8px;">Начальник: ${escapeHtml(d.head_name)}</div>
        <div class="floor-stats-row">
          <span>Выпуск: <strong>${d.fact} / ${d.plan}</strong> (${rate}%)</span>
          <span>Простой: <strong style="color:${d.downtime > 0 ? 'var(--accent-amber)' : 'var(--accent-emerald)'};">${d.downtime}м</strong></span>
        </div>
      </div>
    `;
  }).join("");
}

function openWorkshopFromDirector(deptId) {
  currentMasterDept = deptId;
  switchMainWorkspace("master");
  showToast(`Открыт цех: ${deptId}`, "info");
}

function renderBottlenecksTable(bottlenecks) {
  const tbody = document.getElementById("bi-bottlenecks-rows");
  if (!tbody) return;

  tbody.innerHTML = bottlenecks.map(b => {
    const rate = b.plan > 0 ? ((b.fact / b.plan) * 100).toFixed(1) : 100;
    const isNorm = b.downtime <= 15 && b.scrap <= 3;

    return `
      <tr>
        <td><strong>${escapeHtml(b.name_ru)}</strong> (${b.code})</td>
        <td>${escapeHtml(b.head_name)}</td>
        <td>${b.plan} шт</td>
        <td><strong style="color:var(--primary-blue);">${b.fact} шт</strong></td>
        <td><span class="badge-tag ${rate >= 95 ? 'badge-green' : 'badge-amber'}">${rate}%</span></td>
        <td><span class="badge-tag ${b.scrap > 2 ? 'badge-red' : 'badge-green'}">${b.scrap} шт</span></td>
        <td><span class="badge-tag ${b.downtime > 15 ? 'badge-red' : (b.downtime > 0 ? 'badge-amber' : 'badge-green')}">${b.downtime} мин</span></td>
        <td>
          <button type="button" class="btn-compact-action" style="font-size:11px;" onclick="openWorkshopFromDirector('${b.id}')">
            Открыть цех →
          </button>
        </td>
      </tr>
    `;
  }).join("");
}

// ==================== ANDON SYSTEM LOGIC ====================

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
        showToast(`🚨 СИГНАЛ ANDON №${data.ticket_number} ПРИНЯТ! Службы оповещены.`, "warning");
        closeModal("modal-andon-trigger");
        form.reset();
        loadAndonFeed();
        if (currentWorkspace === "master") loadMasterDashboard();
        if (currentWorkspace === "director") loadExecutiveBI();
      } else {
        showToast(data.detail || "Ошибка вызова Andon", "error");
      }
    } catch (err) {
      showToast("Ошибка отправки сигнала", "error");
    }
  });
}

async function loadAndonFeed() {
  const container = document.getElementById("andon-feed-container");
  try {
    const res = await fetch("/api/andon/feed");
    const data = await res.json();
    allAndonEvents = data.events || [];
    const stats = data.stats || {};

    const badge = document.getElementById("nav-andon-badge");
    if (badge) {
      if (stats.active_stops > 0) {
        badge.textContent = stats.active_stops;
        badge.style.display = "inline-block";
      } else {
        badge.style.display = "none";
      }
    }

    if (!container) return;
    if (!allAndonEvents.length) {
      container.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:30px; background:#fff; border-radius:12px; color:#64748b;">✅ Все линии завода работают в норме. Активных остановок нет.</div>';
      return;
    }

    container.innerHTML = allAndonEvents.map(ev => {
      const isClosed = ev.status === "closed";
      const isVerif = ev.status === "verification";
      const isEsc = ev.escalated_to_director || ev.current_downtime_minutes >= 30;

      return `
        <div class="andon-card ${isClosed ? 'andon-closed' : (isEsc ? 'andon-escalated' : (isVerif ? 'andon-verified' : 'andon-critical'))}">
          <div class="andon-card-header">
            <span class="andon-ticket-pill">${ev.ticket_number}</span>
            <span class="badge-tag ${isClosed ? 'badge-green' : (isVerif ? 'badge-amber' : 'badge-red')}">
              ${isClosed ? '✓ Разблокирована' : (isVerif ? '⚙️ Проверка ОТК' : '🚨 Остановка линии')}
            </span>
          </div>

          <div class="andon-line-title">${escapeHtml(ev.line_name)}</div>
          <div style="font-size:12px; font-weight:700; color:var(--primary-blue); margin-bottom:4px;">${escapeHtml(ev.defect_type)}</div>
          <div class="andon-desc-text">${escapeHtml(ev.description)}</div>

          <div style="font-size:12px; color:var(--text-muted); margin-bottom:10px;">
            Простой: <strong style="color:${ev.current_downtime_minutes >= 30 ? 'red' : 'inherit'};">${ev.current_downtime_minutes} мин</strong>
          </div>

          <div class="andon-actions-bar">
            ${!isClosed && !isVerif ? `
              <button type="button" class="btn-compact-action" style="background:var(--primary-blue);" onclick="openMechanicResolveModal('${ev.id}')">
                <i class="fa-solid fa-wrench"></i> Отчитаться о ремонте
              </button>
            ` : ''}

            ${isVerif ? `
              <button type="button" class="btn-compact-action" style="background:var(--accent-emerald);" onclick="openControllerUnlockModal('${ev.id}')">
                <i class="fa-solid fa-lock-open"></i> Проверить и разблокировать (ОТК)
              </button>
            ` : ''}

            ${isClosed ? '<span style="font-size:11px; color:#059669; font-weight:700;">✓ Инцидент закрыт</span>' : ''}
          </div>
        </div>
      `;
    }).join("");

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
    <strong>${ev.ticket_number} - ${escapeHtml(ev.line_name)}</strong>
    <div>${escapeHtml(ev.defect_type)}</div>
    <div style="color:#64748b; font-size:12px; margin-top:4px;">${escapeHtml(ev.description)}</div>
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
      if (res.ok) {
        showToast("✅ Ремонт зафиксирован. Линия передана ОТК для проверки первой детали.", "success");
        closeModal("modal-mechanic-resolve");
        form.reset();
        loadAndonFeed();
        if (currentWorkspace === "master") loadMasterDashboard();
      }
    } catch (err) {
      showToast("Ошибка сохранения", "error");
    }
  });
}

// Controller Unlock Modal
function openControllerUnlockModal(issueId) {
  const ev = allAndonEvents.find(e => e.id === issueId);
  if (!ev) return;
  document.getElementById("unlock-issue-id").value = issueId;
  document.getElementById("unlock-issue-summary").innerHTML = `
    <strong>${ev.ticket_number} - ${escapeHtml(ev.line_name)}</strong>
    <div style="color:var(--primary-blue); font-weight:700;">Отчёт механика: ${escapeHtml(ev.mechanic_notes || 'Ремонт завершен')}</div>
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
      if (res.ok) {
        showToast("🎉 ЛИНИЯ УСПЕШНО РАЗБЛОКИРОВАНА И ЗАПУЩЕНА В РАБОТУ!", "success");
        closeModal("modal-controller-unlock");
        form.reset();
        loadAndonFeed();
        if (currentWorkspace === "master") loadMasterDashboard();
        if (currentWorkspace === "director") loadExecutiveBI();
      }
    } catch (err) {
      showToast("Ошибка разблокировки", "error");
    }
  });
}

// ==================== SHIFT REPORTS LOGIC ====================

function openSubmitShiftReportModal() {
  const todayStr = new Date().toISOString().split("T")[0];
  const srDate = document.getElementById("sr-date");
  if (srDate) srDate.value = todayStr;

  const srDept = document.getElementById("sr-dept");
  if (srDept && currentMasterDept) srDept.value = currentMasterDept;

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
        showToast("✅ Сменный рапорт успешно отправлен Директорату завода!", "success");
        closeModal("modal-submit-shift-report");
        loadShiftReports();
        if (currentWorkspace === "master") loadMasterDashboard();
        if (currentWorkspace === "director") loadExecutiveBI();
      } else {
        showToast(data.detail || "Ошибка отправки рапорта", "error");
      }
    } catch (err) {
      showToast("Ошибка отправки рапорта", "error");
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
      container.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:30px; background:#fff; border-radius:12px; color:#64748b;">Нет рапортов. Нажмите «Сдать сменный рапорт» выше.</div>';
      return;
    }

    container.innerHTML = allShiftReports.map(sr => {
      const rate = sr.plan_units > 0 ? ((sr.fact_units / sr.plan_units) * 100).toFixed(1) : 0;
      let statusBadge = '<span class="badge-tag badge-amber">Сдан мастером</span>';
      if (sr.status === 'reviewed_by_head') statusBadge = '<span class="badge-tag badge-blue">Завизирован</span>';
      if (sr.status === 'approved_by_director') statusBadge = '<span class="badge-tag badge-green">✓ Утверждён Директором</span>';

      return `
        <div class="shift-report-card">
          <div style="display:flex; justify-content:space-between; align-items:flex-start;">
            <div>
              <span class="badge-tag badge-blue">${sr.shift} • ${sr.report_date}</span>
              <h4 style="font-size:15px; font-weight:800; color:var(--text-main); margin-top:4px;">${escapeHtml(sr.dept_name)}</h4>
              <div style="font-size:12px; color:var(--text-muted);">Мастер: ${escapeHtml(sr.author_name)}</div>
            </div>
            ${statusBadge}
          </div>

          <div class="shift-report-kpis">
            <div><div class="report-kpi-val">${sr.plan_units}</div><div class="report-kpi-lbl">План</div></div>
            <div><div class="report-kpi-val" style="color:var(--primary-blue);">${sr.fact_units}</div><div class="report-kpi-lbl">Факт (${rate}%)</div></div>
            <div><div class="report-kpi-val" style="color:var(--accent-danger);">${sr.scrap_units}</div><div class="report-kpi-lbl">Брак</div></div>
            <div><div class="report-kpi-val" style="color:var(--accent-amber);">${sr.downtime_minutes}м</div><div class="report-kpi-lbl">Простой</div></div>
          </div>

          <div style="font-size:12px; color:var(--text-secondary); margin-bottom:8px;">
            <strong>Инциденты:</strong> ${escapeHtml(sr.issues_summary || 'Без существенных отклонений')}
          </div>

          ${sr.kaizen_suggestions ? `
            <div style="font-size:12px; color:#065f46; background:#ecfdf5; padding:6px 10px; border-radius:6px; margin-bottom:8px;">
              <strong>💡 Kaizen:</strong> ${escapeHtml(sr.kaizen_suggestions)}
            </div>
          ` : ''}

          ${sr.director_verdict ? `
            <div style="font-size:12px; color:#1e293b; background:#f1f5f9; border-left:3px solid var(--primary-blue); padding:6px 10px; border-radius:4px; margin-bottom:10px;">
              <strong>👔 Резолюция Директора:</strong> ${escapeHtml(sr.director_verdict)}
            </div>
          ` : ''}

          <div style="display:flex; gap:8px; margin-top:auto; padding-top:10px; border-top:1px solid var(--border-light);">
            ${sr.status === 'submitted' ? `
              <button type="button" class="btn-compact-action" style="background:#f1f5f9; color:var(--text-main);" onclick="openHeadReviewModal('${sr.id}')">
                Визировать (Начальник)
              </button>
            ` : ''}

            ${sr.status !== 'approved_by_director' ? `
              <button type="button" class="btn-compact-action" style="background:var(--bg-header);" onclick="openDirectorApproveModal('${sr.id}', '${escapeHtml(sr.dept_name)}', '${escapeHtml(sr.author_name)}')">
                <i class="fa-solid fa-signature"></i> Утвердить (Директор)
              </button>
            ` : '<span style="font-size:11px; color:#059669; font-weight:700;"><i class="fa-solid fa-check-double"></i> Рапорт утвержден</span>'}
          </div>
        </div>
      `;
    }).join("");

  } catch (err) {
    console.error("Error loading shift reports", err);
  }
}

// Director Approval Modal
function openDirectorApproveModal(reportId, deptName, authorName) {
  document.getElementById("approve-report-id").value = reportId;
  document.getElementById("approve-report-summary").innerHTML = `
    <strong>Цех:</strong> ${deptName || 'Сборочный цех'} | <strong>Мастер:</strong> ${authorName || 'Карим Азизов'}
  `;
  document.getElementById("modal-director-approve").classList.remove("hidden");
}

function onDirectorVerdictTemplateChange(val) {
  document.getElementById("director-verdict-text").value = val;
}

function setupDirectorApproveHandler() {
  const form = document.getElementById("form-director-approve");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const reportId = document.getElementById("approve-report-id").value;
    const verdict = document.getElementById("director-verdict-text").value.trim();

    try {
      const res = await fetch(`/api/shift-reports/${reportId}/director-approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ director_verdict: verdict })
      });
      if (res.ok) {
        showToast("✅ Рапорт официально утверждён Генеральным директором!", "success");
        closeModal("modal-director-approve");
        loadShiftReports();
        if (currentWorkspace === "director") loadExecutiveBI();
      }
    } catch (err) {
      showToast("Ошибка утверждения рапорта", "error");
    }
  });
}

// Head Review Modal
function openHeadReviewModal(reportId) {
  document.getElementById("head-review-report-id").value = reportId;
  document.getElementById("modal-head-review").classList.remove("hidden");
}

function setupHeadReviewHandler() {
  const form = document.getElementById("form-head-review");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const reportId = document.getElementById("head-review-report-id").value;
    const comment = document.getElementById("head-review-comment").value.trim();

    try {
      const res = await fetch(`/api/shift-reports/${reportId}/head-review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ head_comment: comment })
      });
      if (res.ok) {
        showToast("Рапорт завизирован руководителем цеха", "success");
        closeModal("modal-head-review");
        loadShiftReports();
      }
    } catch (err) {
      showToast("Ошибка визирования", "error");
    }
  });
}

// ==================== BIQS AUDITS LOGIC ====================

function openNewAuditModal() {
  const container = document.getElementById("audit-questions-container");
  if (container) {
    container.innerHTML = BIQS_STANDARD_QUESTIONS.map((q, idx) => `
      <div style="background:#f8fafc; border:1px solid var(--border-light); border-radius:8px; padding:10px 12px; margin-bottom:8px;">
        <div style="font-size:11px; font-weight:800; color:var(--primary-blue); text-transform:uppercase;">${q.section}</div>
        <div style="font-size:13px; font-weight:600; color:var(--text-main); margin:4px 0 8px 0;">${q.question}</div>
        <div style="display:flex; gap:16px;">
          <label style="font-size:12px; font-weight:700; color:var(--accent-emerald); cursor:pointer;">
            <input type="radio" name="audit-q-${idx}" value="yes" checked> Да (Соблюдается)
          </label>
          <label style="font-size:12px; font-weight:700; color:var(--accent-danger); cursor:pointer;">
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
      questions: BIQS_STANDARD_QUESTIONS.map(q => ({ section: q.section, question: q.question, result: "pass" })),
      comments: "Обход завершен. Стандарты GM BIQS соблюдаются."
    };

    try {
      const res = await fetch("/api/audits/biqs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        showToast("✅ Аудит BIQS успешно зафиксирован в единой базе завода!", "success");
        closeModal("modal-biqs-audit");
        loadAudits();
      }
    } catch (err) {
      showToast("Ошибка сохранения аудита", "error");
    }
  });
}

async function loadAudits() {
  const container = document.getElementById("audits-list-container");
  if (!container) return;

  try {
    const res = await fetch("/api/audits/biqs");
    const data = await res.json();
    const rows = data.audits || [];

    if (!rows.length) {
      container.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:30px; background:#fff; border-radius:12px; color:#64748b;">Аудитов пока нет. Нажмите «Провести аудит BIQS».</div>';
      return;
    }

    container.innerHTML = rows.map(a => `
      <div class="card" style="border-left:5px solid var(--accent-emerald);">
        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
          <div>
            <h4 style="font-size:15px; font-weight:800; color:var(--text-main);">${escapeHtml(a.line_name)}</h4>
            <div style="font-size:12px; color:var(--text-muted); margin-top:2px;">Аудитор: ${escapeHtml(a.auditor_name)} | Оператор: ${escapeHtml(a.worker_name)}</div>
          </div>
          <span class="badge-tag badge-green" style="font-size:14px; font-weight:900;">${a.compliance_score}% BIQS</span>
        </div>
        <p style="font-size:13px; color:var(--text-secondary); margin-top:10px;">${escapeHtml(a.comments || 'Замечаний не выявлено. Стандарты выполняются.')}</p>
      </div>
    `).join("");

  } catch (err) {
    console.error("Error loading audits", err);
  }
}

// ==================== ADMIN PANEL LOGIC ====================

function openCreateKeyModal() {
  document.getElementById("modal-create-key").classList.remove("hidden");
}

function setupAdminHandlers() {
  const formKey = document.getElementById("form-create-key");
  if (!formKey) return;

  formKey.addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
      role: document.getElementById("key-role-select").value,
      department_id: document.getElementById("key-dept-select").value,
      max_uses: 25,
      note: document.getElementById("key-note").value
    };

    try {
      const res = await fetch("/api/admin/invite-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`✅ Инвайт-код сгенерирован: ${data.key_code}`, "success");
        closeModal("modal-create-key");
        loadAdminKeys();
      }
    } catch (err) {
      showToast("Ошибка генерации инвайт-кода", "error");
    }
  });
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
        <td><code>${escapeHtml(k.key_code)}</code></td>
        <td>${getRoleDisplayName(k.role)}</td>
        <td>${escapeHtml(k.dept_name_ru || k.department_id)}</td>
        <td>${k.used_count} / ${k.max_uses}</td>
        <td><span class="badge-tag ${k.is_active ? 'badge-green' : 'badge-red'}">${k.is_active ? 'Активен' : 'Отключен'}</span></td>
        <td>${escapeHtml(k.note || '—')}</td>
        <td>
          <button type="button" class="btn-compact-tool" onclick="toggleKey('${k.id}')">${k.is_active ? 'Отключить' : 'Включить'}</button>
        </td>
      </tr>
    `).join("");

    loadAdminLogs();

  } catch (err) {
    console.error("Error loading admin keys", err);
  }
}

async function toggleKey(keyId) {
  try {
    await fetch(`/api/admin/invite-keys/${keyId}/toggle`, { method: "POST" });
    showToast("Статус ключа изменён", "info");
    loadAdminKeys();
  } catch (e) {}
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
        <td>${escapeHtml(l.username)}</td>
        <td><strong>${escapeHtml(l.action)}</strong></td>
        <td style="font-size:12px;">${escapeHtml(l.detail)}</td>
      </tr>
    `).join("");

  } catch (err) {
    console.error("Error loading admin logs", err);
  }
}

// ==================== DEPARTMENTS & SELECTS POPULATION ====================

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
    console.error("Error loading lines", err);
  }
}

function populateGlobalSelects() {
  const optionsHtml = allDepartments.map(d => `<option value="${d.id}">${d.code}: ${d.name_ru}</option>`).join("");

  const wsiDept = document.getElementById("wsi-dept");
  if (wsiDept) { wsiDept.innerHTML = optionsHtml; onWorkerDeptChange(); }

  const andonDept = document.getElementById("andon-target-dept");
  if (andonDept) { andonDept.innerHTML = optionsHtml; onAndonDeptChange(); }

  const srDept = document.getElementById("sr-dept");
  if (srDept) { srDept.innerHTML = optionsHtml; }

  const auditDept = document.getElementById("audit-dept-select");
  if (auditDept) { auditDept.innerHTML = optionsHtml; }

  const keyDept = document.getElementById("key-dept-select");
  if (keyDept) { keyDept.innerHTML = '<option value="all">Все цеха</option>' + optionsHtml; }
}

function onWorkerDeptChange() {
  const deptEl = document.getElementById("wsi-dept");
  if (!deptEl) return;
  const deptId = deptEl.value;
  const lineSelect = document.getElementById("wsi-line");
  const filtered = allAssemblyLines.filter(l => l.department_id === deptId);
  lineSelect.innerHTML = filtered.length ? filtered.map(l => `<option value="${l.name}">${l.name}</option>`).join("") : '<option value="Общий пост цеха">Общий пост цеха</option>';
}

function onAndonDeptChange() {
  const deptEl = document.getElementById("andon-target-dept");
  if (!deptEl) return;
  const deptId = deptEl.value;
  const lineSelect = document.getElementById("andon-line-name");
  const filtered = allAssemblyLines.filter(l => l.department_id === deptId);
  lineSelect.innerHTML = filtered.length ? filtered.map(l => `<option value="${l.name}">${l.name}</option>`).join("") : '<option value="Главная линия">Главная линия</option>';
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

window.onkeydown = function(event) {
  if (event.key === "Escape") {
    document.querySelectorAll(".modal-overlay").forEach(m => m.classList.add("hidden"));
  }
};

// ==================== FACTORY-WIDE DEFECT & ANDON BROADCAST SYSTEM (GM BIQS) ====================

let currentFactoryAlerts = { total_active: 0, active_issues: [], recent_defects: [] };

async function pollFactoryAlerts() {
  try {
    const res = await fetch("/api/factory/live-alerts");
    if (!res.ok) return;
    const data = await res.json();
    currentFactoryAlerts = data;

    const bar = document.getElementById("factory-live-alert-broadcast");
    const badge = document.getElementById("fbb-badge-text");
    const headline = document.getElementById("fbb-headline-text");
    const counterPill = document.getElementById("fbb-counter-pill");
    const countNum = document.getElementById("fbb-count-num");
    const navAndonBadge = document.getElementById("nav-andon-badge");

    const totalActive = data.total_active || 0;

    // Update Nav badge if visible
    if (navAndonBadge) {
      if (totalActive > 0) {
        navAndonBadge.textContent = totalActive;
        navAndonBadge.style.display = "inline-flex";
      } else {
        navAndonBadge.style.display = "none";
      }
    }

    if (!bar) return;

    if (totalActive > 0 && data.latest) {
      // ACTIVE DEFECT / STOP IN FACTORY: EVERYONE SEES IT!
      bar.className = "factory-broadcast-bar status-alert";
      if (badge) badge.textContent = "🚨 БРАК / ОСТАНОВКА";
      if (headline) {
        const top = data.latest;
        headline.innerHTML = `
          <strong>🚨 ВНИМАНИЕ ВСЕМ ЦЕХАМ:</strong> Зафиксирован инцидент на линии 
          <span style="color:#ffffff; font-weight:800; text-decoration:underline;">[${escapeHtml(top.dept)} • ${escapeHtml(top.line)}]</span>: 
          ${escapeHtml(top.title)} 
          ${top.reported_by ? `• Сообщил: <em>${escapeHtml(top.reported_by)}</em>` : ''}
        `;
      }
      if (counterPill) {
        counterPill.classList.remove("hidden");
        if (countNum) countNum.textContent = totalActive;
      }
    } else {
      // NORMAL SAFE STATE
      bar.className = "factory-broadcast-bar status-normal";
      if (badge) badge.textContent = "В НОРМЕ";
      if (headline) {
        headline.innerHTML = `🟢 <strong>Завод работает в штатном режиме:</strong> Все производственные линии запущены. Брака и аварийных остановок нет.`;
      }
      if (counterPill) counterPill.classList.add("hidden");
    }
  } catch (err) {
    // Network/offline silent catch
  }
}

function openFactoryAlertsDrawer() {
  const modal = document.getElementById("modal-factory-alerts");
  if (!modal) return;

  const countBadge = document.getElementById("fbb-modal-active-count");
  if (countBadge) countBadge.textContent = currentFactoryAlerts.total_active || 0;

  const listEl = document.getElementById("factory-alerts-modal-list");
  if (listEl) {
    const issues = currentFactoryAlerts.active_issues || [];
    if (!issues.length) {
      listEl.innerHTML = `
        <div style="padding:16px; text-align:center; background:rgba(16, 185, 129, 0.08); border:1px solid rgba(16, 185, 129, 0.2); border-radius:8px; color:#34d399; font-weight:600;">
          🟢 Открытых аварийных остановок и брака на линиях завода сейчас нет.
        </div>
      `;
    } else {
      listEl.innerHTML = issues.map(iss => {
        const isCritical = iss.severity === "critical_stop" || (iss.downtime_minutes && iss.downtime_minutes >= 30);
        return `
          <div class="factory-alert-item-card ${isCritical ? '' : 'warning-level'}">
            <div class="faic-left">
              <div class="faic-top">
                <span class="badge-tag ${isCritical ? 'badge-red' : 'badge-amber'}">${isCritical ? '🚨 КРИТИЧЕСКИЙ БРАК / СТОП' : '⚠️ ПРЕДУПРЕЖДЕНИЕ'}</span>
                <span class="faic-line">${escapeHtml(iss.dept_name_ru || iss.department_id)} • Линия: ${escapeHtml(iss.line_name)}</span>
              </div>
              <div class="faic-title">${escapeHtml(iss.defect_type)}</div>
              <div class="faic-meta">
                <span><i class="fa-solid fa-user"></i> ${escapeHtml(iss.reported_by || 'Оператор')}</span>
                <span style="margin:0 6px;">•</span>
                <span><i class="fa-regular fa-clock"></i> Время: ${iss.created_at ? iss.created_at.slice(11, 16) : '--:--'}</span>
                ${iss.downtime_minutes ? `<span style="margin:0 6px;">•</span><strong style="color:#ef4444;">Простой: ${iss.downtime_minutes} мин</strong>` : ''}
              </div>
            </div>
            <div>
              <button type="button" class="btn-resolve-alert" onclick="resolveAlertFromModal('${iss.id}')">
                <i class="fa-solid fa-check"></i> Устранено
              </button>
            </div>
          </div>
        `;
      }).join("");
    }
  }

  const tbody = document.getElementById("factory-defects-modal-rows");
  if (tbody) {
    const defects = currentFactoryAlerts.recent_defects || [];
    if (!defects.length) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:16px; color:#94a3b8;">За сегодня записей с браком нет.</td></tr>';
    } else {
      tbody.innerHTML = defects.map(d => `
        <tr>
          <td style="font-weight:700; font-size:12px;">${d.created_at ? d.created_at.slice(11, 16) : '--:--'}</td>
          <td>${escapeHtml(d.dept_name_ru || d.department_id)}</td>
          <td><strong>${escapeHtml(d.line_name)}</strong></td>
          <td>${escapeHtml(d.article)}</td>
          <td><span class="badge-tag badge-red" style="font-weight:800;">${d.defects_count} шт</span></td>
          <td>${escapeHtml(d.defect_reason || '—')}</td>
          <td>${escapeHtml(d.worker_name || 'Оператор')}</td>
        </tr>
      `).join("");
    }
  }

  modal.classList.remove("hidden");
}

async function resolveAlertFromModal(issueId) {
  try {
    const res = await fetch(`/api/factory/resolve-alert/${encodeURIComponent(issueId)}`, { method: "POST" });
    if (res.ok) {
      showToast("✅ Инцидент отмечен как устранённый!", "success");
      await pollFactoryAlerts();
      openFactoryAlertsDrawer();
    } else {
      showToast("Ошибка при закрытии инцидента", "error");
    }
  } catch (err) {
    showToast("Ошибка соединения", "error");
  }
}

// Language Toggle
function setAppLanguage(lang) {
  document.querySelectorAll(".lang-btn").forEach(b => {
    b.classList.toggle("active", b.getAttribute("data-lang") === lang);
  });
  if (typeof setLanguage === "function") {
    try { setLanguage(lang); } catch (e) {}
  }
  showToast(lang === "uz" ? "Til oʻzgartirildi: Oʻzbekcha" : "Язык интерфейса: Русский", "info");
}

// ===== MULTI-LANGUAGE SYSTEM (UZ / RU) FOR JV UZ-TONG HONG CO. =====

const I18N = {
  uz: {
    // Brand & Header
    brandTitle: "«Uz-Tong Hong Co.» QK",
    brandSubtitle: "Tezkor nazorat, auditlar va BIQS sifatni boshqarish platformasi",
    headerBrandTitle: "«Uz-Tong Hong Co.» QK",
    headerSubtitle: "Ishlab chiqarishni tezkor nazorat qilish & BIQS standartlari auditi",
    factoryLocation: "Andijon sh., «Uz-Tong Hong Co.» QK MChJ",
    
    // Auth Screen: Invite Code Primary Entrance
    authInviteTitle: "Tizimga taklif kodi orqali kirish",
    authInviteSubtitle: "Kirish uchun zavod Administratori bergan shaxsiy taklif kodini kiriting",
    lblInviteCodeOnly: "Taklif kodi (Invite Code)",
    phInviteCodeOnly: "Masalan: UTH-AUD-9912",
    lblInspectorNameOpt: "F.I.Sh. yoki lavozimingiz (ixtiyoriy)",
    phInspectorNameOpt: "Tekshiruvchi xodimning F.I.Sh...",
    btnEnterByInvite: "Taklif kodi bilan kirish",
    inviteOnlyWarning: "Platformaga kirish yopiq. Administratordan shaxsiy kod olmagan shaxslar kira olmaydi. Oddiy foydalanuvchilar uchun faqat «BIQS Sifat auditi» boʻlimi ochiladi.",
    
    // Admin Login Sub-screen
    linkAdminLogin: "Bosh Administrator kirishi (login va parol orqali)",
    linkBackToInvite: "← Taklif kodi orqali kirishga qaytish",
    adminLoginTitle: "Zavod Administratori kirishi",
    adminLoginSubtitle: "Taklif kodlari, foydalanuvchilar va butun tizimni boshqarish",
    lblUsername: "Administrator logini",
    lblPassword: "Administrator paroli",
    phUsername: "admin_master_ov777",
    phPassword: "Parolni kiriting...",
    btnAdminLogin: "Boshqaruv paneliga kirish",

    demoCredsTitle: "Tezkor tekshirish uchun taklif kodlari:",
    demoAuditorCode: "Auditor kodi: UTH-AUD-9912",
    demoAssemblyCode: "Yigʻuv sexi kodi: UTH-ASM-8841",
    demoAdminCreds: "Administrator: admin_master_ov777 / Uz_Cobalt_2026_Secure#99",

    // Navigation & Tabs
    navModule1: "Liniyadagi operativ muammolar",
    navModule2: "BIQS Sifat auditlari",
    navModule3: "Direktor tahliliy paneli",
    navModule4: "Admin: Takliflar va Ruxsatlar",
    btnExportPdf: "Hisobotni yuklash (PDF)",
    btnLogout: "Chiqish",
    
    // Module 1: Line Issues
    mod1Title: "1-Modul: Liniyadagi muammolarni tezkor qayd etish va hayotiy sikli",
    mod1Subtitle: "Yigʻuv liniyalari va sexlarda yuzaga kelgan nuqsonlarni real vaqtda bartaraf etish",
    btnReportIssue: "+ Liniyadagi muammoni qayd etish",
    filterDepartment: "Sex/Boʻlim:",
    filterAllDepts: "Barcha sexlar (Umumiy koʻrinish)",
    filterStatus: "Ariza holati:",
    filterAllStatuses: "Barcha holatlar",
    statusOpen: "Qayd etildi",
    statusAssigned: "Masʻul tayinlandi",
    statusInProgress: "Ta'mirlash jarayonida",
    statusVerification: "Foto-tekshiruvda",
    statusClosed: "Yopildi va bartaraf etildi",
    severityStop: "Kritik (Liniya toʻxtashi)",
    severityMajor: "Jiddiy chetlanish",
    severityMinor: "Kichik eʼtiroz",
    ticketLabel: "Tiket:",
    lineLabel: "Liniya / Uchastka:",
    defectTypeLabel: "Nuqson turi:",
    defectDescLabel: "Muammo tavsifi:",
    assignedToLabel: "Masʻul shaxs:",
    initialPhotoLabel: "Liniyadagi nuqson fotosurati:",
    resolvedPhotoLabel: "Muammo bartaraf etilgan fotosurat:",
    actionTakenLabel: "Koʻrilgan choralar / Tuzatish:",
    btnAssignMaster: "Masʻul ustani tayinlash",
    btnTakeInWork: "Ishga qabul qilish",
    btnSendVerification: "Tuzatilgan rasmni yuklash",
    btnCloseIssue: "Vazifa yopilishini tasdiqlash",
    noIssuesFound: "Tanlangan sexda faol nomuvofiqliklar mavjud emas.",

    lblReporter: "Arizachi:",
    lblDowntime: "Behuda turish vaqti:",
    lblBeforeFix: "Tuzatishdan OLDIN",
    lblAfterFix: "Tuzatilgandan KEYIN",
    lblNoPhotoDefect: "Nuqson fotosurati yo'q",
    lblWaitingPhotoVerify: "Fotosurat tasdig'i kutilmoqda",
    
    // Module 2: BIQS Audits
    mod2Title: "2-Modul: Sifat auditi va BIQS standartlariga rioya etilishi",
    mod2Subtitle: "Sexlar boʻylab yurib GM BIQS standartlarini tekshirish va ishchilar bilan soʻrov oʻtkazish",
    btnStartAudit: "+ Yangi auditni boshlash",
    auditLineLabel: "Audit liniyasi:",
    complianceIndexLabel: "BIQS muvofiqlik indeksi:",
    workerKnowledgeLabel: "Ishchi bilan soʻrov (Standartni bilishi):",
    auditorNameLabel: "Tekshiruvchi auditor:",
    auditTimeLabel: "Tekshiruvning aniq vaqti (Real vaqtda qayd etiladi):",
    standardChecklistLabel: "Ishlab chiqarish standartlari tekshiruv roʻyxati:",
    violationPhotosLabel: "Aniqlangan qoidabuzarliklar fotodalillari:",
    auditCommentsLabel: "Sifat inspektorining xulosasi:",
    statusPassed: "Muvofiq",
    statusViolation: "Chetlanish aniqlandi",
    
    // Start Audit Modal
    modalAuditTitle: "Liniyada tezkor BIQS auditini oʻtkazish",
    lblAuditDept: "Tekshirilayotgan sex",
    lblAuditLine: "Liniya va ish posti nomi",
    phAuditLine: "Masalan: Cobalt oʻrindiq yigʻish liniyasi - 4-post",
    lblAuditorName: "Sifat auditorining F.I.Sh.",
    lblWorkerName: "Soʻrov oʻtkazilgan ishchining F.I.Sh.",
    phWorkerName: "Masalan: Ibragimov Sardor (4-toifali yigʻuvchi)",
    lblWorkerKnowledge: "Ishchining ish yoʻriqnomalari (SOS) boʻyicha bilimi:",
    workerKnowsStandard: "Ishchi standartni aniq biladi va SOS kartasiga amal qiladi",
    workerNeedsTraining: "Kamchiliklar aniqlandi / Qayta yoʻriqnoma oʻtkazish zarur",
    lblAuditQuestions: "BIQS standartlari majburiy bandlarini tekshirish:",
    btnSubmitAudit: "Tekshiruvni yakunlash va tizimda qayd etish",
    
    // Module 3: Executive Dashboard
    mod3Title: "3-Modul: Rahbariyat tahliliy paneli",
    mod3Subtitle: "«Uz-Tong Hong Co.» QK ning barcha 5 ta ishlab chiqarish sexini real vaqtda monitoring qilish",
    kpiTotalIssues: "Jami hodisalar",
    kpiOpenIssues: "Munosabat talab qiladi",
    kpiInWork: "Hal etish jarayonida",
    kpiClosedIssues: "Muvaffaqiyatli yopildi",
    kpiLineStops: "Liniya toʻxtashlari (Kritik)",
    kpiBiqsIndex: "Umumiy BIQS indeksi",
    kpiSlaResponse: "Oʻrtacha SLA vaqti",
    kpiHoursUnit: "soat",
    chartIssuesByStatus: "Muammolar holati taqsimoti",
    chartBiqsByDept: "Zavod sexlari boʻyicha BIQS muvofiqlik indeksi (%)",
    tableDeptOverview: "Zavod sexlari boʻyicha yigʻma koʻrsatkichlar",
    thDeptCode: "Kod",
    thDeptName: "Sex / Boʻlinma",
    thDeptHead: "Sex rahbari",
    thDeptIssues: "Jami arizalar",
    thDeptOpen: "Ochiq",
    thDeptClosed: "Yopilgan",
    thDeptBiqs: "BIQS indeksi",
    thDeptStatus: "Sex holati",
    
    // Module 4: Admin Panel
    mod4Title: "4-Modul: Administrator paneli (Taklif kodlari va Boshqaruv)",
    mod4Subtitle: "Shaxsiy taklif kodlarini berish va ishonchli xodimlar uchun login/parol yaratish",
    btnCreateKey: "+ Yangi taklif kodini yaratish",
    thKeyCode: "Taklif kodi",
    thKeyRole: "Belgilanadigan rol",
    thKeyDept: "Sexga biriktirish",
    thKeyUses: "Foydalanildi / Cheklov",
    thKeyStatus: "Holati",
    thKeyAction: "Harakat",
    btnRevoke: "Bekor qilish",
    btnActivate: "Faollashtirish",
    modalCreateKeyTitle: "Xodim uchun taklif kodini yaratish",
    lblKeyRole: "Tizimdagi roli",
    lblKeyDept: "Xodimning sexi / boʻlimi",
    lblKeyMaxUses: "Maksimal faollashtirishlar soni",
    lblKeyNote: "Xizmat eslatmasi / Maqsadi",
    phKeyNote: "Masalan: Yigʻuv sexi inspektorlari uchun",
    btnSaveKey: "Kodni yaratish va nusxa olish",

    // Admin Create User Form
    adminCreateUserSection: "Login va Parol orqali foydalanuvchi hisobini yaratish",
    lblCreateUserUsername: "Yangi foydalanuvchi logini",
    lblCreateUserPassword: "Parol",
    lblCreateUserFullName: "Xodimning F.I.Sh.",
    lblCreateUserRole: "Roli",
    lblCreateUserDept: "Sexi / Boʻlimi",
    btnSubmitCreateUser: "Foydalanuvchini yaratish",
    msgUserCreatedSuccess: "Foydalanuvchi muvaffaqiyatli yaratildi! Endi u login va parol bilan kira oladi.",

    // Roles & Department Names
    roleAdmin: "Bosh Administrator (Tizim egasi)",
    roleDirector: "Bosh direktor / Top-menejment",
    roleShopHead: "Sex boshligʻi / Katta usta",
    roleOperator: "Operator / Liniya ishchisi",
    roleAuditor: "BIQS sifat nazorati inspektori",
    roleUser: "Foydalanuvchi (Auditor)",
    deptAll: "Barcha sexlar (Toʻliq kirish)",

    // Workflow Actions Modal
    modalAssignTitle: "Masʻul ustani tayinlash",
    lblAssigneeName: "Masʻul shaxsning F.I.Sh. yoki lavozimi",
    phAssigneeName: "Masalan: Karim Azizov (Katta usta)",
    btnConfirmAssign: "Masʻulni tasdiqlash",
    modalVerifyTitle: "Nuqson bartaraf etilganini fototasdiqlash",
    lblActionTaken: "Bajarilgan tuzatish ishlari tavsifi",
    phActionTaken: "Qanday ishlar bajarildi, detal almashtirildi, asbob sozlandi...",
    lblVerifyPhoto: "Tuzatilgan qism / detal fotosurati",
    btnConfirmVerify: "Tekshirish va yopishga yuborish",

    // Notifications & Errors
    msgSuccessAudit: "Vaqt qayd etilgan BIQS auditi tizimda muvaffaqiyatli saqlandi!",
    msgSuccessKeyCreated: "Taklif kodi yaratildi va nusxalandi!",
    errSelectPhoto: "Iltimos, nuqson fotosuratini biriktiring yoki kameradan foydalaning",
    errFillFields: "Iltimos, barcha majburiy maydonlarni toʻldiring",
    errConnection: "Server bilan ulanishda xatolik. Internetni tekshiring.",

    // Guest Mode
    btnGuestView: "Mehmon rejimi (Delegatsiyalar uchun demo)",
    guestBannerText: "👁 DEMO-REJIM: Faqat koʻrish. Maʼlumotlarni oʻzgartirish mumkin emas. Delegatsiyalar, auditorlar va investorlar uchun.",
    btnExitGuest: "Chiqish",
    roleGuest: "Mehmon (Demo-rejim)"
  },

  ru: {
    // Brand & Header
    brandTitle: "СП «Uz-Tong Hong Co.»",
    brandSubtitle: "Платформа оперативного контроля, аудитов и качества BIQS",
    headerBrandTitle: "СП «Uz-Tong Hong Co.»",
    headerSubtitle: "Оперативный контроль производства & Аудиты стандартов BIQS",
    factoryLocation: "г. Андижан, СП ООО «Uz-Tong Hong Co.»",
    
    // Auth Screen
    authInviteTitle: "Вход в систему по приглашению",
    authInviteSubtitle: "Для доступа введите персональный код, выданный Администратором завода",
    lblInviteCodeOnly: "Код приглашения (Invite Code)",
    phInviteCodeOnly: "Например: UTH-AUD-9912",
    lblInspectorNameOpt: "Ваше Ф.И.О. или должность (необязательно)",
    phInspectorNameOpt: "Ф.И.О. проверяющего сотрудника...",
    btnEnterByInvite: "Войти по коду приглашения",
    inviteOnlyWarning: "Вход на платформу закрыт. Без персонального кода от Администратора доступ невозможен.",
    
    linkAdminLogin: "Вход для Главного Администратора (по логину и паролю)",
    linkBackToInvite: "← Вернуться к входу по приглашению",
    adminLoginTitle: "Вход для Администратора завода",
    adminLoginSubtitle: "Управление кодами приглашений, пользователями и всей системой",
    lblUsername: "Логин Администратора",
    lblPassword: "Пароль Администратора",
    phUsername: "admin_master_ov777",
    phPassword: "Введите пароль...",
    btnAdminLogin: "Войти в панель управления",

    demoCredsTitle: "Коды приглашений для быстрого теста:",
    demoAuditorCode: "Код Аудитора: UTH-AUD-9912",
    demoAssemblyCode: "Код Сборочного цеха: UTH-ASM-8841",
    demoAdminCreds: "Администратор: admin_master_ov777 / Uz_Cobalt_2026_Secure#99",

    navModule1: "Оперативные проблемы линии",
    navModule2: "BIQS Аудиты качества",
    navModule3: "Дашборд Директора",
    navModule4: "Админ: Инвайты и Доступ",
    btnExportPdf: "Выгрузить отчёт (PDF)",
    btnLogout: "Выход",
    
    mod1Title: "Модуль №1: Оперативная фиксация и жизненный цикл дефектов",
    mod1Subtitle: "Устранение несоответствий на линиях сборки и цехах завода в реальном времени",
    btnReportIssue: "+ Зафиксировать проблему на линии",
    filterDepartment: "Цех/Отдел:",
    filterAllDepts: "Все цеха (Сводный вид)",
    filterStatus: "Статус заявки:",
    filterAllStatuses: "Все статусы",
    statusOpen: "Зафиксировано",
    statusAssigned: "Назначен ответственный",
    statusInProgress: "В процессе устранения",
    statusVerification: "На проверке (Повторное фото)",
    statusClosed: "Устранено и закрыто",
    severityStop: "Критическая (Остановка линии)",
    severityMajor: "Значительное отклонение",
    severityMinor: "Незначительное замечание",
    ticketLabel: "Тикет:",
    lineLabel: "Линия / Участок:",
    defectTypeLabel: "Тип дефекта:",
    defectDescLabel: "Описание проблемы:",
    assignedToLabel: "Ответственный:",
    initialPhotoLabel: "Фотофиксация дефекта на линии:",
    resolvedPhotoLabel: "Повторное фото устранения:",
    actionTakenLabel: "Принятые меры / Устранение:",
    btnAssignMaster: "Назначить ответственного",
    btnTakeInWork: "Взять в работу",
    btnSendVerification: "Загрузить фото устранения",
    btnCloseIssue: "Подтвердить закрытие задачи",
    noIssuesFound: "В выбранном цехе активных несоответствий не зарегистрировано.",

    lblReporter: "Заявил:",
    lblDowntime: "Простой:",
    lblBeforeFix: "ДО Устранения",
    lblAfterFix: "ПОСЛЕ Устранения",
    lblNoPhotoDefect: "Нет фото дефекта",
    lblWaitingPhotoVerify: "Ожидание фото-подтверждения",
    
    mod2Title: "Модуль №2: Аудиты качества и соблюдение стандартов BIQS",
    mod2Subtitle: "Оперативный обход производственных участков с проверкой стандартов GM BIQS и опросом рабочих",
    btnStartAudit: "+ Провести новый аудит обхода",
    auditLineLabel: "Линия аудита:",
    complianceIndexLabel: "Индекс соответствия BIQS:",
    workerKnowledgeLabel: "Опрос рабочего (Знание стандарта):",
    auditorNameLabel: "Проверяющий аудитор:",
    auditTimeLabel: "Точное время обхода:",
    standardChecklistLabel: "Чек-лист проверки производственных стандартов:",
    violationPhotosLabel: "Фотофиксация выявленных замечаний:",
    auditCommentsLabel: "Заключение инспектора качества:",
    statusPassed: "Соответствует",
    statusViolation: "Выявлено отклонение",
    
    modalAuditTitle: "Проведение оперативного аудита BIQS на линии",
    lblAuditDept: "Проверяемый цех",
    lblAuditLine: "Наименование линии и рабочего поста",
    phAuditLine: "Например: Линия Cobalt - Пост сборки #2",
    lblAuditorName: "Ф.И.О. аудитора качества",
    lblWorkerName: "Ф.И.О. опрашиваемого рабочего / оператора",
    phWorkerName: "Например: Ибрагимов Сардор",
    lblWorkerKnowledge: "Результат опроса рабочего по инструкциям (SOS):",
    workerKnowsStandard: "Рабочий четко знает стандарт и соблюдает карту SOS",
    workerNeedsTraining: "Обнаружены пробелы / Требуется повторный инструктаж",
    lblAuditQuestions: "Проверка обязательных пунктов стандартов BIQS:",
    btnSubmitAudit: "Завершить обход и зафиксировать в системе",
    
    mod3Title: "Модуль №3: Сводный аналитический дашборд Руководства",
    mod3Subtitle: "Мониторинг всех 5 производственных цехов завода СП «Uz-Tong Hong Co.» в реальном времени",
    kpiTotalIssues: "Всего инцидентов",
    kpiOpenIssues: "Требуют реакции",
    kpiInWork: "В процессе решения",
    kpiClosedIssues: "Успешно закрыто",
    kpiLineStops: "Остановок линий (Крит)",
    kpiBiqsIndex: "Общий индекс BIQS",
    kpiSlaResponse: "Среднее время SLA",
    kpiHoursUnit: "ч",
    chartIssuesByStatus: "Распределение статусов проблем",
    chartBiqsByDept: "Индекс соответствия BIQS по цехам завода (%)",
    tableDeptOverview: "Сводная матрица показателей по цехам завода",
    thDeptCode: "Код",
    thDeptName: "Цех / Подразделение",
    thDeptHead: "Руководитель цеха",
    thDeptIssues: "Всего заявок",
    thDeptOpen: "Открытых",
    thDeptClosed: "Закрыто",
    thDeptBiqs: "Индекс BIQS",
    thDeptStatus: "Статус цеха",
    
    mod4Title: "Модуль №4: Панель Администратора",
    mod4Subtitle: "Выпуск персональных кодов приглашений и создание логинов/паролей для сотрудников",
    btnCreateKey: "+ Сгенерировать новый инвайт-код",
    thKeyCode: "Код приглашения",
    thKeyRole: "Назначаемая роль",
    thKeyDept: "Привязка к цеху",
    thKeyUses: "Использовано / Лимит",
    thKeyStatus: "Состояние",
    thKeyAction: "Действие",
    btnRevoke: "Отозвать",
    btnActivate: "Активировать",
    modalCreateKeyTitle: "Создание инвайт-ключа для сотрудника",
    lblKeyRole: "Роль в системе",
    lblKeyDept: "Цех / Подразделение сотрудника",
    lblKeyMaxUses: "Максимальное число активаций",
    lblKeyNote: "Служебная заметка / Назначение",
    phKeyNote: "Например: Для инспекторов сборки",
    btnSaveKey: "Сгенерировать и скопировать ключ",

    adminCreateUserSection: "Создание учетной записи с Логином и Паролем",
    lblCreateUserUsername: "Логин для нового пользователя",
    lblCreateUserPassword: "Пароль",
    lblCreateUserFullName: "Ф.И.О. сотрудника",
    lblCreateUserRole: "Роль",
    lblCreateUserDept: "Цех / Отдел",
    btnSubmitCreateUser: "Создать пользователя",
    msgUserCreatedSuccess: "Пользователь успешно создан!",

    roleAdmin: "Главный Администратор",
    roleDirector: "Генеральный директор / Зам",
    roleShopHead: "Начальник цеха / Старший мастер",
    roleOperator: "Оператор линии",
    roleAuditor: "Инспектор службы качества BIQS",
    roleUser: "Пользователь (Аудитор)",
    deptAll: "Все цеха (Сквозной доступ)",

    modalAssignTitle: "Назначение ответственного мастера",
    lblAssigneeName: "Ф.И.О. или должность ответственного",
    phAssigneeName: "Например: Карим Азизов",
    btnConfirmAssign: "Назначить ответственного",
    modalVerifyTitle: "Фото-подтверждение устранения дефекта",
    lblActionTaken: "Описание выполненных корректирующих действий",
    phActionTaken: "Какие работы выполнены...",
    lblVerifyPhoto: "Фотография исправленного узла / детали",
    btnConfirmVerify: "Отправить на проверку и закрытие",

    msgSuccessAudit: "Аудит BIQS успешно сохранен!",
    msgSuccessKeyCreated: "Инвайт-ключ успешно создан!",
    errSelectPhoto: "Пожалуйста, прикрепите фото дефекта",
    errFillFields: "Заполните обязательные поля",
    errConnection: "Ошибка подключения к серверу.",

    btnGuestView: "Гостевой просмотр (Демо)",
    guestBannerText: "👁 ДЕМО-РЕЖИМ: Только просмотр.",
    btnExitGuest: "Выйти",
    roleGuest: "Гость"
  }
};

// DEFAULT LANGUAGE IS UZBEK!
let currentLang = "uz";
localStorage.setItem("uth_language", "uz");

function getLanguage() {
  return currentLang;
}

function setLanguage(lang) {
  if (!I18N[lang]) lang = "uz";
  currentLang = lang;
  localStorage.setItem("uth_language", lang);
  applyTranslations();
  
  document.querySelectorAll(".lang-btn").forEach(btn => {
    if (btn.getAttribute("data-lang") === lang) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });

  if (typeof updateDynamicTexts === "function") {
    updateDynamicTexts();
  }
}

function t(key) {
  return (I18N[currentLang] && I18N[currentLang][key]) || (I18N.uz && I18N.uz[key]) || key;
}

function applyTranslations() {
  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.getAttribute("data-i18n");
    const translation = t(key);
    if (translation) {
      el.textContent = translation;
    }
  });

  document.querySelectorAll("[data-i18n-ph]").forEach(el => {
    const key = el.getAttribute("data-i18n-ph");
    const translation = t(key);
    if (translation) {
      el.setAttribute("placeholder", translation);
    }
  });

  document.querySelectorAll("[data-i18n-title]").forEach(el => {
    const key = el.getAttribute("data-i18n-title");
    const translation = t(key);
    if (translation) {
      el.setAttribute("title", translation);
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  setLanguage("uz");
});

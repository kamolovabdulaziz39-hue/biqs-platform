// ===== ACCURATE MULTI-LANGUAGE SYSTEM (RU / UZ) FOR JV UZ-TONG HONG CO. =====

const I18N = {
  ru: {
    brandTitle: "СП «Uz-Tong Hong Co.»",
    brandSubtitle: "Цифровая MES-платформа управления заводом: Andon, Сменные рапорты и BIQS",
    headerBrandTitle: "СП «Uz-Tong Hong Co.»",
    headerSubtitle: "Единая цифровая нить: Рабочие места, Andon, Сменные рапорты & BIQS",
    factoryStatus: "Завод в работе • 96.8% BIQS • 1-я смена",

    // Workspaces
    wsWorker: "Рабочий стол Работника",
    wsMaster: "Рабочий стол Начальника цеха",
    wsDirector: "Рабочий стол Директора (Весь завод)",
    wsAndon: "Лента Andon",
    wsShiftReports: "Сменные рапорты",
    wsBiqs: "Стандарты BIQS",
    wsAdmin: "Администратор",

    // Worker
    workerTitle: "Рабочий стол: Иброхим Салимов (Оператор сборки)",
    workerChecklistTitle: "Чек-лист начала смены & Стандарты 5S / SOS",
    btnSaveChecklist: "Сохранить подтверждение чек-листа",
    workerTerminalTitle: "Оперативный терминал выработки (Digital Touch Console)",
    btnSubmitProduction: "Зафиксировать выработку в цифровом журнале",
    btnAndonEmergency: "🚨 ВЫЗОВ ANDON: ОСТАНОВКА ЛИНИИ",

    // Master
    masterShopTitle: "Сборочный цех автомобильных сидений",
    btnSubmitMasterReport: "Сдать сменный рапорт",
    masterKpiPlan: "Сменный план цеха",
    masterKpiFact: "Фактический выпуск",
    masterKpiScrap: "Брак цеха (Red Box)",
    masterKpiDowntime: "Простои оборудования",

    // Director
    directorBannerTitle: "Сводный монитор завода: Генеральный директор (Executive BI)",
    directorKpiOutput: "Общий выпуск завода",
    directorKpiDefect: "Общий процент брака",
    directorKpiOee: "OEE Оборудования завода",
    directorKpiLoss: "Финансовые потери",
    directorChartHourly: "Динамика выпуска завода по часам смены (План vs Факт)",
    directorChartWorkshops: "Выработка и загрузка производственных цехов",
    directorChartPareto: "Структура брака завода (Парето дефектов)",
    directorChartDowntime: "Анализ причин простоев оборудования (Downtime)",
    directorMapTitle: "Интерактивная карта состояния всех 9 цехов завода",

    // Buttons
    btnRefresh: "Обновить",
    btnApprove: "Утвердить",
    btnCancel: "Отмена"
  },
  uz: {
    brandTitle: "«Uz-Tong Hong Co.» QK",
    brandSubtitle: "Zavod boshqaruvi raqamli MES platformasi: Andon, Smena hisobotlari va BIQS",
    headerBrandTitle: "«Uz-Tong Hong Co.» QK",
    headerSubtitle: "Yagona raqamli zanjir: Ish oʻrinlari, Andon, Smena hisobotlari & BIQS",
    factoryStatus: "Zavod ish rejimida • 96.8% BIQS • 1-smena",

    // Workspaces
    wsWorker: "Ishchining ish stoli",
    wsMaster: "Sex boshligʻining ish stoli",
    wsDirector: "Direktor boshqaruv paneli (Butun zavod)",
    wsAndon: "Andon tasmasi",
    wsShiftReports: "Smena hisobotlari",
    wsBiqs: "BIQS standartlari",
    wsAdmin: "Administrator",

    // Worker
    workerTitle: "Ishchi ish stoli: Ibrohim Salimov (Yigʻuvchi-operator)",
    workerChecklistTitle: "Smena boshlanishi nazorat varaqasi & 5S / SOS",
    btnSaveChecklist: "Nazorat varaqasini tasdiqlash",
    workerTerminalTitle: "Ishlab chiqarish tezkor kiritish terminali",
    btnSubmitProduction: "Raqamli jurnalga qayd etish",
    btnAndonEmergency: "🚨 ANDON CHAQIRUVI: LINIYA TOʻXTASHI",

    // Master
    masterShopTitle: "Avtomobil oʻrindiqlarini yigʻuv sexi",
    btnSubmitMasterReport: "Smena hisobotini topshirish",
    masterKpiPlan: "Sex smena rejasi",
    masterKpiFact: "Haqiqiy ishlab chiqarish",
    masterKpiScrap: "Sex nuqsoni (Red Box)",
    masterKpiDowntime: "Uskunalar toʻxtalishi",

    // Director
    directorBannerTitle: "Bosh direktor monitoringi (Executive BI)",
    directorKpiOutput: "Zavod umumiy ishlab chiqarishi",
    directorKpiDefect: "Umumiy nuqson ulushi",
    directorKpiOee: "Zavod uskunalari OEE samaradorligi",
    directorKpiLoss: "Moliyaviy yoʻqotishlar",
    directorChartHourly: "Soatlar boʻyicha ishlab chiqarish dinamikasi (Reja / Fakt)",
    directorChartWorkshops: "Ishlab chiqarish sexlari boʻyicha yuklama va fakt",
    directorChartPareto: "Zavod nuqsonlari strukturasi (Pareto tahlili)",
    directorChartDowntime: "Uskunalar toʻxtalishi sabablari tahlili",
    directorMapTitle: "Zavodning barcha 9 ta sexi holati interaktiv xaritasi",

    // Buttons
    btnRefresh: "Yangilash",
    btnApprove: "Tasdiqlash",
    btnCancel: "Bekor qilish"
  }
};

let currentLang = localStorage.getItem("uth_language") || "ru";

function getLanguage() {
  return currentLang;
}

function setLanguage(lang) {
  if (!I18N[lang]) lang = "ru";
  currentLang = lang;
  localStorage.setItem("uth_language", lang);

  document.querySelectorAll(".lang-btn").forEach(btn => {
    btn.classList.toggle("active", btn.getAttribute("data-lang") === lang);
  });
}

function t(key) {
  return (I18N[currentLang] && I18N[currentLang][key]) || (I18N.ru && I18N.ru[key]) || key;
}

document.addEventListener("DOMContentLoaded", () => {
  const savedLang = localStorage.getItem("uth_language") || "ru";
  setLanguage(savedLang);
});


// '[id*="advRsyaReact"]' - поиск примерного id 
// '[class*="AppForecastMoney"]' - поиск примерного класса 
//
// elementsToDelete - эти найденные элементы просто удаляются
//
// elementsToCheckDelete - элементы, которые будут удалены, если внутри них встречаются banWords
// elementsToCheckHide - элементы, которые будут только скрыты (не удалены), если внутри них
//   встречаются banWords - используется для элементов внутри "живых"/виртуализированных сеток
//   (например, карточек Яндекс.Картинок), где физическое удаление узла может рассинхронизировать
//   React-дерево страницы во время скролла и уронить рендер
// stopWords - если эти слова будут найдены внутри elementsToCheckDelete/elementsToCheckHide, то
//   эти элементы не будут тронуты
//
// elementsToHide - эти найденные элементы просто скрываются (display: none), чтобы не было проблем с вёрсткой страницы после удаления рекламы

function isDiffInMinutes(date1, date2, n) {
  const diffMs = Math.abs(date1.getTime() - date2.getTime()); // разница в мс
  const diffMinutes = diffMs / (1000 * 60); // в минутах
  return diffMinutes >= n; // true, если прошло хотя бы n минут
}

function loadSettings(callback) {
  chrome.storage.local.get(['DIEMONIC_ADS_BLOCK_enabled', 'DIEMONIC_ADS_BLOCK_console_log'], (result) => {
    window.DIEMONIC_ADS_BLOCK_enabled = result.DIEMONIC_ADS_BLOCK_enabled !== false;
    window.DIEMONIC_ADS_BLOCK_console_log = result.DIEMONIC_ADS_BLOCK_console_log === true;
    if (callback) callback();
  });
}

function dLog(msg) {
  if (!window.DIEMONIC_ADS_BLOCK_console_log) return;
  console.log("%c🚫[D!EMONIC ADS BLOCK] " + msg, 'background: #464646b9; color: #ff459cff');
}

// Removing/hiding elements can race with the host page's own DOM updates (e.g. a
// React-virtualized grid reordering nodes on scroll), so every mutation is defensive:
// skip nodes already detached, and never let a mutation throw out of tryDeleteAds().
function safeRemove(el, label) {
  try {
    if (!el || !el.isConnected || !el.parentNode) return false;
    el.remove();
    return true;
  } catch (e) {
    dLog("Ошибка при удалении элемента по правилу {" + label + "}: " + e);
    return false;
  }
}

function safeHide(el, label) {
  try {
    if (!el || !el.isConnected) return false;
    el.style.display = "none";
    return true;
  } catch (e) {
    dLog("Ошибка при скрытии элемента по правилу {" + label + "}: " + e);
    return false;
  }
}

async function DownloadConfigs() {
  const linkToRules = "https://bodaiot.github.io/MyADSBlock/BlockADSRules.json";

  fetch(linkToRules)
    .then(response => {
      if (!response.ok) {
        throw new Error('Сетевая ошибка');
      }

      response.json().then(data => {
        // "?? []" guards against a remote rules file still on the old schema (missing a
        // key entirely) — without it JSON.stringify(undefined) stores the literal string
        // "undefined", which later crashes JSON.parse() in tryDeleteAds().
        chrome.storage.local.set({
          "DIEMONIC_ADS_BLOCK_elementsToDelete": JSON.stringify(data.elementsToDelete ?? []),
          "DIEMONIC_ADS_BLOCK_elementsToCheckDelete": JSON.stringify(data.elementsToCheckDelete ?? []),
          "DIEMONIC_ADS_BLOCK_elementsToCheckHide": JSON.stringify(data.elementsToCheckHide ?? []),
          "DIEMONIC_ADS_BLOCK_banWords": JSON.stringify(data.banWords ?? []),
          "DIEMONIC_ADS_BLOCK_stopWords": JSON.stringify(data.stopWords ?? []),
          "DIEMONIC_ADS_BLOCK_elementsToHide": JSON.stringify(data.elementsToHide ?? []),
          "DIEMONIC_ADS_BLOCK_LinksToCheck": JSON.stringify(data.LinksToCheck ?? [])
        });

        chrome.storage.local.get(['DIEMONIC_ADS_BLOCK_elementsToDelete', 'DIEMONIC_ADS_BLOCK_elementsToCheckDelete',
          'DIEMONIC_ADS_BLOCK_elementsToCheckHide', 'DIEMONIC_ADS_BLOCK_banWords', 'DIEMONIC_ADS_BLOCK_stopWords',
          'DIEMONIC_ADS_BLOCK_elementsToHide'], (result) => {
            window.elementsToDelete = result.DIEMONIC_ADS_BLOCK_elementsToDelete;
            window.elementsToCheckDelete = result.DIEMONIC_ADS_BLOCK_elementsToCheckDelete;
            window.elementsToCheckHide = result.DIEMONIC_ADS_BLOCK_elementsToCheckHide;
            window.banWords = result.DIEMONIC_ADS_BLOCK_banWords;
            window.stopWords = result.DIEMONIC_ADS_BLOCK_stopWords;
            window.elementsToHide = result.DIEMONIC_ADS_BLOCK_elementsToHide;
          });

        chrome.storage.local.set({
          "DIEMONIC_ADS_BLOCK_last_time_update_configs": (new Date()).toString()
        });

        dLog("Скачали конфиги");
      })

      return null;
    })
    .catch(error => console.error('Ошибка:', error))
}

// Local test values: up to 3 extra entries per category, typed directly into the options page
// for local testing without needing to publish/re-download the remote rules file. Stored under
// their own "local_*" keys (separate from the downloaded config) and merged in at match time by
// mergeLocalTestValues() below, so the remote-downloaded cache itself is never touched by them.
const LOCAL_TEST_CATEGORIES = [
  "elementsToDelete",
  "elementsToCheckDelete",
  "elementsToCheckHide",
  "banWords",
  "stopWords",
  "elementsToHide"
];

function loadLocalTestValues() {
  const defaults = {};
  LOCAL_TEST_CATEGORIES.forEach((category) => {
    defaults["DIEMONIC_ADS_BLOCK_local_" + category] = JSON.stringify(["", "", ""]);
  });

  chrome.storage.local.get(defaults, (result) => {
    LOCAL_TEST_CATEGORIES.forEach((category) => {
      window["local_" + category] = result["DIEMONIC_ADS_BLOCK_local_" + category];
    });
  });
}

// Per-rule enable/disable toggles set on the options page (see RULE_TOGGLES_KEY there) - lets
// a single rule be silenced for local testing without editing the downloaded config. Only
// disabled rules are recorded, so anything not in the map is enabled by default. Loaded the same
// lazy, best-effort way as loadLocalTestValues(): a miss on the very first tryDeleteAds() pass
// just means toggles aren't applied yet, corrected on the next pass a moment later.
function loadRuleToggles() {
  chrome.storage.local.get(['DIEMONIC_ADS_BLOCK_rule_toggles'], (result) => {
    try {
      window.DIEMONIC_ADS_BLOCK_ruleToggles = JSON.parse(result.DIEMONIC_ADS_BLOCK_rule_toggles || '{}');
    } catch (e) {
      window.DIEMONIC_ADS_BLOCK_ruleToggles = {};
    }
  });
}

function isRuleToggleOn(category, value) {
  const toggles = window.DIEMONIC_ADS_BLOCK_ruleToggles && window.DIEMONIC_ADS_BLOCK_ruleToggles[category];
  return !(toggles && toggles[value] === false);
}

function filterDisabledRules(category, values) {
  return values.filter((value) => isRuleToggleOn(category, value));
}

function parseLocalTestSlots(localRaw) {
  let localSlots;
  try {
    localSlots = JSON.parse(localRaw || "[]");
  } catch (e) {
    localSlots = [];
  }
  if (!Array.isArray(localSlots)) {
    localSlots = [];
  }
  return localSlots.map((value) => String(value || "").trim()).filter(Boolean);
}

function mergeLocalTestValues(mainValues, localRaw) {
  const merged = mainValues.slice();
  parseLocalTestSlots(localRaw).forEach((trimmed) => {
    if (merged.includes(trimmed)) return; // ignore duplicates of an existing (remote) rule
    merged.push(trimmed);
  });
  return merged;
}

// The 3 local test slots per category aren't toggleable/numbered on the options page, so they
// aren't included in buildRuleEntries()'s indexed rules - this pulls just the extra ones (not
// already present in mainValues) for a separate, unnumbered pass.
function getExtraLocalValues(mainValues, localRaw) {
  const extras = [];
  parseLocalTestSlots(localRaw).forEach((trimmed) => {
    if (mainValues.includes(trimmed) || extras.includes(trimmed)) return;
    extras.push(trimmed);
  });
  return extras;
}

// Builds { selector, label } entries for a selector-based rule category (elementsToDelete,
// elementsToCheckDelete, elementsToCheckHide, elementsToHide). Disabled rules are skipped here
// rather than filtered out of the array beforehand, so each surviving rule keeps its original
// index - matching the #N numbering shown for that rule in the options page's table.
function buildRuleEntries(mainValues, localRaw, category) {
  const entries = [];
  mainValues.forEach((selector, index) => {
    if (!isRuleToggleOn(category, selector)) return;
    entries.push({ selector, label: "группа " + category + ", правило #" + (index + 1) });
  });
  getExtraLocalValues(mainValues, localRaw).forEach((selector) => {
    entries.push({ selector, label: "группа " + category + ", локальное тестовое правило" });
  });
  return entries;
}

function CheckConfigs() {
  let elementsToDelete;
  let elementsToCheckDelete;
  let elementsToCheckHide;
  let banWords;
  let stopWords;
  let elementsToHide;
  chrome.storage.local.get(['DIEMONIC_ADS_BLOCK_elementsToDelete', 'DIEMONIC_ADS_BLOCK_elementsToCheckDelete',
    'DIEMONIC_ADS_BLOCK_elementsToCheckHide', 'DIEMONIC_ADS_BLOCK_banWords', 'DIEMONIC_ADS_BLOCK_stopWords',
    'DIEMONIC_ADS_BLOCK_elementsToHide'], (result) => {
      elementsToDelete = result.DIEMONIC_ADS_BLOCK_elementsToDelete;
      elementsToCheckDelete = result.DIEMONIC_ADS_BLOCK_elementsToCheckDelete;
      elementsToCheckHide = result.DIEMONIC_ADS_BLOCK_elementsToCheckHide;
      banWords = result.DIEMONIC_ADS_BLOCK_banWords;
      stopWords = result.DIEMONIC_ADS_BLOCK_stopWords;
      elementsToHide = result.DIEMONIC_ADS_BLOCK_elementsToHide;

      //#region Default values

      if (elementsToDelete == null || elementsToDelete == undefined) {
        chrome.storage.local.set({
          "DIEMONIC_ADS_BLOCK_elementsToDelete": `
          [
          ".JustifierRowLayout-Incut", 
          ".banner-view",
          "[class*='Card_bottomAdv']", 
          "[class*='DirectFeature']",
          "[class*='AdvMastHead']",
          "[id*='advRsyaReact']", 
          "[class*='AppForecastMoney']", 
          "[class*='topBlockWithMoney']", 
          "[class*='AppMoneySidebar']", 
          "[class*='AppMoney_wrap']"
      ]
      `
        });
      }

      if (elementsToCheckDelete == null || elementsToCheckDelete == undefined) {
        chrome.storage.local.set({
          "DIEMONIC_ADS_BLOCK_elementsToCheckDelete": `
          [
          "[data-testid*='page-layout_right-column_container']",
          "[data-test-id*='page-layout_right-column_container']",
          "[id*='heroBanner']",
          "[id*='cardRecommendationRoll']",
          "[id*='marketfrontRecomLayout42/recomLayoutItem']"
      ]
      `
        });
      }

      if (elementsToCheckHide == null || elementsToCheckHide == undefined) {
        chrome.storage.local.set({
          "DIEMONIC_ADS_BLOCK_elementsToCheckHide": ` [ "[class*='serp-item_card']", "[class*='JustifierColumnLayout-Item']" ] `
        });
      }

      if (banWords == null || banWords == undefined) {
        chrome.storage.local.set({
          "DIEMONIC_ADS_BLOCK_banWords": `[ "practicum.yandex.ru", "skillfactory.ru", "AdvLabel-Text"]`
        });
      }

      if (stopWords == null || stopWords == undefined) {
        chrome.storage.local.set({
          "DIEMONIC_ADS_BLOCK_stopWords": `[ "neuro_answer", "нейро", "futuris_search"]`
        });
      }

      if (elementsToHide == null || elementsToHide == undefined) {
        chrome.storage.local.set({
          "DIEMONIC_ADS_BLOCK_elementsToHide": `[ "[data-auto*='creativeBanner']" ]`
        });
      }

      //#endregion

      if (window.elementsToDelete == null || window.elementsToDelete == undefined) {
        chrome.storage.local.get(['DIEMONIC_ADS_BLOCK_elementsToDelete'], (result) => {
          window.elementsToDelete = result.DIEMONIC_ADS_BLOCK_elementsToDelete;
        });
      }

      if (window.elementsToCheckDelete == null || window.elementsToCheckDelete == undefined) {
        chrome.storage.local.get(['DIEMONIC_ADS_BLOCK_elementsToCheckDelete'], (result) => {
          window.elementsToCheckDelete = result.DIEMONIC_ADS_BLOCK_elementsToCheckDelete;
        });
      }

      if (window.elementsToCheckHide == null || window.elementsToCheckHide == undefined) {
        chrome.storage.local.get(['DIEMONIC_ADS_BLOCK_elementsToCheckHide'], (result) => {
          window.elementsToCheckHide = result.DIEMONIC_ADS_BLOCK_elementsToCheckHide;
        });
      }

      if (window.banWords == null || window.banWords == undefined) {
        chrome.storage.local.get(['DIEMONIC_ADS_BLOCK_banWords'], (result) => {
          window.banWords = result.DIEMONIC_ADS_BLOCK_banWords;
        });
      }

      if (window.stopWords == null || window.stopWords == undefined) {
        chrome.storage.local.get(['DIEMONIC_ADS_BLOCK_stopWords'], (result) => {
          window.stopWords = result.DIEMONIC_ADS_BLOCK_stopWords;
        });
      }

      if (window.elementsToHide == null || window.elementsToHide == undefined) {
        chrome.storage.local.get(['DIEMONIC_ADS_BLOCK_elementsToHide'], (result) => {
          window.elementsToHide = result.DIEMONIC_ADS_BLOCK_elementsToHide;
        });
      }

      loadLocalTestValues();
      loadRuleToggles();

      chrome.storage.local.get(['DIEMONIC_ADS_BLOCK_last_time_update_configs'], (result) => {
        window.DIEMONIC_ADS_BLOCK_last_time_update_configs = result.DIEMONIC_ADS_BLOCK_last_time_update_configs;

        if (window.DIEMONIC_ADS_BLOCK_last_time_update_configs == null
          || window.DIEMONIC_ADS_BLOCK_last_time_update_configs == undefined
          || window.DIEMONIC_ADS_BLOCK_last_time_update_configs == "null") {
          DownloadConfigs();
        }
        else if (isDiffInMinutes(new Date(window.DIEMONIC_ADS_BLOCK_last_time_update_configs), new Date(), 180)) {
          DownloadConfigs();
        }
      });
    });

}

function tryDeleteAds() {
  CheckConfigs();

  if (window.elementsToDelete == undefined) {
    return;
  }

  dLog("Попытка удалить рекламу. Последнее скачивание конфигов: " + window.DIEMONIC_ADS_BLOCK_last_time_update_configs);

  let elementsToDeleteMain, elementsToCheckDeleteMain, elementsToCheckHideMain, elementsToHideMain, banWords, stopWords;
  try {
    elementsToDeleteMain = JSON.parse(window.elementsToDelete);
    elementsToCheckDeleteMain = JSON.parse(window.elementsToCheckDelete);
    elementsToCheckHideMain = JSON.parse(window.elementsToCheckHide);
    elementsToHideMain = JSON.parse(window.elementsToHide);
    // banWords/stopWords are only ever reported by their matched word (not a rule number), so
    // disabled ones are simply filtered out before merging in the local test values.
    banWords = mergeLocalTestValues(filterDisabledRules("banWords", JSON.parse(window.banWords)), window.local_banWords);
    stopWords = mergeLocalTestValues(filterDisabledRules("stopWords", JSON.parse(window.stopWords)), window.local_stopWords);
  } catch (e) {
    dLog("Ошибка разбора конфигов, пропуск прохода: " + e);
    return;
  }

  const elementsToHideEntries = buildRuleEntries(elementsToHideMain, window.local_elementsToHide, "elementsToHide");
  const elementsToDeleteEntries = buildRuleEntries(elementsToDeleteMain, window.local_elementsToDelete, "elementsToDelete");
  const elementsToCheckDeleteEntries = buildRuleEntries(elementsToCheckDeleteMain, window.local_elementsToCheckDelete, "elementsToCheckDelete");
  const elementsToCheckHideEntries = buildRuleEntries(elementsToCheckHideMain, window.local_elementsToCheckHide, "elementsToCheckHide");

  // Collect matches into a Map first (per loop) so an element matched by more than one
  // overlapping selector is only acted on once per pass - whichever rule matched first is the
  // one credited in the log.
  const hideMap = new Map();
  elementsToHideEntries.forEach(({ selector, label }) => {
    document.querySelectorAll(selector).forEach(el => {
      if (!hideMap.has(el)) hideMap.set(el, label);
    });
  });
  hideMap.forEach((label, el) => {
    if (safeHide(el, "elementsToHide")) {
      dLog(label + ": скрыт элемент " + el);
    }
  });

  const deleteMap = new Map();
  elementsToDeleteEntries.forEach(({ selector, label }) => {
    document.querySelectorAll(selector).forEach(el => {
      if (!deleteMap.has(el)) deleteMap.set(el, label);
    });
  });
  deleteMap.forEach((label, el) => {
    if (safeRemove(el, "elementsToDelete")) {
      dLog(label + ": удален элемент " + el);
    }
  });

  // Same selector-matching + banWords/stopWords logic, split by resulting action:
  // elementsToCheckDelete removes the match, elementsToCheckHide only hides it — used for
  // elements inside virtualized/masonry grids (e.g. Yandex Images cards) where physically
  // removing the node can desync the host page's own React tree during scroll and crash it.
  const checkDeleteMap = new Map();
  elementsToCheckDeleteEntries.forEach(({ selector, label }) => {
    document.querySelectorAll(selector).forEach(el => {
      if (!checkDeleteMap.has(el)) checkDeleteMap.set(el, label);
    });
  });
  checkDeleteMap.forEach((label, el) => {
    if (!el.isConnected) return;
    const content = el.innerHTML.toLowerCase();
    if (stopWords.some(word => content.includes(word.toLowerCase()))) return;
    const matchedBanWord = banWords.find(word => content.includes(word.toLowerCase()));
    if (matchedBanWord) {
      if (safeRemove(el, "elementsToCheckDelete")) {
        dLog(label + ", бан-слово \"" + matchedBanWord + "\": удален элемент " + content);
      }
    }
  });

  const checkHideMap = new Map();
  elementsToCheckHideEntries.forEach(({ selector, label }) => {
    document.querySelectorAll(selector).forEach(el => {
      if (!checkHideMap.has(el)) checkHideMap.set(el, label);
    });
  });
  checkHideMap.forEach((label, el) => {
    if (!el.isConnected) return;
    const content = el.innerHTML.toLowerCase();
    if (stopWords.some(word => content.includes(word.toLowerCase()))) return;
    const matchedBanWord = banWords.find(word => content.includes(word.toLowerCase()));
    if (matchedBanWord) {
      if (safeHide(el, "elementsToCheckHide")) {
        dLog(label + ", бан-слово \"" + matchedBanWord + "\": скрыт элемент " + content);
      }
    }
  });
}

let activeSeriesIntervalId = null;

function runTryDeleteAdsSeries() {
  if (window.DIEMONIC_ADS_BLOCK_enabled === false) return;
  // A previous series is still ticking (up to 1.5s) - don't stack a second one on top of it.
  if (activeSeriesIntervalId !== null) return;

  let counter = 0;
  const maxRuns = 5;

  // сразу первый вызов
  tryDeleteAds();

  activeSeriesIntervalId = setInterval(() => {
    counter++;
    tryDeleteAds();

    if (counter >= maxRuns) {
      clearInterval(activeSeriesIntervalId);
      activeSeriesIntervalId = null;
    }
  }, 300);
}

// throttle
function throttle(func, limit) {
  let inThrottle;
  return function (...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

const throttledSeries = throttle(runTryDeleteAdsSeries, 300);

["mousedown", "click", "keydown"].forEach(eventName => {
  document.addEventListener(eventName, throttledSeries, { passive: true, capture: true });
});

// scroll/wheel fire at native frequency, right when a virtualized/masonry grid (e.g. Yandex
// Images) is actively reordering its own DOM - a much coarser throttle plus deferring the
// actual scan to requestAnimationFrame (i.e. right after paint) cuts down how often this
// extension's DOM mutations land mid-frame alongside the host page's own re-render.
const throttledScrollSeries = throttle(() => requestAnimationFrame(runTryDeleteAdsSeries), 1000);

["wheel", "scroll"].forEach(eventName => {
  document.addEventListener(eventName, throttledScrollSeries, { passive: true, capture: true });
});

// Content script runs at document_start, before the page has built its DOM - waiting for a
// user interaction (the listeners above) or the page finishing loading is what made ad
// removal feel slow. Instead, react to the page's own DOM construction as it streams in:
// document.documentElement always exists at document_start, so the observer can attach
// immediately and catch ad elements the moment the page inserts them, well before "load".
// Routed through the same throttled + overlap-guarded runTryDeleteAdsSeries() as everything
// else, so this doesn't add a new, less-safe removal path.
const earlyDomObserver = new MutationObserver(() => {
  throttledSeries();
});
earlyDomObserver.observe(document.documentElement, { childList: true, subtree: true });

loadSettings(() => {
  if (window.DIEMONIC_ADS_BLOCK_enabled) {
    CheckConfigs();
    runTryDeleteAdsSeries();
  }
});
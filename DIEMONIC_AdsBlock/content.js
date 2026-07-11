
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
          "DIEMONIC_ADS_BLOCK_elementsToHide": JSON.stringify(data.elementsToHide ?? [])
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

  let elementsToDelete, elementsToCheckDelete, elementsToCheckHide, banWords, stopWords, elementsToHide;
  try {
    elementsToDelete = JSON.parse(window.elementsToDelete);
    elementsToCheckDelete = JSON.parse(window.elementsToCheckDelete);
    elementsToCheckHide = JSON.parse(window.elementsToCheckHide);
    banWords = JSON.parse(window.banWords);
    stopWords = JSON.parse(window.stopWords);
    elementsToHide = JSON.parse(window.elementsToHide);
  } catch (e) {
    dLog("Ошибка разбора конфигов, пропуск прохода: " + e);
    return;
  }

  // Collect matches into a Set first (per loop) so an element matched by more than one
  // overlapping selector is only acted on once per pass.
  const hideSet = new Set();
  elementsToHide.forEach(element => {
    document.querySelectorAll(element).forEach(el => hideSet.add(el));
  });
  hideSet.forEach(el => {
    if (safeHide(el, "elementsToHide")) {
      dLog("Скрыт элемент " + el);
    }
  });

  const deleteSet = new Set();
  elementsToDelete.forEach(element => {
    document.querySelectorAll(element).forEach(el => deleteSet.add(el));
  });
  deleteSet.forEach(el => {
    if (safeRemove(el, "elementsToDelete")) {
      dLog("Удален элемент " + el);
    }
  });

  // Same selector-matching + banWords/stopWords logic, split by resulting action:
  // elementsToCheckDelete removes the match, elementsToCheckHide only hides it — used for
  // elements inside virtualized/masonry grids (e.g. Yandex Images cards) where physically
  // removing the node can desync the host page's own React tree during scroll and crash it.
  const checkDeleteSet = new Set();
  elementsToCheckDelete.forEach(element => {
    document.querySelectorAll(element).forEach(el => checkDeleteSet.add(el));
  });
  checkDeleteSet.forEach(el => {
    if (!el.isConnected) return;
    const content = el.innerHTML.toLowerCase();
    if (stopWords.some(word => content.includes(word.toLowerCase()))) return;
    if (banWords.some(word => content.includes(word.toLowerCase()))) {
      if (safeRemove(el, "elementsToCheckDelete")) {
        dLog("По правилу поиска (удаление) удален элемент " + content);
      }
    }
  });

  const checkHideSet = new Set();
  elementsToCheckHide.forEach(element => {
    document.querySelectorAll(element).forEach(el => checkHideSet.add(el));
  });
  checkHideSet.forEach(el => {
    if (!el.isConnected) return;
    const content = el.innerHTML.toLowerCase();
    if (stopWords.some(word => content.includes(word.toLowerCase()))) return;
    if (banWords.some(word => content.includes(word.toLowerCase()))) {
      if (safeHide(el, "elementsToCheckHide")) {
        dLog("По правилу поиска (скрытие) скрыт элемент " + content);
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
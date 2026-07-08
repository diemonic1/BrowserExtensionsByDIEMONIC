/*

проверка видосов

https://www.youtube.com/watch?v=qDd7QZViETU
https://www.youtube.com/watch?v=B66v-00Huoc&t=16s
https://www.youtube.com/watch?v=ZtM8Hs2i0Z8&list=PLU0Epqj8vvkBqtUu6PVzXeYPen9WJ8tlZ&index=13
https://www.youtube.com/watch?v=Di6auL8EfaY

*/

// Default settings
const DEFAULT_SETTINGS = {
  showDownloadButton: true,
  showPreviewButton: true,
  protocol: "ytDlpWebExtension://",
  enableLogs: true,
};

let extensionSettings = { ...DEFAULT_SETTINGS };

function dLog(msg) {
  if (!extensionSettings.enableLogs) return;

  console.log(
    "%c🚫[D!EMONIC YouTube Custom Buttons] " + msg,
    "background: #464646b9; color: #ff459cff",
  );
}

const UPDATE_THROTTLE_MS = 500;
const FOLLOW_UP_UPDATES_COUNT = 5;
const FOLLOW_UP_UPDATE_INTERVAL_MS = 1000;

let lastVisibilityUpdateAt = 0;
let throttledVisibilityTimer = null;
let followUpVisibilityTimers = [];

function getThumbnailUrl() {
  const url = new URL(window.location.href);
  const videoId = url.searchParams.get("v");

  if (!videoId) return null;

  // Максимальное качество превью
  return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
}

function logThumbnail() {
  const thumbnail = getThumbnailUrl();
  if (thumbnail) {
    dLog("YouTube thumbnail: " + thumbnail);
  }
}

function onElementReady() {
  document.body.insertAdjacentHTML('beforebegin', `
    <div 
        id="DiemonicYouTubeCustomButtonsContainer"
        class="DiemonicYouTubeCustomButtonsContainer"
      ">
          <div class="DiemonicYouTubeCustomButtonsMove" id="DiemonicYouTubeCustomButtonsMove"></div>
          <div>
            <div class="DiemonicYouTubeCustomButtonsBlock">
              <div class="DiemonicYouTubeCustomButtonsButtonBack">
                  <div id="DiemonicYouTubeCustomButtonsButton" class="DiemonicYouTubeCustomButtonsButton">
                    <img id="DiemonicYouTubeCustomButtonscatPilot" class="DiemonicYouTubeCustomButtonsIcon1" src="/catPilot.ico" alt="">
                    <img id="DiemonicYouTubeCustomButtonsiconDownload" class="DiemonicYouTubeCustomButtonsIcon2" src="/iconDownload.png" alt="">
                  </div>
              </div>
              <div class="DiemonicYouTubeCustomButtonspreviewButtonBack">
                <img id="DiemonicYouTubeCustomButtonsiconPreview" class="iconPreview" src="/iconPreview.png" alt="">
              </div>
            </div>
          </div>
    </div>
  `);

  const buttonBackD = document.querySelector(".DiemonicYouTubeCustomButtonsButtonBack");

  buttonBackD.title = "Скачать видео с помощью: " + extensionSettings.protocol + document.URL;

  if (!extensionSettings.showDownloadButton) {
    if (buttonBackD) {
      buttonBackD.style.display = "none";
    }
  }

  const buttonBack = document.querySelector(".DiemonicYouTubeCustomButtonspreviewButtonBack");

  buttonBack.title = "Открыть превью видео в новой вкладке";

  buttonBack.onclick = () => {
    const thumbnail = getThumbnailUrl();
    window.open(thumbnail, "_blank");
  };

  if (!extensionSettings.showPreviewButton) {
    if (buttonBack) {
      buttonBack.style.display = "none";
    }
  }

  let element = document.getElementById("DiemonicYouTubeCustomButtonsContainer");
  element.style.left = localStorage.getItem("DiemonicYouTubeCustomButtonsX") + 'px';
  element.style.top = localStorage.getItem("DiemonicYouTubeCustomButtonsY") + 'px';

  document.getElementById('DiemonicYouTubeCustomButtonsMove').onmousedown = function (event) {
    let element = document.getElementById('DiemonicYouTubeCustomButtonsContainer');

    moveAt(event.pageX, event.pageY);

    function moveAt(pageX, pageY) {
      element.style.left = pageX + 'px';
      element.style.top = (pageY - 5) + 'px';
    }

    function onMouseMove(event) {
      moveAt(event.pageX, event.pageY);
      window.lastX = event.pageX;
      window.lastY = event.pageY - 5;
    }

    document.addEventListener('mousemove', onMouseMove);

    document.getElementById('DiemonicYouTubeCustomButtonsMove').onmouseup = function () {
      localStorage.setItem("DiemonicYouTubeCustomButtonsX", window.lastX);
      localStorage.setItem("DiemonicYouTubeCustomButtonsY", window.lastY);

      document.removeEventListener('mousemove', onMouseMove);
      document.getElementById('DiemonicYouTubeCustomButtonsMove').onmouseup = null;
    };

  };

  document.getElementById("DiemonicYouTubeCustomButtonsiconDownload").src = chrome.runtime.getURL("iconDownload.png");
  document.getElementById("DiemonicYouTubeCustomButtonsiconPreview").src = chrome.runtime.getURL("iconPreview2.png");
  document.getElementById("DiemonicYouTubeCustomButtonscatPilot").src = chrome.runtime.getURL("catPilot.ico");
  document.getElementById("DiemonicYouTubeCustomButtonsButton").onclick = OpenYtDlp;

  const video = document.querySelector("video");
  if (!video) {
    dLog("[YouTubeCustomButtons] Видео не найдено");
  } else {
    logThumbnail();
  }
}

function OpenYtDlp() {
  dLog("ytDlpWebExtension: открываем ссылку " + document.URL);

  navigator.clipboard
    .writeText(document.URL)
    .then(() => {
      window.open(extensionSettings.protocol + document.URL);
    })
    .catch((err) => {
      dLog("Something went wrong: " + String(err));
    });
}

function isVideoPage() {
  const url = document.URL;
  return url.includes("/watch?");
}

function isFullscreen() {
  const video = document.querySelector("video");
  if (!video) return false;

  // Проверяем через fullscreenElement
  if (document.fullscreenElement === video || document.fullscreenElement === video.parentElement) {
    return true;
  }

  // Проверяем, занимает ли видео 90% и более экрана по ширине и высоте
  const rect = video.getBoundingClientRect();
  const widthPercent = (rect.width / window.innerWidth) * 100;
  const heightPercent = (rect.height / window.innerHeight) * 100;

  dLog(`Видео занимает ${widthPercent.toFixed(2)}% по ширине и ${heightPercent.toFixed(2)}% по высоте экрана`);

  return widthPercent >= 25 && heightPercent >= 90 || widthPercent >= 90;
}

function runUpdateButtonVisibility() {
  const container = document.getElementById("DiemonicYouTubeCustomButtonsContainer");
  const shouldShow = isVideoPage() && !isFullscreen();

  if (shouldShow) {
    if (!container) {
      onElementReady();
    }
  } else {
    if (container) {
      container.remove();
    }
  }
}

function scheduleFollowUpVisibilityUpdates() {
  followUpVisibilityTimers.forEach((timerId) => clearTimeout(timerId));
  followUpVisibilityTimers = [];

  for (let i = 1; i <= FOLLOW_UP_UPDATES_COUNT; i += 1) {
    const timerId = setTimeout(() => {
      updateButtonVisibility(false);
    }, i * FOLLOW_UP_UPDATE_INTERVAL_MS);

    followUpVisibilityTimers.push(timerId);
  }
}

function updateButtonVisibility(scheduleFollowUps = true) {
  const now = Date.now();
  const elapsed = now - lastVisibilityUpdateAt;

  if (elapsed >= UPDATE_THROTTLE_MS) {
    lastVisibilityUpdateAt = now;
    runUpdateButtonVisibility();
  } else if (!throttledVisibilityTimer) {
    throttledVisibilityTimer = setTimeout(() => {
      throttledVisibilityTimer = null;
      lastVisibilityUpdateAt = Date.now();
      runUpdateButtonVisibility();
    }, UPDATE_THROTTLE_MS - elapsed);
  }

  if (scheduleFollowUps) {
    scheduleFollowUpVisibilityUpdates();
  }
}

// Обновляем видимость кнопок по пользовательской активности и fullscreen-событиям
let hasUserActivityListeners = false;

chrome.storage.sync.get(DEFAULT_SETTINGS, (items) => {
  extensionSettings = items;

  function initUserActivityListeners() {
    if (hasUserActivityListeners) return;
    hasUserActivityListeners = true;

    const handleUserActivity = () => {
      updateButtonVisibility();
    };

    window.addEventListener("keydown", handleUserActivity, true);
    window.addEventListener("keyup", handleUserActivity, true);
    window.addEventListener("mousedown", handleUserActivity, true);
    window.addEventListener("mouseup", handleUserActivity, true);
    window.addEventListener("click", handleUserActivity, true);
    window.addEventListener("wheel", handleUserActivity, true);
    document.addEventListener("fullscreenchange", handleUserActivity);
  }

  window.onload = function () {
    updateButtonVisibility();
    initUserActivityListeners();

    // Резервный обработчик для события yt-navigate-finish
    window.addEventListener("yt-navigate-finish", () => {
      updateButtonVisibility();
    });
  };

  // Первоначальная проверка при загрузке скрипта
  updateButtonVisibility();
});


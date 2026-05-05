// Default settings
const DEFAULT_SETTINGS = {
  showDownloadButton: true,
  showPreviewButton: true,
  protocol: "ytDlpWebExtension://",
};

let extensionSettings = { ...DEFAULT_SETTINGS };

function dLog(msg) {
  console.log(
    "%c🚫[D!EMONIC YouTube Custom Buttons] " + msg,
    "background: #464646b9; color: #ff459cff",
  );
}

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
    console.log("[YouTubeCustomButtons] Видео не найдено");
  } else {
    logThumbnail();
  }
}

function OpenYtDlp() {
  console.log("ytDlpWebExtension: открываем ссылку " + document.URL);

  navigator.clipboard
    .writeText(document.URL)
    .then(() => {
      window.open(extensionSettings.protocol + document.URL);
    })
    .catch((err) => {
      console.log("Something went wrong", err);
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

  return widthPercent >= 90 && heightPercent >= 90;
}

function updateButtonVisibility() {
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

// MutationObserver для отслеживания изменений в DOM при навигации YouTube
let mutationObserver;

chrome.storage.sync.get(DEFAULT_SETTINGS, (items) => {
  extensionSettings = items;

  function initMutationObserver() {
    const config = {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["href", "title", "class"],
    };

    mutationObserver = new MutationObserver((mutations) => {
      // Проверяем, изменились ли классы видеоплеера
      const fullscreenChanged = mutations.some(mutation => {
        return mutation.target.classList && mutation.target.classList.contains('html5-video-player');
      });

      if (fullscreenChanged || mutations.some(m => m.type === 'childList')) {
        updateButtonVisibility();
      }
    });

    mutationObserver.observe(document.body, config);
  }

  window.onload = function () {
    updateButtonVisibility();
    initMutationObserver();

    // Резервный обработчик для события yt-navigate-finish
    window.addEventListener("yt-navigate-finish", () => {
      updateButtonVisibility();
    });
  };

  // Первоначальная проверка при загрузке скрипта
  updateButtonVisibility();
});


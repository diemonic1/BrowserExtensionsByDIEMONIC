// Default settings
const DEFAULT_SETTINGS = {
  showDownloadButton: false,
  showPreviewButton: false,
  protocol: 'ytDlpWebExtension://'
};

let extensionSettings = { ...DEFAULT_SETTINGS };

// Load settings from chrome.storage
chrome.storage.sync.get(DEFAULT_SETTINGS, (items) => {
  extensionSettings = items;
});

function dLog(msg) {
  console.log("%c🚫[D!EMONIC YouTubeCustomButtons] " + msg, 'background: #464646b9; color: #ff459cff');
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

function onElementReady(el) {
  var div = document.createElement('div'); // Создаёт блок  

  div.id = "ytDlpWebExtensionContainer";

  if (document.URL.includes("playlist")) {
    div.classList = "ytDlpWebExtensionContainerWithMargin";
  }
  else {
    div.classList = "ytDlpWebExtensionContainer";
  }

  div.innerHTML = `
<div 
      style="
          opacity: 1;
          color: black;
          margin: 0px 9px;
      ">
      <div class="ytDlpWebExtensionBlock">
        <div class="ytDlpWebExtensionButtonBack">
            <div id="ytDlpWebExtensionButton" class="ytDlpWebExtensionButton">
              <img id="catPilot" class="ytDlpWebExtensionIcon1" src="/catPilot.ico" alt="">
              <img id="iconDownload" class="ytDlpWebExtensionIcon2" src="/iconDownload.png" alt="">
            </div>
        </div>
        <div class="previewButtonBack">
          <img id="iconPreview" class="iconPreview" src="/iconPreview.png" alt="">
        </div>
        <div id="ytDlpWebExtensionButtonBackTime" class="ytDlpWebExtensionButtonBackTime">
            <div id="ytDlpWebExtensionButtonBackTimeInner" class="ytDlpWebExtensionButtonBackTimeInner">
              <div id="ytDlpWebExtensionTime" class="ytDlpWebExtensionTime">
                ???
              </div>
              <div id="ytDlpWebExtensionTimeTitleTip" class="ytDlpWebExtensionTimeTitleTip">
              </div>
            </div>
        </div>
      </div>
  </div>`;

  el.appendChild(div);

  if (!extensionSettings.showDownloadButton) {
    const buttonBack = div.querySelector('.ytDlpWebExtensionButtonBack');
    if (buttonBack) {
      buttonBack.style.display = 'none';
    }
  }

  const buttonBack = div.querySelector('.previewButtonBack');

  buttonBack.title = "Открыть превью видео в новой вкладке";

  buttonBack.onclick = () => {
    const thumbnail = getThumbnailUrl();
    window.open(thumbnail, '_blank');
  };

  if (!extensionSettings.showPreviewButton) {
    if (buttonBack) {
      buttonBack.style.display = 'none';
    }
  }

  document.getElementById('iconDownload').src = chrome.runtime.getURL("iconDownload.png");
  document.getElementById('iconPreview').src = chrome.runtime.getURL("iconPreview2.png");
  document.getElementById('catPilot').src = chrome.runtime.getURL("catPilot.ico");
  document.getElementById('ytDlpWebExtensionButton').onclick = OpenYtDlp;

  const video = document.querySelector('video');
  const ytDlpWebExtensionTime = document.getElementById('ytDlpWebExtensionTime');
  const ytDlpWebExtensionButtonBackTime = document.getElementById('ytDlpWebExtensionButtonBackTime');
  const ytDlpWebExtensionTimeTitleTip = document.getElementById('ytDlpWebExtensionTimeTitleTip');

  if (!video) {
    console.log('[YouTubeCustomButtons] Видео не найдено');
  } else {
    logThumbnail();

    let lastTime = 0;

    video.addEventListener('timeupdate', () => {
      const now = performance.now();

      if (now - lastTime < 399) return;
      lastTime = now;

      const current = video.currentTime;
      const duration = video.duration;

      if (current != NaN
        && current != undefined
        && duration != NaN
        && duration != undefined
        && isFinite(duration)
        && duration > 0) {

        const percent = ((current / duration) * 100);
        const percentText = percent.toFixed(1);

        const tipText = percentText + '% просмотрено, ' + formatTime(duration - current) + ' осталось';

        attachTooltip(ytDlpWebExtensionTimeTitleTip, tipText);

        ytDlpWebExtensionButtonBackTime.style.background = `
          conic-gradient(
            #6e6e6eff ${percent}%,
            #2b2827 ${percent}%
          )
        `;

        ytDlpWebExtensionTime.innerText =
          formatTime(current) + ' / ' + formatTime(duration);
      }
      else {
        ytDlpWebExtensionTime.innerText = "???";
      }
    });
  }
}

function attachTooltip(element, text) {
  let tooltip = document.getElementById('custom-tooltip');

  // если тултип уже есть — просто обновим текст
  if (tooltip) {
    tooltip.textContent = text;
  } else {
    tooltip = document.createElement('div');
    tooltip.id = 'custom-tooltip';
    tooltip.textContent = text;

    tooltip.classList += "tooltip";

    document.body.appendChild(tooltip);
  }

  function moveTooltip(e) {
    tooltip.style.left = e.clientX + 15 + 'px';
    tooltip.style.top = e.clientY - 15 + 'px';
  }

  function showTooltip(e) {
    tooltip.textContent = text;
    tooltip.style.opacity = '1';
    moveTooltip(e);
  }

  function hideTooltip() {
    tooltip.style.opacity = '0';
  }

  element.addEventListener('mouseenter', showTooltip);
  element.addEventListener('mousemove', moveTooltip);
  element.addEventListener('mouseleave', hideTooltip);
}

function OpenYtDlp() {
  console.log("ytDlpWebExtension: открываем ссылку " + document.URL);

  navigator.clipboard.writeText(document.URL)
    .then(() => {
      window.open(extensionSettings.protocol + document.URL);
    })
    .catch(err => {
      console.log('Something went wrong', err);
    });
}

const formatTime = (t) => {
  const total = Math.floor(t); // убираем дробную часть

  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;

  return h > 0
    ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
    : `${m}:${s.toString().padStart(2, '0')}`;
};

PlatformLoop();

window.onload = function () {
  PlatformLoop();

  window.addEventListener('yt-navigate-finish', () => {
    PlatformLoop();
  });
};


function PlatformLoop() {
  if (document.getElementById("ytDlpWebExtensionContainer")) {
    document.getElementById("ytDlpWebExtensionContainer").remove();
  }

  let el = undefined;

  if (document.URL.includes("playlist")) {
    el = document.querySelector(".yt-page-header-view-model__scroll-container");
  }
  else {
    el = document.getElementById("owner");
  }

  if (el) {
    onElementReady(el);
  }
  else {
    setTimeout(function () {
      PlatformLoop();
    }, 1);
  }
}
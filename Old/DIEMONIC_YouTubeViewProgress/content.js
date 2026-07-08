function dLog(msg) {
  console.log(
    "%c🚫[D!EMONIC YouTube View Progress] " + msg,
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

function onElementReady(el) {
  var div = document.createElement("div"); // Создаёт блок

  div.id = "diemonic_youtube_viewProgress";

  if (document.URL.includes("playlist")) {
    div.classList = "diemonic_youtube_viewProgressContainerWithMargin";
  } else {
    div.classList = "diemonic_youtube_viewProgressContainer";
  }

  div.innerHTML = `
    <div 
        style="
            opacity: 1;
            color: black;
            margin: 0px 9px;
        ">
        <div class="diemonic_youtube_viewProgressBlock">
          <div id="diemonic_youtube_viewProgressButtonBackTime" class="diemonic_youtube_viewProgressButtonBackTime">
              <div id="diemonic_youtube_viewProgressButtonBackTimeInner" class="diemonic_youtube_viewProgressButtonBackTimeInner">
                <div id="diemonic_youtube_viewProgressTime" class="diemonic_youtube_viewProgressTime">
                  ???
                </div>
                <div id="diemonic_youtube_viewProgressTimeTitleTip" class="diemonic_youtube_viewProgressTimeTitleTip">
                </div>
              </div>
          </div>
        </div>
    </div>`;

  el.appendChild(div);

  const video = document.querySelector("video");
  const diemonic_youtube_viewProgressTime = document.getElementById(
    "diemonic_youtube_viewProgressTime",
  );
  const diemonic_youtube_viewProgressButtonBackTime = document.getElementById(
    "diemonic_youtube_viewProgressButtonBackTime",
  );
  const diemonic_youtube_viewProgressTimeTitleTip = document.getElementById(
    "diemonic_youtube_viewProgressTimeTitleTip",
  );

  if (!video) {
    console.log("[diemonic_youtube_viewProgress] Видео не найдено");
  } else {
    logThumbnail();

    let lastTime = 0;

    video.addEventListener("timeupdate", () => {
      const now = performance.now();

      if (now - lastTime < 399) return;
      lastTime = now;

      const current = video.currentTime;
      const duration = video.duration;

      if (
        current != NaN &&
        current != undefined &&
        duration != NaN &&
        duration != undefined &&
        isFinite(duration) &&
        duration > 0
      ) {
        const percent = (current / duration) * 100;
        const percentText = percent.toFixed(1);

        const tipText =
          percentText +
          "% просмотрено, " +
          formatTime(duration - current) +
          " осталось";

        attachTooltip(diemonic_youtube_viewProgressTimeTitleTip, tipText);

        diemonic_youtube_viewProgressButtonBackTime.style.background = `
          conic-gradient(
            #6e6e6eff ${percent}%,
            #2b2827 ${percent}%
          )
        `;

        diemonic_youtube_viewProgressTime.innerText =
          formatTime(current) + " / " + formatTime(duration);
      } else {
        diemonic_youtube_viewProgressTime.innerText = "???";
      }
    });
  }
}

function attachTooltip(element, text) {
  let tooltip = document.getElementById("custom-tooltip");

  if (!tooltip) {
    tooltip = document.createElement("div");
    tooltip.id = "custom-tooltip";
    tooltip.classList += "tooltip";
    document.body.appendChild(tooltip);
  }

  // обновляем текст через data-атрибут, чтобы слушатели читали свежее значение
  element.dataset.tooltipText = text;

  tooltip.textContent = element.dataset.tooltipText;

  // добавляем слушатели только один раз
  if (element.dataset.tooltipBound) return;
  element.dataset.tooltipBound = "1";

  element.addEventListener("mouseenter", (e) => {
    tooltip.textContent = element.dataset.tooltipText;
    tooltip.style.left = e.clientX + 15 + "px";
    tooltip.style.top = e.clientY - 35 + "px";
    tooltip.style.opacity = "1";
  });
  element.addEventListener("mousemove", (e) => {
    tooltip.textContent = element.dataset.tooltipText;
    tooltip.style.left = e.clientX + 15 + "px";
    tooltip.style.top = e.clientY - 35 + "px";
  });
  element.addEventListener("mouseleave", () => {
    tooltip.style.opacity = "0";
  });
}

const formatTime = (t) => {
  const total = Math.floor(t); // убираем дробную часть

  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;

  return h > 0
    ? `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
    : `${m}:${s.toString().padStart(2, "0")}`;
};

function removeViewProgress() {
  const container = document.getElementById("diemonic_youtube_viewProgress");

  if (container) {
    container.remove();
  }
}

function isVideoPage() {
  const url = document.URL;
  return url.includes("/watch?");
}

function getMountElement() {
  if (!isVideoPage()) {
    return null;
  }

  if (window.location.pathname === "/playlist") {
    return document.querySelector(".yt-page-header-view-model__scroll-container");
  }

  return document.getElementById("owner");
}

function updateViewProgress() {
  const mountElement = getMountElement();
  const container = document.getElementById("diemonic_youtube_viewProgress");

  if (!isVideoPage()) {
    removeViewProgress();
    return;
  }

  if (!mountElement) {
    return;
  }

  if (container && container.parentElement === mountElement) {
    return;
  }

  removeViewProgress();
  onElementReady(mountElement);
}

let mutationObserver;

function initMutationObserver() {
  if (mutationObserver || !document.body) {
    return;
  }

  mutationObserver = new MutationObserver(() => {
    updateViewProgress();
  });

  mutationObserver.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["href", "title"],
  });
}

updateViewProgress();

window.onload = function () {
  updateViewProgress();
  initMutationObserver();

  window.addEventListener("yt-navigate-finish", () => {
    updateViewProgress();
  });
};

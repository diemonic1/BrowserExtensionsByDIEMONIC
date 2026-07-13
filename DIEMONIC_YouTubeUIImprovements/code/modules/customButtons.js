(function () {
    window.__diemonicYT = window.__diemonicYT || {};

    const UPDATE_THROTTLE_MS = 500;
    const FOLLOW_UP_UPDATES_COUNT = 5;
    const FOLLOW_UP_UPDATE_INTERVAL_MS = 1000;

    let extensionSettings = null;
    let lastVisibilityUpdateAt = 0;
    let throttledVisibilityTimer = null;
    let followUpVisibilityTimers = [];
    let hasUserActivityListeners = false;

    function getThumbnailUrl() {
        const url = new URL(window.location.href);
        const videoId = url.searchParams.get("v");

        if (!videoId) return null;

        return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
    }

    function logThumbnail() {
        const thumbnail = getThumbnailUrl();
        if (thumbnail) {
            window.__diemonicYT.log(chrome.i18n.getMessage("thumbnailLog", [thumbnail]));
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
                        <img id="DiemonicYouTubeCustomButtonscatPilot" class="DiemonicYouTubeCustomButtonsIcon1" src="/CatPilot.ico" alt="">
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

        buttonBackD.title = chrome.i18n.getMessage("downloadTooltip", [extensionSettings.protocol + document.URL]);

        if (!extensionSettings.showDownloadButton) {
            if (buttonBackD) {
                buttonBackD.style.display = "none";
            }
        }

        const buttonBack = document.querySelector(".DiemonicYouTubeCustomButtonspreviewButtonBack");

        buttonBack.title = chrome.i18n.getMessage("previewTooltip");

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

        document.getElementById("DiemonicYouTubeCustomButtonsiconDownload").src = chrome.runtime.getURL("assets/iconDownload.png");
        document.getElementById("DiemonicYouTubeCustomButtonsiconPreview").src = chrome.runtime.getURL("assets/iconPreview2.png");
        document.getElementById("DiemonicYouTubeCustomButtonscatPilot").src = chrome.runtime.getURL("assets/CatPilot.ico");
        document.getElementById("DiemonicYouTubeCustomButtonsButton").onclick = OpenYtDlp;

        const video = document.querySelector("video");
        if (!video) {
            window.__diemonicYT.log(chrome.i18n.getMessage("videoNotFoundLog"));
        } else {
            logThumbnail();
        }
    }

    function OpenYtDlp() {
        window.__diemonicYT.log(chrome.i18n.getMessage("openingDownloadLinkLog", [document.URL]));

        navigator.clipboard
            .writeText(document.URL)
            .then(() => {
                window.open(extensionSettings.protocol + document.URL);
            })
            .catch((err) => {
                window.__diemonicYT.log(chrome.i18n.getMessage("downloadErrorLog", [String(err)]));
            });
    }

    function isVideoPage() {
        const url = document.URL;
        return url.includes("/watch?");
    }

    function isFullscreen() {
        const video = document.querySelector("video");
        if (!video) return false;

        if (document.fullscreenElement === video || document.fullscreenElement === video.parentElement) {
            return true;
        }

        const rect = video.getBoundingClientRect();
        const widthPercent = (rect.width / window.innerWidth) * 100;
        const heightPercent = (rect.height / window.innerHeight) * 100;

        window.__diemonicYT.log(chrome.i18n.getMessage("fullscreenPercentLog", [widthPercent.toFixed(2), heightPercent.toFixed(2)]));

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

    function init(settings) {
        extensionSettings = settings;

        // addEventListener (not window.onload=) so the other merged modules' load handlers aren't clobbered
        window.addEventListener("load", () => {
            updateButtonVisibility();
            initUserActivityListeners();

            window.addEventListener("yt-navigate-finish", () => {
                updateButtonVisibility();
            });
        });

        updateButtonVisibility();
    }

    window.__diemonicYT.customButtons = { init };
})();

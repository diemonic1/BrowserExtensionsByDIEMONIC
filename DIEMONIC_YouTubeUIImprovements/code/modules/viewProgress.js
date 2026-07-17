(function () {
    window.__diemonicYT = window.__diemonicYT || {};

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
            window.__diemonicYT.log(chrome.i18n.getMessage("thumbnailLog", [thumbnail]));
        }
    }

    function onElementReady(el) {
        var div = document.createElement("div");
        div.id = "diemonic_youtube_viewProgress";

        if (document.URL.includes("playlist")) {
            div.classList = "diemonic_youtube_viewProgressContainerWithMargin";
        } else {
            div.classList = "diemonic_youtube_viewProgressContainer";
        }

        div.innerHTML = `
      <div style="opacity: 1; color: black; margin: 0px 9px;">
          <div class="diemonic_youtube_viewProgressBlock">
            <div id="diemonic_youtube_viewProgressButtonBackTime" class="diemonic_youtube_viewProgressButtonBackTime">
                <div id="diemonic_youtube_viewProgressButtonBackTimeInner" class="diemonic_youtube_viewProgressButtonBackTimeInner">
                  <div id="diemonic_youtube_viewProgressTime" class="diemonic_youtube_viewProgressTime">???</div>
                  <div id="diemonic_youtube_viewProgressTimeTitleTip" class="diemonic_youtube_viewProgressTimeTitleTip"></div>
                </div>
            </div>
          </div>
      </div>`;

        el.appendChild(div);

        bindVideoProgress();
    }

    // Tracks which <video> + label-container pair the timeupdate listener is currently attached
    // to, so a stale listener never lingers on the wrong (removed) container.
    let boundVideo = null;
    let boundTimeEl = null;
    let boundVideoListener = null;

    function unbindVideoProgress() {
        if (boundVideo && boundVideoListener) {
            boundVideo.removeEventListener("timeupdate", boundVideoListener);
        }
        boundVideo = null;
        boundTimeEl = null;
        boundVideoListener = null;
    }

    // Idempotent: safe to call repeatedly. The video element isn't always present yet at the
    // moment the label's container gets mounted (YouTube can render the "owner" row before the
    // player itself exists), so this is re-invoked on every updateViewProgress() pass until a
    // <video> shows up and the listener actually gets attached.
    //
    // YouTube also periodically rebuilds the "owner" row's own contents on its own (e.g. when a
    // subscribe-button/member-badge state changes), which silently discards whatever container we
    // previously injected into it - a fresh one then gets created by onElementReady(). Gating on
    // "have we ever bound to this <video> before" (as this used to) meant that very first rebuild
    // permanently orphaned the label, since the old flag blocked ever rebinding again to the new
    // container. Comparing against the *current* timeEl instance instead means a freshly recreated
    // container is correctly detected and rebound to.
    function bindVideoProgress() {
        const video = document.querySelector("video");
        const timeEl = document.getElementById("diemonic_youtube_viewProgressTime");
        const backTimeEl = document.getElementById("diemonic_youtube_viewProgressButtonBackTime");
        const tipEl = document.getElementById("diemonic_youtube_viewProgressTimeTitleTip");

        if (!video || !timeEl || !backTimeEl || !tipEl) {
            return;
        }

        if (boundVideo === video && boundTimeEl === timeEl) {
            return;
        }

        unbindVideoProgress();
        cancelMountWatch();
        logThumbnail();

        boundVideo = video;
        boundTimeEl = timeEl;
        let lastTime = 0;

        boundVideoListener = () => {
            const now = performance.now();
            if (now - lastTime < 399) return;
            lastTime = now;

            const current = video.currentTime;
            const duration = video.duration;

            if (
                current != NaN && current != undefined &&
                duration != NaN && duration != undefined &&
                isFinite(duration) && duration > 0
            ) {
                const percent = (current / duration) * 100;
                const percentText = percent.toFixed(1);

                const tipText = chrome.i18n.getMessage("progressTooltip", [percentText, formatTime(duration - current)]);
                attachTooltip(tipEl, tipText);

                backTimeEl.style.background = `
            conic-gradient(#6e6e6eff ${percent}%, #2b2827 ${percent}%)
          `;

                timeEl.innerText = formatTime(current) + " / " + formatTime(duration);
            } else {
                timeEl.innerText = "???";
            }
        };

        video.addEventListener("timeupdate", boundVideoListener);
    }

    function attachTooltip(element, text) {
        let tooltip = document.getElementById("custom-tooltip");

        if (!tooltip) {
            tooltip = document.createElement("div");
            tooltip.id = "custom-tooltip";
            tooltip.classList += "tooltip";
            document.body.appendChild(tooltip);
        }

        element.dataset.tooltipText = text;
        tooltip.textContent = element.dataset.tooltipText;

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
        const total = Math.floor(t);
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

    // How long to wait, after landing on a video page, before treating "still not mounted" as a
    // genuine failure worth an error log rather than just "YouTube hasn't finished rendering yet".
    const MOUNT_WATCH_TIMEOUT_MS = 8000;
    let mountWatchTimeoutId = null;
    let mountWatchUrl = null;

    function cancelMountWatch() {
        if (mountWatchTimeoutId) {
            clearTimeout(mountWatchTimeoutId);
            mountWatchTimeoutId = null;
        }
    }

    function resetMountWatch() {
        cancelMountWatch();
        mountWatchTimeoutId = setTimeout(reportMountFailureIfAny, MOUNT_WATCH_TIMEOUT_MS);
    }

    function reportMountFailureIfAny() {
        mountWatchTimeoutId = null;

        if (!isVideoPage()) {
            return;
        }

        const video = document.querySelector("video");
        if (video && boundVideo === video && boundTimeEl === document.getElementById("diemonic_youtube_viewProgressTime")) {
            return;
        }

        const reasons = [];
        const mountElement = getMountElement();
        const isPlaylist = window.location.pathname === "/playlist";

        if (!mountElement) {
            reasons.push(chrome.i18n.getMessage(
                isPlaylist ? "progressReasonNoAnchorPlaylist" : "progressReasonNoAnchor"
            ));
        }

        if (!video) {
            reasons.push(chrome.i18n.getMessage("progressReasonNoVideo"));
        } else if (!document.getElementById("diemonic_youtube_viewProgressTime")) {
            reasons.push(chrome.i18n.getMessage("progressReasonNoContainer"));
        }

        if (!reasons.length) {
            reasons.push(chrome.i18n.getMessage("progressReasonUnknown"));
        }

        window.__diemonicYT.logError(chrome.i18n.getMessage("progressMountFailedLog", [
            document.URL,
            reasons.join("; "),
        ]));
    }

    function updateViewProgress() {
        const mountElement = getMountElement();
        const container = document.getElementById("diemonic_youtube_viewProgress");

        if (!isVideoPage()) {
            removeViewProgress();
            unbindVideoProgress();
            cancelMountWatch();
            mountWatchUrl = null;
            return;
        }

        if (document.URL !== mountWatchUrl) {
            mountWatchUrl = document.URL;
            resetMountWatch();
        }

        if (!mountElement) {
            return;
        }

        if (container && container.parentElement === mountElement) {
            bindVideoProgress();
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

    function init() {
        updateViewProgress();

        window.addEventListener("load", () => {
            updateViewProgress();
            initMutationObserver();

            window.addEventListener("yt-navigate-finish", () => {
                updateViewProgress();
            });
        });
    }

    window.__diemonicYT.viewProgress = { init };
})();

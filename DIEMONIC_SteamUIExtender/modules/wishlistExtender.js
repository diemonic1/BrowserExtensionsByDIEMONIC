(function () {
    function isSteamWishlistPage() {
        return /^https:\/\/store\.steampowered\.com\/wishlist\//.test(window.location.href);
    }

    function getSteamAppIdFromHref(href) {
        const match = href.match(/^https:\/\/store\.steampowered\.com\/app\/(\d+)(?:\/|$|[?#])/);
        return match ? match[1] : null;
    }

    function hasSpawnedDiv(appId) {
        return Boolean(document.getElementById(`diemonic-custom-label-${appId}`));
    }

    function dLog(msg) {
        console.log(
            "%c🚫[" + chrome.i18n.getMessage("extName") + "] " + msg,
            "background: #464646b9; color: #ff459cff",
        );
    }

    const PROGRESS_ROOT_ID = 'diemonic-progress-root';
    const PROGRESS_BAR_ID = 'diemonic-progress-bar';
    const PROGRESS_TEXT_ID = 'diemonic-progress-text';
    let progressUIDisabled = false;

    function ensureProgressUI() {
        if (progressUIDisabled || !isSteamWishlistPage() || document.getElementById(PROGRESS_ROOT_ID)) {
            return;
        }

        const mount = () => {
            if (document.getElementById(PROGRESS_ROOT_ID)) {
                return;
            }

            const root = document.body || document.documentElement;
            if (!root) {
                requestAnimationFrame(mount);
                return;
            }

            const wrapper = document.createElement('div');
            wrapper.id = PROGRESS_ROOT_ID;

            const text = document.createElement('div');
            text.id = PROGRESS_TEXT_ID;
            text.textContent = chrome.i18n.getMessage("progressWaitingLabel");

            const track = document.createElement('div');
            track.className = 'diemonic-progress-track';

            const bar = document.createElement('div');
            bar.id = PROGRESS_BAR_ID;
            bar.className = 'diemonic-progress-fill';
            bar.style.width = '0%';

            track.appendChild(bar);
            wrapper.appendChild(text);
            wrapper.appendChild(track);
            root.appendChild(wrapper);
        };

        mount();
    }

    function destroyProgressUI() {
        const root = document.getElementById(PROGRESS_ROOT_ID);
        if (root) {
            root.remove();
        }
        progressUIDisabled = true;
    }

    function updateProgressUI(completed, total, statusText) {
        if (progressUIDisabled) {
            return;
        }

        ensureProgressUI();

        const bar = document.getElementById(PROGRESS_BAR_ID);
        const text = document.getElementById(PROGRESS_TEXT_ID);
        if (!bar || !text) {
            return;
        }

        const percent = total <= 0 ? 100 : Math.min(100, Math.round((completed / total) * 100));
        bar.style.width = `${percent}%`;
        text.textContent = `${statusText} ${completed}/${total} (${percent}%)`;
    }

    function getNormalizedParentText(parent) {
        const parts = [];
        const walker = document.createTreeWalker(parent, NodeFilter.SHOW_TEXT);

        let current = walker.nextNode();
        while (current) {
            const chunk = (current.nodeValue || '').replace(/\s+/g, ' ').trim();
            if (chunk) {
                parts.push(chunk);
            }
            current = walker.nextNode();
        }

        return parts.join(' ');
    }

    const MONTH_NAME_INDEX = {
        jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
        jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
    };

    function buildValidDate(year, month0, day) {
        const parsedDate = new Date(year, month0, day);
        if (
            Number.isNaN(parsedDate.getTime()) ||
            parsedDate.getFullYear() !== year ||
            parsedDate.getMonth() !== month0 ||
            parsedDate.getDate() !== day
        ) {
            return null;
        }

        return parsedDate;
    }

    // "Date added" labels are stripped first so the row's OTHER date (the release date) is
    // the one left over to parse. Russian Steam UI is tried first (existing behavior), then a
    // few alternative label/date formats for English (and other latin-script) Steam UIs.
    const ADDED_DATE_LABEL_PATTERNS = [
        /дата\s*добавления\s*:\s*\d{2}\.\d{2}\.\d{4}/ig,
        /date\s*added\s*:?\s*\d{1,2}\/\d{1,2}\/\d{4}/ig,
        /date\s*added\s*:?\s*[a-z]{3,9}\s+\d{1,2},?\s+\d{4}/ig,
        /date\s*added\s*:?\s*\d{1,2}\s+[a-z]{3,9},?\s+\d{4}/ig,
        /added\s*on\s*:?\s*[a-z]{3,9}\s+\d{1,2},?\s+\d{4}/ig,
        /added\s*on\s*:?\s*\d{1,2}\s+[a-z]{3,9},?\s+\d{4}/ig,
    ];

    const DATE_EXTRACTORS = [
        // dd.mm.yyyy (Russian/European numeric, original behavior)
        {
            re: /\b(\d{2})\.(\d{2})\.(\d{4})\b/,
            build: (m) => buildValidDate(Number(m[3]), Number(m[2]) - 1, Number(m[1])),
        },
        // mm/dd/yyyy (US numeric)
        {
            re: /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/,
            build: (m) => buildValidDate(Number(m[3]), Number(m[1]) - 1, Number(m[2])),
        },
        // "Jun 21, 2024" / "June 21 2024"
        {
            re: /\b([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{4})\b/,
            build: (m) => {
                const month0 = MONTH_NAME_INDEX[m[1].toLowerCase().slice(0, 3)];
                return month0 === undefined ? null : buildValidDate(Number(m[3]), month0, Number(m[2]));
            },
        },
        // "21 Jun, 2024" / "21 June 2024"
        {
            re: /\b(\d{1,2})\s+([A-Za-z]{3,9}),?\s+(\d{4})\b/,
            build: (m) => {
                const month0 = MONTH_NAME_INDEX[m[2].toLowerCase().slice(0, 3)];
                return month0 === undefined ? null : buildValidDate(Number(m[3]), month0, Number(m[1]));
            },
        },
    ];

    function parseParentDate(parent) {
        const text = getNormalizedParentText(parent);

        let withoutAddedDate = text;
        ADDED_DATE_LABEL_PATTERNS.forEach((pattern) => {
            withoutAddedDate = withoutAddedDate.replace(pattern, ' ');
        });

        for (const extractor of DATE_EXTRACTORS) {
            const match = withoutAddedDate.match(extractor.re);
            if (!match) {
                continue;
            }

            const parsedDate = extractor.build(match);
            if (parsedDate) {
                return parsedDate;
            }
        }

        return null;
    }

    function isPastOrTodayDate(dateValue) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const normalized = new Date(dateValue);
        normalized.setHours(0, 0, 0, 0);

        return normalized.getTime() <= today.getTime();
    }

    const earlyAccessCache = new Map();
    const earlyAccessRequestCache = new Map();

    async function isEarlyAccessByApi(appId) {
        if (earlyAccessCache.has(appId)) {
            return earlyAccessCache.get(appId);
        }

        if (earlyAccessRequestCache.has(appId)) {
            return earlyAccessRequestCache.get(appId);
        }

        const requestPromise = fetch(`https://store.steampowered.com/api/appdetails?appids=${appId}&l=english`)
            .then((response) => {
                if (!response.ok) {
                    return false;
                }

                return response.json();
            })
            .then((json) => {
                const hasEarlyAccess = JSON.stringify(json).includes('Early Access');
                earlyAccessCache.set(appId, hasEarlyAccess);
                return hasEarlyAccess;
            })
            .catch(() => {
                earlyAccessCache.set(appId, false);
                return false;
            })
            .finally(() => {
                earlyAccessRequestCache.delete(appId);
            });

        earlyAccessRequestCache.set(appId, requestPromise);
        return requestPromise;
    }

    async function addTestDivForUniqueAppLinks() {
        const links = document.querySelectorAll('a[href^="https://store.steampowered.com/app/"]');
        const uniqueLinks = new Map();

        for (const link of links) {
            const appId = getSteamAppIdFromHref(link.href);
            if (!appId || hasSpawnedDiv(appId) || uniqueLinks.has(appId)) {
                continue;
            }

            uniqueLinks.set(appId, link);
        }

        const tasks = [];
        for (const [appId, link] of uniqueLinks) {
            const parent = link.parentElement;
            if (!parent) {
                continue;
            }

            const parentDate = parseParentDate(parent);
            if (!parentDate || !isPastOrTodayDate(parentDate)) {
                continue;
            }

            tasks.push({ appId, link, parent });
        }

        const totalTasks = tasks.length;
        if (totalTasks === 0) {
            updateProgressUI(0, 0, chrome.i18n.getMessage("progressNoGamesLabel"));
            return;
        }

        let completedTasks = 0;
        updateProgressUI(completedTasks, totalTasks, chrome.i18n.getMessage("progressProcessingLabel"));

        for (const task of tasks) {
            const { appId, link, parent } = task;

            const isEarlyAccess = await isEarlyAccessByApi(appId);
            if (!isEarlyAccess || hasSpawnedDiv(appId)) {
                completedTasks += 1;
                updateProgressUI(completedTasks, totalTasks, chrome.i18n.getMessage("progressProcessingLabel"));
                continue;
            }

            const actualParent = link.parentElement || parent;
            if (!actualParent) {
                completedTasks += 1;
                updateProgressUI(completedTasks, totalTasks, chrome.i18n.getMessage("progressProcessingLabel"));
                continue;
            }

            const div = document.createElement('div');
            div.className = 'diemonic-custom-label-div';
            div.textContent = chrome.i18n.getMessage("earlyAccessLabel");
            div.title = chrome.i18n.getMessage("openNewsTooltip");
            div.id = `diemonic-custom-label-${appId}`;
            div.dataset.steamAppId = appId;
            div.addEventListener('click', () => {
                window.open(`https://store.steampowered.com/news/app/${appId}`, '_blank');
            });

            actualParent.appendChild(div);

            const grandParent = actualParent.parentElement.parentElement;
            if (grandParent) {
                grandParent.appendChild(actualParent.parentElement);
                dLog(chrome.i18n.getMessage("movedElementLog", [appId]));
            }

            completedTasks += 1;
            updateProgressUI(
                completedTasks,
                totalTasks,
                completedTasks === totalTasks ? chrome.i18n.getMessage("progressDoneLabel") : chrome.i18n.getMessage("progressProcessingLabel")
            );
        }
    }

    let processingScheduled = false;
    let observerStarted = false;
    let processingInProgress = false;
    let rerunRequested = false;

    async function runProcessingQueue() {
        if (processingInProgress) {
            rerunRequested = true;
            return;
        }

        processingInProgress = true;
        do {
            rerunRequested = false;
            await addTestDivForUniqueAppLinks();
        } while (rerunRequested);

        processingInProgress = false;
        destroyProgressUI();
    }

    function scheduleAddTestDivs() {
        if (processingScheduled) {
            return;
        }

        processingScheduled = true;
        requestAnimationFrame(() => {
            processingScheduled = false;
            runProcessingQueue();
        });
    }

    function startWishlistObserver() {
        if (observerStarted || !document.body) {
            return;
        }

        const observer = new MutationObserver((mutations) => {
            const hasRelevantChanges = mutations.some((mutation) => mutation.addedNodes.length > 0 || mutation.removedNodes.length > 0);
            if (hasRelevantChanges) {
                scheduleAddTestDivs();
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        observerStarted = true;
    }

    function init() {
        if (!isSteamWishlistPage()) {
            return;
        }

        ensureProgressUI();
        scheduleAddTestDivs();
        startWishlistObserver();
    }

    chrome.storage.sync.get({ moduleWishlistExtenderEnabled: true }, (settings) => {
        if (!settings.moduleWishlistExtenderEnabled) return;

        if (isSteamWishlistPage()) {
            ensureProgressUI();
        }

        if (document.readyState === 'complete') {
            init();
        } else {
            window.addEventListener('load', init, { once: true });
        }
    });
})();

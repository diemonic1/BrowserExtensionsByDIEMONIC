function isSteamWishlistPage() {
    return /^https:\/\/store\.steampowered\.com\/wishlist\//.test(window.location.href);
}

function getSteamAppIdFromHref(href) {
    const match = href.match(/^https:\/\/store\.steampowered\.com\/app\/(\d+)(?:\/|$|[?#])/);
    return match ? match[1] : null;
}

function hasSpawnedDiv(appId) {
    return Boolean(
        document.getElementById(`diemonic-custom-label-${appId}`) ||
        document.getElementById(`тест_${appId}`)
    );
}

function dLog(msg) {
    console.log(
        "%c🚫[D!EMONIC Steam Wishlist Extender] " + msg,
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
        text.textContent = 'Ожидание данных...';

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

function parseParentDate(parent) {
    const text = getNormalizedParentText(parent);
    const withoutAddedDate = text.replace(/дата\s*добавления\s*:\s*\d{2}\.\d{2}\.\d{4}/ig, ' ');
    const dateMatch = withoutAddedDate.match(/\b(\d{2})\.(\d{2})\.(\d{4})\b/);
    if (!dateMatch) {
        return null;
    }

    const day = Number(dateMatch[1]);
    const month = Number(dateMatch[2]);
    const year = Number(dateMatch[3]);
    const parsedDate = new Date(year, month - 1, day);

    if (
        Number.isNaN(parsedDate.getTime()) ||
        parsedDate.getFullYear() !== year ||
        parsedDate.getMonth() !== month - 1 ||
        parsedDate.getDate() !== day
    ) {
        return null;
    }

    return parsedDate;
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
        updateProgressUI(0, 0, 'Нет подходящих игр');
        return;
    }

    let completedTasks = 0;
    updateProgressUI(completedTasks, totalTasks, 'Обработка');

    for (const task of tasks) {
        const { appId, link, parent } = task;

        const isEarlyAccess = await isEarlyAccessByApi(appId);
        if (!isEarlyAccess || hasSpawnedDiv(appId)) {
            completedTasks += 1;
            updateProgressUI(completedTasks, totalTasks, 'Обработка');
            continue;
        }

        const actualParent = link.parentElement || parent;
        if (!actualParent) {
            completedTasks += 1;
            updateProgressUI(completedTasks, totalTasks, 'Обработка');
            continue;
        }

        const div = document.createElement('div');
        div.className = 'diemonic-custom-label-div';
        div.textContent = 'Ранний доступ';
        div.title = 'Открыть список новостей';
        div.id = `diemonic-custom-label-${appId}`;
        div.dataset.steamAppId = appId;
        div.addEventListener('click', () => {
            window.open(`https://store.steampowered.com/news/app/${appId}`, '_blank');
        });

        actualParent.appendChild(div);

        const grandParent = actualParent.parentElement.parentElement.parentElement;
        if (grandParent) {
            grandParent.appendChild(actualParent.parentElement.parentElement);
            dLog(`Moved element down: appId ${appId}`);
        }

        completedTasks += 1;
        updateProgressUI(completedTasks, totalTasks, completedTasks === totalTasks ? 'Готово' : 'Обработка');
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

if (isSteamWishlistPage()) {
    ensureProgressUI();
}

if (document.readyState === 'complete') {
    init();
} else {
    window.addEventListener('load', init, { once: true });
}

// Chrome runs this as a service worker; Firefox loads it as an event page with matcher.js already included.
if (typeof importScripts === 'function') {
    importScripts('matcher.js');
}

// Tabs without a URL yet may still be about to navigate somewhere, so they get a bit more time.
const CHECK_DELAY_MS = 150;
const EMPTY_URL_CHECK_DELAY_MS = 500;

const pendingChecks = new Map();

chrome.tabs.onCreated.addListener((tab) => {
    scheduleCheck(tab.id, getTabUrl(tab));
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.url) {
        scheduleCheck(tabId, changeInfo.url);
    } else if (changeInfo.status === 'complete' && isBlankUrl(getTabUrl(tab))) {
        scheduleCheck(tabId, '');
    }
});

chrome.tabs.onRemoved.addListener((tabId) => {
    clearTimeout(pendingChecks.get(tabId));
    pendingChecks.delete(tabId);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message && message.type === 'closeDuplicatesNow') {
        closeAllDuplicates().then(sendResponse);
        return true;
    }
    return false;
});

function scheduleCheck(tabId, url) {
    if (tabId === undefined || tabId === chrome.tabs.TAB_ID_NONE) {
        return;
    }

    clearTimeout(pendingChecks.get(tabId));
    const delay = isBlankUrl(url) ? EMPTY_URL_CHECK_DELAY_MS : CHECK_DELAY_MS;
    pendingChecks.set(tabId, setTimeout(() => {
        pendingChecks.delete(tabId);
        closeOlderDuplicates(tabId).catch((error) => console.warn('[OnlyOneNewTab]', error));
    }, delay));
}

async function getSettings() {
    const stored = await chrome.storage.sync.get(DEFAULT_SETTINGS);
    return normalizeSettings(stored);
}

// Firefox opens every new tab as about:blank before navigating, so a blank tab
// only counts as a new tab page once it has finished loading.
function getTabGroupKey(tab, settings) {
    const url = getTabUrl(tab);
    if (isBlankUrl(url) && tab.status !== 'complete') {
        return null;
    }
    return getGroupKey(url, settings);
}

// Keeps tabId and closes every other tab of the same group.
async function closeOlderDuplicates(tabId) {
    const settings = await getSettings();
    if (!settings.enabled) {
        return;
    }

    let tab;
    try {
        tab = await chrome.tabs.get(tabId);
    } catch (error) {
        return; // tab already closed
    }

    const key = getTabGroupKey(tab, settings);
    if (!key) {
        return;
    }

    const tabs = await chrome.tabs.query({});
    const toClose = tabs
        .filter((other) => other.id !== tab.id && other.incognito === tab.incognito)
        .filter((other) => getTabGroupKey(other, settings) === key)
        .map((other) => other.id);

    if (toClose.length) {
        await chrome.tabs.remove(toClose);
    }
}

// Manual cleanup from the settings page: in every group keeps the most recently used tab.
async function closeAllDuplicates() {
    const settings = await getSettings();
    const tabs = await chrome.tabs.query({});
    const groups = new Map();

    for (const tab of tabs) {
        const key = getTabGroupKey(tab, settings);
        if (!key) {
            continue;
        }
        const groupKey = key + (tab.incognito ? '|incognito' : '');
        if (!groups.has(groupKey)) {
            groups.set(groupKey, []);
        }
        groups.get(groupKey).push(tab);
    }

    const toClose = [];
    for (const group of groups.values()) {
        group.sort((a, b) => (b.lastAccessed || b.id) - (a.lastAccessed || a.id));
        toClose.push(...group.slice(1).map((tab) => tab.id));
    }

    if (toClose.length) {
        await chrome.tabs.remove(toClose);
    }
    return { closed: toClose.length };
}

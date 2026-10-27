const DEFAULT_FOLDER_NAME = chrome.i18n.getMessage('defaultFolderName');
const BOOKMARKS_BAR_ID = '1';

//#region Icon version
const ICON_VERSIONS = ['v1', 'v2', 'v3', 'v4', 'v5', 'v6'];
const ICON_SIZES = [16, 32, 48, 64, 128, 256, 512];
const DEFAULT_ICON_SETTINGS = { iconVersion: 'v1' };

function buildIconPaths(version) {
    const path = {};
    ICON_SIZES.forEach((size) => {
        path[size] = `icon/${version}/${size}.png`;
    });
    return path;
}

function applyIconVersion(version) {
    const resolvedVersion = ICON_VERSIONS.includes(version) ? version : DEFAULT_ICON_SETTINGS.iconVersion;
    chrome.action.setIcon({ path: buildIconPaths(resolvedVersion) });
}

chrome.storage.sync.get(DEFAULT_ICON_SETTINGS, (settings) => {
    applyIconVersion(settings.iconVersion);
});

chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'sync' || !changes.iconVersion) {
        return;
    }

    applyIconVersion(changes.iconVersion.newValue);
});
//#endregion

//#region Custom link
const CUSTOM_LINK_MENU_ID = 'open-custom-link-with-video';
const VIDEO_LINK_PLACEHOLDER = '%VIDEO_LINK%';
const DEFAULT_CUSTOM_LINK_SETTINGS = {
    customLinkName: chrome.i18n.getMessage('contextMenuCustomLinkDefault'),
    customLinkUrl: ''
};

function getCustomLinkSettings(callback) {
    chrome.storage.sync.get(DEFAULT_CUSTOM_LINK_SETTINGS, (settings) => {
        const name = typeof settings.customLinkName === 'string' ? settings.customLinkName.trim() : '';
        const url = typeof settings.customLinkUrl === 'string' ? settings.customLinkUrl.trim() : '';

        callback({
            customLinkName: name || DEFAULT_CUSTOM_LINK_SETTINGS.customLinkName,
            customLinkUrl: url
        });
    });
}

// The button only exists while a link is configured. Updating first (and creating only when there
// is nothing to update) keeps quick successive settings saves from fighting over the same menu id.
function syncCustomLinkMenu() {
    getCustomLinkSettings((settings) => {
        if (!settings.customLinkUrl) {
            chrome.contextMenus.remove(CUSTOM_LINK_MENU_ID, () => void chrome.runtime.lastError);
            return;
        }

        chrome.contextMenus.update(CUSTOM_LINK_MENU_ID, { title: settings.customLinkName }, () => {
            if (!chrome.runtime.lastError) return;

            chrome.contextMenus.create({
                id: CUSTOM_LINK_MENU_ID,
                title: settings.customLinkName,
                contexts: ["action"]
            }, () => void chrome.runtime.lastError);
        });
    });
}

chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'sync' || (!changes.customLinkName && !changes.customLinkUrl)) {
        return;
    }

    syncCustomLinkMenu();
});

// The video link is encoded so its own query string ("?v=...&t=...") stays inside the
// placeholder's parameter instead of leaking into the outer link's parameters. The resulting link
// is requested in the background (see 'openCustomLinkWithVideo') rather than opened in a tab -
// it's meant for webhooks such as a MacroDroid trigger, which only need the GET request.
function buildCustomLink(template, videoUrl) {
    return template.split(VIDEO_LINK_PLACEHOLDER).join(encodeURIComponent(videoUrl));
}
//#endregion

// Holds each tab's freshly computed "resume here" URL just long enough to hand it off between
// content.js's async video-time capture (findVideoForReload() can poll for a while on vkvideo)
// and the reload below that consumes it - see the "refresh-the-page-by-clearing-the-RAM" context
// menu action.
const pendingVideoTimeUrls = new Map();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'createBookmark') {
        getSettings((settings) => {
            getOrCreateFolder(settings.folderName, (folderId) => {
                chrome.bookmarks.create({
                    parentId: folderId,
                    title: message.title,
                    url: message.url
                });
            });
        });
    } else if (message.action === 'reloadWithVideoTime') {
        const tabId = sender.tab && sender.tab.id;
        if (tabId == null) return;

        pendingVideoTimeUrls.set(tabId, message.url);

        // Navigating the tab to the timestamped URL both frees the old page's memory (video
        // buffers, DOM, JS heap - the whole point of "clearing RAM") and reopens it at the same
        // moment the video was at, since the URL carries that moment via the "t" param.
        chrome.tabs.update(tabId, { url: pendingVideoTimeUrls.get(tabId) }, () => {
            pendingVideoTimeUrls.delete(tabId);
        });
    } else if (message.action === 'openCustomLinkWithVideo') {
        const tab = sender.tab;
        if (!tab) return;

        getCustomLinkSettings((settings) => {
            if (!settings.customLinkUrl) return;

            const showToast = (text) => {
                chrome.tabs.sendMessage(tab.id, { action: 'showToast', text }, { frameId: sender.frameId },
                    () => void chrome.runtime.lastError);
            };

            fetch(buildCustomLink(settings.customLinkUrl, message.url), { cache: 'no-store' })
                .then((response) => {
                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}`);
                    }

                    showToast(chrome.i18n.getMessage('toastCustomLinkSent'));
                })
                .catch((error) => {
                    showToast(chrome.i18n.getMessage('toastError', error.message || String(error)));
                });
        });
    }
});

function getSettings(callback) {
    chrome.storage.sync.get({
        folderName: DEFAULT_FOLDER_NAME
    }, (settings) => {
        callback({
            folderName: normalizeFolderName(settings.folderName)
        });
    });
}

function normalizeFolderName(folderName) {
    if (typeof folderName !== 'string') {
        return DEFAULT_FOLDER_NAME;
    }

    const normalizedName = folderName.trim();

    return normalizedName || DEFAULT_FOLDER_NAME;
}

function getOrCreateFolder(name, callback) {
    // Ищем папку с таким именем
    chrome.bookmarks.search({ title: name }, (results) => {
        const folder = results.find(b =>
            !b.url && b.parentId === BOOKMARKS_BAR_ID
        );

        if (folder) {
            callback(folder.id);
        } else {
            // Создаём папку на панели закладок
            chrome.bookmarks.create({
                parentId: BOOKMARKS_BAR_ID,
                title: name
            }, (newFolder) => {
                callback(newFolder.id);
            });
        }
    });
}

chrome.action.onClicked.addListener((tab) => {
    chrome.tabs.sendMessage(tab.id, { action: "runСreateYoutubeBookmark" });
});

chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: "refresh-the-page-by-clearing-the-RAM",
        title: chrome.i18n.getMessage('contextMenuReloadClearRam'),
        contexts: ["action"]
    });

    syncCustomLinkMenu();
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "refresh-the-page-by-clearing-the-RAM") {
        // Kicks off content.js's findVideoForReload() -> sendCurrentVideoTimeUrl(), which
        // reports back via the 'reloadWithVideoTime' message handled above.
        chrome.tabs.sendMessage(tab.id, { action: "getCurrentVideoTimeForReload" });
    } else if (info.menuItemId === CUSTOM_LINK_MENU_ID) {
        // Same video-time capture as above, reported back via 'openCustomLinkWithVideo'.
        chrome.tabs.sendMessage(tab.id, { action: "getCurrentVideoLinkForCustomLink" });
    }
}); 
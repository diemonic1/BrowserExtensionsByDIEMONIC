const DEFAULT_FOLDER_NAME = 'Смотреть';
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
        title: "Обновить страницу, очистив ОЗУ",
        contexts: ["action"]
    });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "refresh-the-page-by-clearing-the-RAM") {
        // Kicks off content.js's findVideoForReload() -> sendCurrentVideoTimeForReload(), which
        // reports back via the 'reloadWithVideoTime' message handled above.
        chrome.tabs.sendMessage(tab.id, { action: "getCurrentVideoTimeForReload" });
    }
});
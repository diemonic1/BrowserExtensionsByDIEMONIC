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
const FOLDER_NAME = 'Смотреть';
const BOOKMARKS_BAR_ID = '1';

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'createBookmark') {
        getOrCreateFolder(FOLDER_NAME, (folderId) => {
            chrome.bookmarks.create({
                parentId: folderId,
                title: message.title,
                url: message.url
            });
        });
    }
});

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
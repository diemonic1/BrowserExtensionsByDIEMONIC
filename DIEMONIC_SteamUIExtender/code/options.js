const DEFAULT_SETTINGS = {
    moduleNotesExtenderEnabled: true,
    moduleWishlistExtenderEnabled: true,
    moduleWishlistSorterEnabled: true,
};

function applyI18n() {
    document.title = chrome.i18n.getMessage('optionsTitle');
    document.querySelectorAll('[data-i18n]').forEach((el) => {
        el.textContent = chrome.i18n.getMessage(el.dataset.i18n);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    applyI18n();

    chrome.storage.sync.get(DEFAULT_SETTINGS, (items) => {
        Object.keys(DEFAULT_SETTINGS).forEach((key) => {
            const checkbox = document.getElementById(key);
            if (!checkbox) return;

            checkbox.checked = items[key];
            checkbox.addEventListener('change', () => {
                chrome.storage.sync.set({ [key]: checkbox.checked });
            });
        });
    });
});

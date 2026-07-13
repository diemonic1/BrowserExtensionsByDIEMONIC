const DEFAULT_SETTINGS = {
    moduleNotesExtenderEnabled: true,
    moduleWishlistExtenderEnabled: true,
};

function applyI18n() {
    document.title = chrome.i18n.getMessage('optionsTitle');
    document.querySelectorAll('[data-i18n]').forEach((el) => {
        el.textContent = chrome.i18n.getMessage(el.dataset.i18n);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    applyI18n();

    const moduleNotesCheckbox = document.getElementById('moduleNotesExtenderEnabled');
    const moduleWishlistCheckbox = document.getElementById('moduleWishlistExtenderEnabled');

    chrome.storage.sync.get(DEFAULT_SETTINGS, (items) => {
        moduleNotesCheckbox.checked = items.moduleNotesExtenderEnabled;
        moduleWishlistCheckbox.checked = items.moduleWishlistExtenderEnabled;
    });

    moduleNotesCheckbox.addEventListener('change', () => {
        chrome.storage.sync.set({ moduleNotesExtenderEnabled: moduleNotesCheckbox.checked });
    });
    moduleWishlistCheckbox.addEventListener('change', () => {
        chrome.storage.sync.set({ moduleWishlistExtenderEnabled: moduleWishlistCheckbox.checked });
    });
});

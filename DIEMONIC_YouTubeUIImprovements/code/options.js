const DEFAULT_SETTINGS = {
    moduleCustomButtonsEnabled: true,
    moduleMediaListenerEnabled: true,
    moduleSidebarButtonsEnabled: true,
    moduleViewProgressEnabled: true,
    moduleRelatedSidebarEnabled: false,
    showDownloadButton: true,
    showPreviewButton: true,
    protocol: 'ytDlpWebExtension://',
    enableLogs: true,
    relatedSidebarWidth: 450,
};

function applyI18n() {
    document.title = chrome.i18n.getMessage('optionsTitle');
    document.querySelectorAll('[data-i18n]').forEach((el) => {
        el.textContent = chrome.i18n.getMessage(el.dataset.i18n);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    applyI18n();

    const moduleCustomButtonsCheckbox = document.getElementById('moduleCustomButtonsEnabled');
    const moduleMediaListenerCheckbox = document.getElementById('moduleMediaListenerEnabled');
    const moduleSidebarButtonsCheckbox = document.getElementById('moduleSidebarButtonsEnabled');
    const moduleViewProgressCheckbox = document.getElementById('moduleViewProgressEnabled');
    const moduleRelatedSidebarCheckbox = document.getElementById('moduleRelatedSidebarEnabled');

    const showDownloadButtonCheckbox = document.getElementById('showDownloadButton');
    const showPreviewButtonCheckbox = document.getElementById('showPreviewButton');
    const enableLogsCheckbox = document.getElementById('enableLogs');
    const protocolInput = document.getElementById('protocolInput');
    const relatedSidebarWidthInput = document.getElementById('relatedSidebarWidthInput');
    const relatedSidebarWidthValue = document.getElementById('relatedSidebarWidthValue');

    function renderRelatedSidebarWidthValue(width) {
        relatedSidebarWidthValue.textContent = `${width}px`;
    }

    // Load saved settings
    chrome.storage.sync.get(DEFAULT_SETTINGS, (items) => {
        moduleCustomButtonsCheckbox.checked = items.moduleCustomButtonsEnabled;
        moduleMediaListenerCheckbox.checked = items.moduleMediaListenerEnabled;
        moduleSidebarButtonsCheckbox.checked = items.moduleSidebarButtonsEnabled;
        moduleViewProgressCheckbox.checked = items.moduleViewProgressEnabled;
        moduleRelatedSidebarCheckbox.checked = items.moduleRelatedSidebarEnabled;

        showDownloadButtonCheckbox.checked = items.showDownloadButton;
        showPreviewButtonCheckbox.checked = items.showPreviewButton;
        enableLogsCheckbox.checked = items.enableLogs;
        protocolInput.value = items.protocol;

        relatedSidebarWidthInput.value = items.relatedSidebarWidth;
        renderRelatedSidebarWidthValue(items.relatedSidebarWidth);
    });

    // Save immediately on each control's change/input event
    moduleCustomButtonsCheckbox.addEventListener('change', () => {
        chrome.storage.sync.set({ moduleCustomButtonsEnabled: moduleCustomButtonsCheckbox.checked });
    });
    moduleMediaListenerCheckbox.addEventListener('change', () => {
        chrome.storage.sync.set({ moduleMediaListenerEnabled: moduleMediaListenerCheckbox.checked });
    });
    moduleSidebarButtonsCheckbox.addEventListener('change', () => {
        chrome.storage.sync.set({ moduleSidebarButtonsEnabled: moduleSidebarButtonsCheckbox.checked });
    });
    moduleViewProgressCheckbox.addEventListener('change', () => {
        chrome.storage.sync.set({ moduleViewProgressEnabled: moduleViewProgressCheckbox.checked });
    });
    moduleRelatedSidebarCheckbox.addEventListener('change', () => {
        chrome.storage.sync.set({ moduleRelatedSidebarEnabled: moduleRelatedSidebarCheckbox.checked });
    });

    showDownloadButtonCheckbox.addEventListener('change', () => {
        chrome.storage.sync.set({ showDownloadButton: showDownloadButtonCheckbox.checked });
    });
    showPreviewButtonCheckbox.addEventListener('change', () => {
        chrome.storage.sync.set({ showPreviewButton: showPreviewButtonCheckbox.checked });
    });
    enableLogsCheckbox.addEventListener('change', () => {
        chrome.storage.sync.set({ enableLogs: enableLogsCheckbox.checked });
    });
    protocolInput.addEventListener('input', () => {
        chrome.storage.sync.set({ protocol: protocolInput.value });
    });
    relatedSidebarWidthInput.addEventListener('input', () => {
        const width = Number(relatedSidebarWidthInput.value);
        renderRelatedSidebarWidthValue(width);
        chrome.storage.sync.set({ relatedSidebarWidth: width });
    });
});

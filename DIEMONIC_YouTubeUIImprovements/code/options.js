const DEFAULT_SETTINGS = {
    moduleCustomButtonsEnabled: true,
    moduleMediaListenerEnabled: true,
    moduleSidebarButtonsEnabled: true,
    moduleViewProgressEnabled: true,
    showDownloadButton: true,
    showPreviewButton: true,
    protocol: 'ytDlpWebExtension://',
    enableLogs: true,
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

    const showDownloadButtonCheckbox = document.getElementById('showDownloadButton');
    const showPreviewButtonCheckbox = document.getElementById('showPreviewButton');
    const enableLogsCheckbox = document.getElementById('enableLogs');
    const protocolInput = document.getElementById('protocolInput');

    // Load saved settings
    chrome.storage.sync.get(DEFAULT_SETTINGS, (items) => {
        moduleCustomButtonsCheckbox.checked = items.moduleCustomButtonsEnabled;
        moduleMediaListenerCheckbox.checked = items.moduleMediaListenerEnabled;
        moduleSidebarButtonsCheckbox.checked = items.moduleSidebarButtonsEnabled;
        moduleViewProgressCheckbox.checked = items.moduleViewProgressEnabled;

        showDownloadButtonCheckbox.checked = items.showDownloadButton;
        showPreviewButtonCheckbox.checked = items.showPreviewButton;
        enableLogsCheckbox.checked = items.enableLogs;
        protocolInput.value = items.protocol;
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
});

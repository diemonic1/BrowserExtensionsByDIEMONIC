const DEFAULT_SETTINGS = {
    showDownloadButton: false,
    showPreviewButton: false,
    protocol: 'ytDlpWebExtension://',
    enableLogs: true,
};

document.addEventListener('DOMContentLoaded', () => {
    const showDownloadButtonCheckbox = document.getElementById('showDownloadButton');
    const showPreviewButtonCheckbox = document.getElementById('showPreviewButton');
    const enableLogsCheckbox = document.getElementById('enableLogs');
    const protocolInput = document.getElementById('protocolInput');

    // Загружаем сохраненные настройки
    chrome.storage.sync.get(DEFAULT_SETTINGS, (items) => {
        showDownloadButtonCheckbox.checked = items.showDownloadButton;
        showPreviewButtonCheckbox.checked = items.showPreviewButton;
        enableLogsCheckbox.checked = items.enableLogs;
        protocolInput.value = items.protocol;
    });

    // Сохраняем при изменении чекбокса
    showDownloadButtonCheckbox.addEventListener('change', () => {
        chrome.storage.sync.set({ showDownloadButton: showDownloadButtonCheckbox.checked });
    });

    // Сохраняем при изменении чекбокса
    showPreviewButtonCheckbox.addEventListener('change', () => {
        chrome.storage.sync.set({ showPreviewButton: showPreviewButtonCheckbox.checked });
    });

    // Сохраняем при изменении чекбокса логов
    enableLogsCheckbox.addEventListener('change', () => {
        chrome.storage.sync.set({ enableLogs: enableLogsCheckbox.checked });
    });

    // Сохраняем при изменении текстового поля
    protocolInput.addEventListener('input', () => {
        chrome.storage.sync.set({ protocol: protocolInput.value });
    });
});

const DEFAULT_SETTINGS = {
    showDownloadButton: false,
    protocol: 'ytDlpWebExtension://'
};

document.addEventListener('DOMContentLoaded', () => {
    const showDownloadButtonCheckbox = document.getElementById('showDownloadButton');
    const protocolInput = document.getElementById('protocolInput');

    // Загружаем сохраненные настройки
    chrome.storage.sync.get(DEFAULT_SETTINGS, (items) => {
        showDownloadButtonCheckbox.checked = items.showDownloadButton;
        protocolInput.value = items.protocol;
    });

    // Сохраняем при изменении чекбокса
    showDownloadButtonCheckbox.addEventListener('change', () => {
        chrome.storage.sync.set({ showDownloadButton: showDownloadButtonCheckbox.checked });
    });

    // Сохраняем при изменении текстового поля
    protocolInput.addEventListener('input', () => {
        chrome.storage.sync.set({ protocol: protocolInput.value });
    });
});

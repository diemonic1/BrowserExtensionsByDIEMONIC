const DEFAULT_SETTINGS = {
    videoOffset: 0,
    folderName: 'Смотреть',
    toastLeftOffset: '23.8%'
};

const form = document.getElementById('settings-form');
const videoOffsetInput = document.getElementById('video-offset');
const videoOffsetValue = document.getElementById('video-offset-value');
const folderNameInput = document.getElementById('folder-name');
const toastLeftOffsetInput = document.getElementById('toast-left-offset');
const statusNode = document.getElementById('status');

initialize();

function initialize() {
    syncOffsetLabel(videoOffsetInput.value);

    chrome.storage.sync.get(DEFAULT_SETTINGS, (settings) => {
        const normalizedSettings = normalizeSettings(settings);

        videoOffsetInput.value = String(normalizedSettings.videoOffset);
        folderNameInput.value = normalizedSettings.folderName;
        toastLeftOffsetInput.value = normalizedSettings.toastLeftOffset;
        syncOffsetLabel(normalizedSettings.videoOffset);
    });

    videoOffsetInput.addEventListener('input', () => {
        syncOffsetLabel(videoOffsetInput.value);
    });

    form.addEventListener('submit', (event) => {
        event.preventDefault();

        const nextSettings = normalizeSettings({
            videoOffset: videoOffsetInput.value,
            folderName: folderNameInput.value,
            toastLeftOffset: toastLeftOffsetInput.value
        });

        chrome.storage.sync.set(nextSettings, () => {
            videoOffsetInput.value = String(nextSettings.videoOffset);
            folderNameInput.value = nextSettings.folderName;
            toastLeftOffsetInput.value = nextSettings.toastLeftOffset;
            syncOffsetLabel(nextSettings.videoOffset);
            showStatus('Settings saved');
        });
    });
}

function normalizeSettings(settings) {
    return {
        videoOffset: clampOffset(settings.videoOffset),
        folderName: normalizeFolderName(settings.folderName),
        toastLeftOffset: normalizeToastLeftOffset(settings.toastLeftOffset)
    };
}

function clampOffset(value) {
    const numericValue = Number(value);

    if (!Number.isFinite(numericValue)) {
        return DEFAULT_SETTINGS.videoOffset;
    }

    return Math.min(3, Math.max(0, Math.floor(numericValue)));
}

function normalizeFolderName(value) {
    if (typeof value !== 'string') {
        return DEFAULT_SETTINGS.folderName;
    }

    const normalizedValue = value.trim();

    return normalizedValue || DEFAULT_SETTINGS.folderName;
}

function normalizeToastLeftOffset(value) {
    if (typeof value !== 'string') {
        return DEFAULT_SETTINGS.toastLeftOffset;
    }

    const normalizedValue = value.trim().replace(',', '.');
    const matchedValue = normalizedValue.match(/^(-?\d+(?:\.\d+)?)\s*%?$/);

    if (!matchedValue) {
        return DEFAULT_SETTINGS.toastLeftOffset;
    }

    const numericValue = Number(matchedValue[1]);

    if (!Number.isFinite(numericValue)) {
        return DEFAULT_SETTINGS.toastLeftOffset;
    }

    return `${numericValue}%`;
}

function syncOffsetLabel(value) {
    videoOffsetValue.value = `${value}s`;
}

function showStatus(message) {
    statusNode.textContent = message;

    window.clearTimeout(showStatus.timeoutId);
    showStatus.timeoutId = window.setTimeout(() => {
        statusNode.textContent = '';
    }, 1800);
}
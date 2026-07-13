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

const ICON_VERSIONS = ['v1', 'v2', 'v3', 'v4', 'v5', 'v6'];
const DEFAULT_ICON_SETTINGS = { iconVersion: 'v1' };

initialize();
initializeIconPicker();

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

function initializeIconPicker() {
    const grid = document.getElementById('iconGrid');

    const fragment = document.createDocumentFragment();
    ICON_VERSIONS.forEach((version) => {
        const tile = document.createElement('button');
        tile.type = 'button';
        tile.className = 'icon-tile';
        tile.dataset.version = version;
        tile.setAttribute('aria-label', `Icon option ${version}`);
        tile.setAttribute('aria-pressed', 'false');

        const img = document.createElement('img');
        img.src = `icon/${version}/128.png`;
        img.alt = '';

        const check = document.createElement('span');
        check.className = 'icon-tile-check';
        check.setAttribute('aria-hidden', 'true');
        check.textContent = '✓';

        tile.append(img, check);
        fragment.appendChild(tile);
    });

    grid.appendChild(fragment);

    chrome.storage.sync.get(DEFAULT_ICON_SETTINGS, (settings) => {
        setSelectedIconTile(settings.iconVersion);
    });

    grid.addEventListener('click', (event) => {
        const tile = event.target.closest('.icon-tile');
        if (!tile) {
            return;
        }

        const version = tile.dataset.version;
        setSelectedIconTile(version);
        chrome.storage.sync.set({ iconVersion: version });
    });
}

function setSelectedIconTile(version) {
    document.querySelectorAll('.icon-tile').forEach((tile) => {
        const isSelected = tile.dataset.version === version;
        tile.classList.toggle('selected', isSelected);
        tile.setAttribute('aria-pressed', String(isSelected));
    });
}
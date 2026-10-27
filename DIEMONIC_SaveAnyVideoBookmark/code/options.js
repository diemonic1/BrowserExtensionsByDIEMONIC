const DEFAULT_SETTINGS = {
    videoOffset: 0,
    folderName: chrome.i18n.getMessage('defaultFolderName'),
    toastLeftOffset: '23.8%',
    maxTitleLength: 38,
    titleReplacements: [],
    customLinkName: chrome.i18n.getMessage('contextMenuCustomLinkDefault'),
    customLinkUrl: ''
};

const MIN_MAX_TITLE_LENGTH = 15;
const MAX_MAX_TITLE_LENGTH = 48;

const form = document.getElementById('settings-form');
const videoOffsetInput = document.getElementById('video-offset');
const videoOffsetValue = document.getElementById('video-offset-value');
const maxTitleLengthInput = document.getElementById('max-title-length');
const maxTitleLengthValue = document.getElementById('max-title-length-value');
const folderNameInput = document.getElementById('folder-name');
const toastLeftOffsetInput = document.getElementById('toast-left-offset');
const customLinkNameInput = document.getElementById('custom-link-name');
const customLinkUrlInput = document.getElementById('custom-link-url');
const statusNode = document.getElementById('status');
const replacementList = document.getElementById('replacement-list');
const addReplacementButton = document.getElementById('add-replacement');

const ICON_VERSIONS = ['v1', 'v2', 'v3', 'v4', 'v5', 'v6'];
const DEFAULT_ICON_SETTINGS = { iconVersion: 'v1' };

localizePage();
initialize();
initializeIconPicker();

function localizePage() {
    document.documentElement.lang = chrome.i18n.getUILanguage();
    document.title = chrome.i18n.getMessage('optionsPageTitle');

    document.querySelectorAll('[data-i18n]').forEach((node) => {
        node.textContent = chrome.i18n.getMessage(node.dataset.i18n);
    });

    folderNameInput.placeholder = DEFAULT_SETTINGS.folderName;
    customLinkNameInput.placeholder = DEFAULT_SETTINGS.customLinkName;
    customLinkNameInput.setAttribute('aria-label', chrome.i18n.getMessage('optionsCustomLinkNameLabel'));
    customLinkUrlInput.setAttribute('aria-label', chrome.i18n.getMessage('optionsCustomLinkUrlLabel'));
}

function initialize() {
    syncOffsetLabel(videoOffsetInput.value);

    chrome.storage.sync.get(DEFAULT_SETTINGS, (settings) => {
        const normalizedSettings = normalizeSettings(settings);

        videoOffsetInput.value = String(normalizedSettings.videoOffset);
        folderNameInput.value = normalizedSettings.folderName;
        toastLeftOffsetInput.value = normalizedSettings.toastLeftOffset;
        maxTitleLengthInput.value = String(normalizedSettings.maxTitleLength);
        customLinkNameInput.value = normalizedSettings.customLinkName;
        customLinkUrlInput.value = normalizedSettings.customLinkUrl;
        syncOffsetLabel(normalizedSettings.videoOffset);
        syncMaxTitleLengthLabel(normalizedSettings.maxTitleLength);
        renderReplacements(normalizedSettings.titleReplacements);
    });

    videoOffsetInput.addEventListener('input', () => {
        syncOffsetLabel(videoOffsetInput.value);
    });

    maxTitleLengthInput.addEventListener('input', () => {
        syncMaxTitleLengthLabel(maxTitleLengthInput.value);
    });

    addReplacementButton.addEventListener('click', () => {
        const row = createReplacementRow({ from: '', to: '' });
        replacementList.appendChild(row);
        syncReplacementButtons();
        row.querySelector('.replacement-from').focus();
        // Nothing to save yet - a row with an empty "from" is dropped by normalizeReplacements().
    });

    replacementList.addEventListener('click', (event) => {
        const button = event.target.closest('button[data-action]');
        if (!button) {
            return;
        }

        const row = button.closest('.replacement-row');

        if (button.dataset.action === 'up' && row.previousElementSibling) {
            replacementList.insertBefore(row, row.previousElementSibling);
        } else if (button.dataset.action === 'down' && row.nextElementSibling) {
            replacementList.insertBefore(row.nextElementSibling, row);
        } else if (button.dataset.action === 'remove') {
            row.remove();
        }

        syncReplacementButtons();
        saveSettings();
    });

    // Every edit is saved on its own. Typing and slider dragging fire "input" continuously, so
    // those saves are debounced to stay within chrome.storage.sync write quotas.
    form.addEventListener('input', scheduleSave);

    // Normalized text values (trimmed folder name, "23.8%" format) are written back only once the
    // field is left, so the input isn't rewritten under the cursor while typing.
    form.addEventListener('change', (event) => {
        saveSettings();

        const settings = readSettings();
        if (event.target === folderNameInput) {
            folderNameInput.value = settings.folderName;
        } else if (event.target === toastLeftOffsetInput) {
            toastLeftOffsetInput.value = settings.toastLeftOffset;
        } else if (event.target === customLinkNameInput) {
            customLinkNameInput.value = settings.customLinkName;
        } else if (event.target === customLinkUrlInput) {
            customLinkUrlInput.value = settings.customLinkUrl;
        }
    });

    // Enter in a text field would otherwise submit (and reload) the page.
    form.addEventListener('submit', (event) => {
        event.preventDefault();
    });

    window.addEventListener('pagehide', () => {
        if (scheduleSave.timeoutId) {
            saveSettings();
        }
    });
}

function readSettings() {
    return normalizeSettings({
        videoOffset: videoOffsetInput.value,
        folderName: folderNameInput.value,
        toastLeftOffset: toastLeftOffsetInput.value,
        maxTitleLength: maxTitleLengthInput.value,
        titleReplacements: readReplacements(),
        customLinkName: customLinkNameInput.value,
        customLinkUrl: customLinkUrlInput.value
    });
}

function scheduleSave() {
    window.clearTimeout(scheduleSave.timeoutId);
    scheduleSave.timeoutId = window.setTimeout(saveSettings, 400);
}

function saveSettings() {
    window.clearTimeout(scheduleSave.timeoutId);
    scheduleSave.timeoutId = null;

    chrome.storage.sync.set(readSettings(), () => {
        showStatus(chrome.i18n.getMessage('optionsSaved'));
    });
}

function normalizeSettings(settings) {
    return {
        videoOffset: clampOffset(settings.videoOffset),
        folderName: normalizeFolderName(settings.folderName),
        toastLeftOffset: normalizeToastLeftOffset(settings.toastLeftOffset),
        maxTitleLength: clampMaxTitleLength(settings.maxTitleLength),
        titleReplacements: normalizeReplacements(settings.titleReplacements),
        customLinkName: normalizeCustomLinkName(settings.customLinkName),
        customLinkUrl: typeof settings.customLinkUrl === 'string' ? settings.customLinkUrl.trim() : DEFAULT_SETTINGS.customLinkUrl
    };
}

// Keeps only well-formed pairs with a non-empty "from" - an empty "to" is allowed and simply
// removes the matched text from the title.
function normalizeReplacements(value) {
    if (!Array.isArray(value)) {
        return DEFAULT_SETTINGS.titleReplacements;
    }

    return value
        .filter((item) => item && typeof item.from === 'string' && item.from !== '')
        .map((item) => ({
            from: item.from,
            to: typeof item.to === 'string' ? item.to : ''
        }));
}

function readReplacements() {
    return Array.from(replacementList.querySelectorAll('.replacement-row'), (row) => ({
        from: row.querySelector('.replacement-from').value,
        to: row.querySelector('.replacement-to').value
    }));
}

function renderReplacements(replacements) {
    replacementList.replaceChildren(...replacements.map(createReplacementRow));
    syncReplacementButtons();
}

function createReplacementRow(replacement) {
    const row = document.createElement('li');
    row.className = 'replacement-row';

    const fromInput = document.createElement('input');
    fromInput.type = 'text';
    fromInput.className = 'replacement-from';
    fromInput.value = replacement.from;
    fromInput.placeholder = chrome.i18n.getMessage('optionsReplacementFromPlaceholder');
    fromInput.setAttribute('aria-label', chrome.i18n.getMessage('optionsReplacementFromLabel'));
    fromInput.autocomplete = 'off';

    const arrow = document.createElement('span');
    arrow.className = 'replacement-arrow';
    arrow.setAttribute('aria-hidden', 'true');
    arrow.textContent = '→';

    const toInput = document.createElement('input');
    toInput.type = 'text';
    toInput.className = 'replacement-to';
    toInput.value = replacement.to;
    toInput.placeholder = chrome.i18n.getMessage('optionsReplacementToPlaceholder');
    toInput.setAttribute('aria-label', chrome.i18n.getMessage('optionsReplacementToLabel'));
    toInput.autocomplete = 'off';

    const controls = document.createElement('div');
    controls.className = 'replacement-controls';
    controls.append(
        createReplacementButton('up', '↑', 'optionsReplacementMoveUp'),
        createReplacementButton('down', '↓', 'optionsReplacementMoveDown'),
        createReplacementButton('remove', '✕', 'optionsReplacementRemove')
    );

    row.append(fromInput, arrow, toInput, controls);
    return row;
}

function createReplacementButton(action, symbol, labelKey) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'icon-button';
    button.dataset.action = action;
    button.textContent = symbol;
    button.title = chrome.i18n.getMessage(labelKey);
    button.setAttribute('aria-label', button.title);
    return button;
}

function syncReplacementButtons() {
    const rows = replacementList.querySelectorAll('.replacement-row');

    rows.forEach((row, index) => {
        row.querySelector('[data-action="up"]').disabled = index === 0;
        row.querySelector('[data-action="down"]').disabled = index === rows.length - 1;
    });
}

function clampMaxTitleLength(value) {
    const numericValue = Number(value);

    if (!Number.isFinite(numericValue)) {
        return DEFAULT_SETTINGS.maxTitleLength;
    }

    return Math.min(MAX_MAX_TITLE_LENGTH, Math.max(MIN_MAX_TITLE_LENGTH, Math.floor(numericValue)));
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

function normalizeCustomLinkName(value) {
    if (typeof value !== 'string') {
        return DEFAULT_SETTINGS.customLinkName;
    }

    const normalizedValue = value.trim();

    return normalizedValue || DEFAULT_SETTINGS.customLinkName;
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
    videoOffsetValue.value = chrome.i18n.getMessage('optionsSecondsSuffix', String(value));
}

function syncMaxTitleLengthLabel(value) {
    maxTitleLengthValue.value = String(value);
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
        tile.setAttribute('aria-label', chrome.i18n.getMessage('optionsIconOptionLabel', version));
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
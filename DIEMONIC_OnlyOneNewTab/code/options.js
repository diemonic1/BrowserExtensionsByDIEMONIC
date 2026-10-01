const enabledInput = document.getElementById('enabled');
const closeNewTabPagesInput = document.getElementById('close-new-tab-pages');
const addForm = document.getElementById('add-form');
const patternInput = document.getElementById('pattern-input');
const addCurrentButton = document.getElementById('add-current');
const patternList = document.getElementById('pattern-list');
const emptyList = document.getElementById('empty-list');
const closeNowButton = document.getElementById('close-now');
const statusNode = document.getElementById('status');

let settings = normalizeSettings(DEFAULT_SETTINGS);
let statusTimer = null;

initialize();

function initialize() {
    chrome.storage.sync.get(DEFAULT_SETTINGS, (stored) => {
        settings = normalizeSettings(stored);
        render();
    });

    // Keeps the options tab and the popup in sync when both are open.
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== 'sync') {
            return;
        }
        const next = Object.assign({}, settings);
        for (const key of Object.keys(changes)) {
            next[key] = changes[key].newValue;
        }
        settings = normalizeSettings(next);
        render();
    });

    enabledInput.addEventListener('change', () => {
        save({ enabled: enabledInput.checked });
    });

    closeNewTabPagesInput.addEventListener('change', () => {
        save({ closeNewTabPages: closeNewTabPagesInput.checked });
    });

    addForm.addEventListener('submit', (event) => {
        event.preventDefault();
        addPattern(patternInput.value);
    });

    addCurrentButton.addEventListener('click', addCurrentTab);
    closeNowButton.addEventListener('click', closeDuplicatesNow);
}

function render() {
    enabledInput.checked = settings.enabled;
    closeNewTabPagesInput.checked = settings.closeNewTabPages;

    patternList.replaceChildren(...settings.patterns.map(createPatternItem));
    emptyList.hidden = settings.patterns.length > 0;
}

function createPatternItem(pattern) {
    const item = document.createElement('li');
    item.className = 'pattern-item';

    const text = document.createElement('span');
    text.className = 'pattern-text';
    text.textContent = pattern;
    text.title = pattern;

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'remove-button';
    remove.title = 'Remove';
    remove.textContent = '✕';
    remove.addEventListener('click', () => {
        save({ patterns: settings.patterns.filter((item) => item !== pattern) }, 'Removed');
    });

    item.append(text, remove);
    return item;
}

function addPattern(value) {
    const pattern = normalizePattern(value);
    if (!pattern) {
        showStatus('Enter a URL', true);
        return;
    }
    if (settings.patterns.includes(pattern)) {
        showStatus('Already in the list', true);
        return;
    }

    save({ patterns: [...settings.patterns, pattern] }, 'Added');
    patternInput.value = '';
}

function addCurrentTab() {
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
        const tab = tabs && tabs[0];
        let host = '';
        try {
            const url = new URL(getTabUrl(tab || {}));
            if (url.protocol === 'http:' || url.protocol === 'https:') {
                host = url.host;
            }
        } catch (error) {
            // not a regular page
        }

        if (!host) {
            showStatus('Current tab is not a website', true);
            return;
        }
        addPattern(host);
    });
}

function closeDuplicatesNow() {
    chrome.runtime.sendMessage({ type: 'closeDuplicatesNow' }, (response) => {
        if (chrome.runtime.lastError || !response) {
            showStatus('Failed to close tabs', true);
            return;
        }
        showStatus(response.closed ? 'Closed tabs: ' + response.closed : 'No duplicates found');
    });
}

function save(patch, message = 'Saved') {
    settings = normalizeSettings(Object.assign({}, settings, patch));
    render();
    chrome.storage.sync.set(settings, () => {
        if (chrome.runtime.lastError) {
            showStatus(chrome.runtime.lastError.message, true);
            return;
        }
        showStatus(message);
    });
}

function showStatus(text, isError = false) {
    statusNode.textContent = text;
    statusNode.classList.toggle('error', isError);
    clearTimeout(statusTimer);
    statusTimer = setTimeout(() => {
        statusNode.textContent = '';
    }, 1800);
}

document.addEventListener('DOMContentLoaded', () => {
    const enabledCheckbox = document.getElementById('DIEMONIC_ADS_BLOCK_enabled_checkbox');
    const consoleLogCheckbox = document.getElementById('DIEMONIC_ADS_BLOCK_console_log_checkbox');

    chrome.storage.local.get(['DIEMONIC_ADS_BLOCK_enabled', 'DIEMONIC_ADS_BLOCK_console_log'], (result) => {
        enabledCheckbox.checked = result.DIEMONIC_ADS_BLOCK_enabled !== false;
        consoleLogCheckbox.checked = result.DIEMONIC_ADS_BLOCK_console_log === true;
    });

    enabledCheckbox.addEventListener('change', () => {
        chrome.storage.local.set({ 'DIEMONIC_ADS_BLOCK_enabled': enabledCheckbox.checked });
    });

    consoleLogCheckbox.addEventListener('change', () => {
        chrome.storage.local.set({ 'DIEMONIC_ADS_BLOCK_console_log': consoleLogCheckbox.checked });
    });

    chrome.storage.local.get(['DIEMONIC_ADS_BLOCK_last_time_update_configs'], (result) => {
        const el = document.getElementById('DIEMONIC_ADS_BLOCK_latUpdateTime');
        el.textContent = result.DIEMONIC_ADS_BLOCK_last_time_update_configs || '—';
    });

    // Each config value is stored as a JSON-stringified array (see content.js) - parse it back
    // into a real array instead of naively splitting the raw string on commas, which used to
    // print stray quotes/brackets and broke entirely once a key didn't exist.
    function parseConfigList(rawValue) {
        if (!rawValue) {
            return [];
        }

        try {
            const parsed = JSON.parse(rawValue);
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            return [];
        }
    }

    function renderConfigTable(tbodyId, items) {
        const tbody = document.getElementById(tbodyId);
        if (!tbody) {
            return;
        }

        if (!items.length) {
            tbody.innerHTML = '<tr class="empty-row"><td colspan="2">Пусто</td></tr>';
            return;
        }

        tbody.innerHTML = items
            .map((item, index) => `<tr><td>${index + 1}</td><td>${escapeHtml(item)}</td></tr>`)
            .join('');
    }

    function escapeHtml(value) {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    const CONFIG_KEYS = [
        'DIEMONIC_ADS_BLOCK_elementsToDelete',
        'DIEMONIC_ADS_BLOCK_elementsToCheckDelete',
        'DIEMONIC_ADS_BLOCK_elementsToCheckHide',
        'DIEMONIC_ADS_BLOCK_banWords',
        'DIEMONIC_ADS_BLOCK_stopWords',
        'DIEMONIC_ADS_BLOCK_elementsToHide'
    ];

    chrome.storage.local.get(CONFIG_KEYS, (result) => {
        CONFIG_KEYS.forEach((key) => {
            renderConfigTable(key, parseConfigList(result[key]));
        });
    });

    // Local test values: up to 3 extra entries per category the user can type directly into
    // the options page, for local testing without needing to publish/re-download the remote
    // rules file. content.js merges these into the same list it uses for matching (see
    // mergeLocalTestValues() there) - empty inputs and exact duplicates of an existing rule are
    // ignored at that point, not here, so what's shown/saved here is just the raw input state.
    const LOCAL_TEST_CATEGORIES = [
        'elementsToDelete',
        'elementsToCheckDelete',
        'elementsToCheckHide',
        'banWords',
        'stopWords',
        'elementsToHide'
    ];

    function localStorageKey(category) {
        return 'DIEMONIC_ADS_BLOCK_local_' + category;
    }

    function parseLocalSlots(rawValue) {
        if (rawValue) {
            try {
                const parsed = JSON.parse(rawValue);
                if (Array.isArray(parsed)) {
                    const slots = parsed.slice(0, 3).map((v) => String(v || ''));
                    while (slots.length < 3) {
                        slots.push('');
                    }
                    return slots;
                }
            } catch (e) {
                // fall through to defaults below
            }
        }
        return ['', '', ''];
    }

    function initLocalInputs() {
        const localKeys = LOCAL_TEST_CATEGORIES.map(localStorageKey);

        chrome.storage.local.get(localKeys, (result) => {
            LOCAL_TEST_CATEGORIES.forEach((category) => {
                const section = document.querySelector(`.local-inputs[data-local-key="${category}"]`);
                if (!section) {
                    return;
                }

                const slots = parseLocalSlots(result[localStorageKey(category)]);
                const inputs = section.querySelectorAll('.local-input');

                inputs.forEach((input) => {
                    const index = Number(input.dataset.index);
                    input.value = slots[index] || '';
                });

                const saveSlots = () => {
                    const currentSlots = ['', '', ''];
                    inputs.forEach((input) => {
                        const index = Number(input.dataset.index);
                        currentSlots[index] = input.value;
                    });
                    chrome.storage.local.set({ [localStorageKey(category)]: JSON.stringify(currentSlots) });
                };

                inputs.forEach((input) => {
                    input.addEventListener('input', saveSlots);
                });
            });
        });
    }

    initLocalInputs();

    const RULES_URL = "https://bodaiot.github.io/MyADSBlock/BlockADSRules.json";

    async function downloadFreshConfigs() {
        const response = await fetch(RULES_URL, { cache: 'no-store' });
        if (!response.ok) {
            throw new Error('Сетевая ошибка');
        }
        const data = await response.json();

        await new Promise((resolve) => chrome.storage.local.set({
            "DIEMONIC_ADS_BLOCK_elementsToDelete": JSON.stringify(data.elementsToDelete ?? []),
            "DIEMONIC_ADS_BLOCK_elementsToCheckDelete": JSON.stringify(data.elementsToCheckDelete ?? []),
            "DIEMONIC_ADS_BLOCK_elementsToCheckHide": JSON.stringify(data.elementsToCheckHide ?? []),
            "DIEMONIC_ADS_BLOCK_banWords": JSON.stringify(data.banWords ?? []),
            "DIEMONIC_ADS_BLOCK_stopWords": JSON.stringify(data.stopWords ?? []),
            "DIEMONIC_ADS_BLOCK_elementsToHide": JSON.stringify(data.elementsToHide ?? []),
            "DIEMONIC_ADS_BLOCK_LinksToCheck": JSON.stringify(data.LinksToCheck ?? []),
            "DIEMONIC_ADS_BLOCK_last_time_update_configs": (new Date()).toString()
        }, resolve));
    }

    const btn = document.getElementById('DIEMONIC_ADS_BLOCK_resetBtn');
    btn.addEventListener('click', async () => {
        btn.disabled = true;
        btn.textContent = 'Обновление...';

        // Local test values are independent of the downloaded config - clearing them on every
        // "update configs" click would defeat their whole point (testing without touching the
        // remote file), so save and restore them across the clear.
        const localKeysToKeep = LOCAL_TEST_CATEGORIES.map(localStorageKey);
        const preservedLocalValues = await new Promise((resolve) => chrome.storage.local.get(localKeysToKeep, resolve));

        await new Promise((resolve) => chrome.storage.local.clear(resolve));

        if (Object.keys(preservedLocalValues).length) {
            await new Promise((resolve) => chrome.storage.local.set(preservedLocalValues, resolve));
        }

        try {
            await downloadFreshConfigs();
        } catch (e) {
            console.error('Не удалось скачать свежие конфиги:', e);
        }

        location.reload();
    });

    const btn2 = document.getElementById('DIEMONIC_ADS_BLOCK_openBtn');
    btn2.addEventListener('click', () => {
        window.open("https://github.com/BodaIOT/bodaiot.github.io/blob/main/MyADSBlock/BlockADSRules.json", '_blank');
    });

    // LinksToCheck is cached the same way as the other config sections (see downloadFreshConfigs
    // above and DownloadConfigs in content.js), but isn't rendered anywhere in this UI - it only
    // backs this button.
    const btn3 = document.getElementById('DIEMONIC_ADS_BLOCK_openLinksBtn');
    btn3.addEventListener('click', () => {
        chrome.storage.local.get(['DIEMONIC_ADS_BLOCK_LinksToCheck'], (result) => {
            const links = parseConfigList(result.DIEMONIC_ADS_BLOCK_LinksToCheck);
            if (!links.length) {
                // Silent no-op otherwise - this cache key is only populated once a config
                // refresh (button above, or content.js's periodic download) pulls it from the
                // remote rules file, so an empty list here usually means that hasn't happened yet.
                console.warn('DIEMONIC ADS BLOCK: LinksToCheck пуст - нажмите "Обновить конфиги" или дождитесь, пока удалённый файл конфигов будет обновлён.');
                return;
            }
            links.forEach((link) => window.open(link, '_blank'));
        });
    });
});

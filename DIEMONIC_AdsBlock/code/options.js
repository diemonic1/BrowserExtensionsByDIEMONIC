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
            "DIEMONIC_ADS_BLOCK_last_time_update_configs": (new Date()).toString()
        }, resolve));
    }

    const btn = document.getElementById('DIEMONIC_ADS_BLOCK_resetBtn');
    btn.addEventListener('click', async () => {
        btn.disabled = true;
        btn.textContent = 'Обновление...';

        await new Promise((resolve) => chrome.storage.local.clear(resolve));

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
});

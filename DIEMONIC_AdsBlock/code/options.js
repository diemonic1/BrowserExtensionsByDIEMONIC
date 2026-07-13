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
        el.innerHTML = result.DIEMONIC_ADS_BLOCK_last_time_update_configs;
        console.log(result.DIEMONIC_ADS_BLOCK_last_time_update_configs);
    });

    chrome.storage.local.get(['DIEMONIC_ADS_BLOCK_elementsToDelete', 'DIEMONIC_ADS_BLOCK_elementsToCheck',
        'DIEMONIC_ADS_BLOCK_banWords', 'DIEMONIC_ADS_BLOCK_stopWords', 'DIEMONIC_ADS_BLOCK_elementsToHide'], (result) => {
            let s = "";

            let mass = result.DIEMONIC_ADS_BLOCK_elementsToDelete.split(',');
            for (let index = 0; index < mass.length; index++) {
                const element = mass[index];
                s += ("<p>" + (index + 1) + ") " + element + "</p>");
            }
            document.getElementById('DIEMONIC_ADS_BLOCK_elementsToDelete').innerHTML = s;

            s = "";
            mass = result.DIEMONIC_ADS_BLOCK_elementsToCheck.split(',');
            for (let index = 0; index < mass.length; index++) {
                const element = mass[index];
                s += ("<p>" + (index + 1) + ") " + element + "</p>");
            }
            document.getElementById('DIEMONIC_ADS_BLOCK_elementsToCheck').innerHTML = s;

            s = "";
            mass = result.DIEMONIC_ADS_BLOCK_banWords.split(',');
            for (let index = 0; index < mass.length; index++) {
                const element = mass[index];
                s += ("<p>" + (index + 1) + ") " + element + "</p>");
            }
            document.getElementById('DIEMONIC_ADS_BLOCK_banWords').innerHTML = s;

            s = "";
            mass = result.DIEMONIC_ADS_BLOCK_stopWords.split(',');
            for (let index = 0; index < mass.length; index++) {
                const element = mass[index];
                s += ("<p>" + (index + 1) + ") " + element + "</p>");
            }
            document.getElementById('DIEMONIC_ADS_BLOCK_stopWords').innerHTML = s;

            s = "";
            mass = result.DIEMONIC_ADS_BLOCK_elementsToHide.split(',');
            for (let index = 0; index < mass.length; index++) {
                const element = mass[index];
                s += ("<p>" + (index + 1) + ") " + element + "</p>");
            }
            document.getElementById('DIEMONIC_ADS_BLOCK_elementsToHide').innerHTML = s;
        });

    const btn = document.getElementById('DIEMONIC_ADS_BLOCK_resetBtn');
    btn.addEventListener('click', () => {
        chrome.storage.local.clear();

        chrome.storage.local.get(['DIEMONIC_ADS_BLOCK_last_time_update_configs'], (result) => {
            console.log(result.DIEMONIC_ADS_BLOCK_last_time_update_configs);
        });

        location.reload();
    });

    const btn2 = document.getElementById('DIEMONIC_ADS_BLOCK_openBtn');
    btn2.addEventListener('click', () => {
        window.open("https://github.com/BodaIOT/bodaiot.github.io/blob/main/MyADSBlock/BlockADSRules.json", '_blank');
    });
});

(function () {
    window.__diemonicYT = window.__diemonicYT || {};

    // Single logging entry point for every module, gated by the shared "enableLogs" setting
    // and always tagged with this extension's own name (not the name of any of the source extensions).
    window.__diemonicYT.log = function (msg) {
        const settings = window.__diemonicYT.settings;
        if (!settings || !settings.enableLogs) return;

        console.log(
            `%c🚫[${chrome.i18n.getMessage("extName")}] ${msg}`,
            "background: #464646b9; color: #ff459cff",
        );
    };

    // Same tagging convention as log(), but for genuine failures worth surfacing regardless of
    // the "enableLogs" setting (e.g. a UI element that silently never appears) - always shown,
    // via console.error so it's red and shows up under the console's "Errors" filter.
    window.__diemonicYT.logError = function (msg) {
        console.error(
            `%c⛔[${chrome.i18n.getMessage("extName")}] ${msg}`,
            "background: #7a1414; color: #ffffff; font-weight: bold;",
        );
    };
})();

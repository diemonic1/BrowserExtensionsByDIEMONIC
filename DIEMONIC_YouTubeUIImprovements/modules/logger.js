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
})();

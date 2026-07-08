const DEFAULT_SETTINGS = {
    moduleCustomButtonsEnabled: true,
    moduleMediaListenerEnabled: true,
    moduleSidebarButtonsEnabled: true,
    moduleViewProgressEnabled: true,
    showDownloadButton: true,
    showPreviewButton: true,
    protocol: "ytDlpWebExtension://",
    enableLogs: true,
};

chrome.storage.sync.get(DEFAULT_SETTINGS, (settings) => {
    window.__diemonicYT = window.__diemonicYT || {};
    window.__diemonicYT.settings = settings;

    const modules = window.__diemonicYT;

    if (settings.moduleCustomButtonsEnabled && modules.customButtons) {
        modules.customButtons.init(settings);
    }
    if (settings.moduleMediaListenerEnabled && modules.mediaListener) {
        modules.mediaListener.init(settings);
    }
    if (settings.moduleSidebarButtonsEnabled && modules.sidebarButtons) {
        modules.sidebarButtons.init(settings);
    }
    if (settings.moduleViewProgressEnabled && modules.viewProgress) {
        modules.viewProgress.init(settings);
    }
});

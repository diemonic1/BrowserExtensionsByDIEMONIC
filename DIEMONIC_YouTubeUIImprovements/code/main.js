const DEFAULT_SETTINGS = {
    moduleCustomButtonsEnabled: true,
    moduleMediaListenerEnabled: true,
    moduleSidebarButtonsEnabled: true,
    moduleViewProgressEnabled: true,
    moduleRelatedSidebarEnabled: false,
    showDownloadButton: true,
    showPreviewButton: true,
    protocol: "ytDlpWebExtension://",
    enableLogs: true,
    relatedSidebarWidth: 450,
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
    if (settings.moduleRelatedSidebarEnabled && modules.relatedSidebar) {
        modules.relatedSidebar.init(settings);
    }
});

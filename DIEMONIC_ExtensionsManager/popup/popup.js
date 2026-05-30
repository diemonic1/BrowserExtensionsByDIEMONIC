(() => {
    //#region Constants
    const SORT_COLLATOR = new Intl.Collator(undefined, { sensitivity: "base" });
    const CLIENT_VERSION = "133.0.0.0";
    //#endregion

    //#region Elements
    const titleTextEl = document.getElementById("titleText");
    const installedCounterEl = document.getElementById("installedCounter");
    const extensionsListEl = document.getElementById("extensionsList");
    const rowTemplateEl = document.getElementById("extensionRowTemplate");

    const modalBackdropEl = document.getElementById("modalBackdrop");
    const closeModalBtnEl = document.getElementById("closeModalBtn");
    const detailNameEl = document.getElementById("detailName");
    const detailDescriptionEl = document.getElementById("detailDescription");
    const detailVersionEl = document.getElementById("detailVersion");
    const detailTypeEl = document.getElementById("detailType");
    const labelVersionEl = document.getElementById("labelVersion");
    const labelTypeEl = document.getElementById("labelType");

    const storeActionsEl = document.getElementById("storeActions");
    const openStoreBtnEl = document.getElementById("openStoreBtn");
    const copyStoreBtnEl = document.getElementById("copyStoreBtn");
    const copyStoreBtnTextEl = document.getElementById("copyStoreBtnText");

    const optionsActionRowEl = document.getElementById("optionsActionRow");
    const openOptionsBtnEl = document.getElementById("openOptionsBtn");
    const openOptionsBtnTextEl = document.getElementById("openOptionsBtnText");
    const downloadZipBtnEl = document.getElementById("downloadZipBtn");
    const downloadActionsRowEl = downloadZipBtnEl.closest(".actions-row");
    const downloadZipBtnTextEl = document.getElementById("downloadZipBtnText");
    const downloadCrxBtnEl = document.getElementById("downloadCrxBtn");
    const downloadCrxBtnTextEl = document.getElementById("downloadCrxBtnText");
    const uninstallBtnEl = document.getElementById("uninstallBtn");

    const confirmBackdropEl = document.getElementById("confirmBackdrop");
    const confirmTitleEl = document.getElementById("confirmTitle");
    const confirmTextEl = document.getElementById("confirmText");
    const confirmYesBtnEl = document.getElementById("confirmYesBtn");
    const confirmNoBtnEl = document.getElementById("confirmNoBtn");

    const notificationHostEl = document.getElementById("notificationHost");
    //#endregion

    //#region State
    let allExtensions = [];
    let currentDetailsExtension = null;
    let pendingUninstallExtension = null;
    //#endregion

    //#region Localization
    const msg = (key, substitutions) => chrome.i18n.getMessage(key, substitutions) || key;

    function applyStaticTexts() {
        const title = msg("managerTitle");
        titleTextEl.textContent = title;

        labelVersionEl.textContent = msg("labelVersion");
        labelTypeEl.textContent = msg("labelType");

        openStoreBtnEl.textContent = msg("openInStore");
        copyStoreBtnTextEl.textContent = msg("copyStoreUrl");
        openOptionsBtnTextEl.textContent = msg("openSettings");
        downloadZipBtnTextEl.textContent = msg("downloadZip");
        downloadCrxBtnTextEl.textContent = msg("downloadCrx");
        uninstallBtnEl.textContent = msg("uninstall");

        confirmTitleEl.textContent = msg("confirmRemovalTitle");
        confirmNoBtnEl.textContent = msg("cancel");
        confirmYesBtnEl.textContent = msg("confirm");
    }
    //#endregion

    //#region NotificationService
    const NotificationService = {
        show(message, durationMs = 3000) {
            const node = document.createElement("div");
            node.className = "notification";
            node.textContent = message;
            notificationHostEl.appendChild(node);

            window.setTimeout(() => {
                node.remove();
            }, durationMs);
        }
    };
    //#endregion

    //#region Sorting
    function extensionComparator(a, b) {
        if (a.enabled !== b.enabled) {
            return a.enabled ? -1 : 1;
        }

        const aIsDev = isDevelopmentExtension(a);
        const bIsDev = isDevelopmentExtension(b);
        if (aIsDev !== bIsDev) {
            return aIsDev ? -1 : 1;
        }

        return SORT_COLLATOR.compare(a.name || "", b.name || "");
    }

    function isDevelopmentExtension(extension) {
        return extension.installType === "development";
    }
    //#endregion

    //#region StoreAndDownload
    function getStoreUrl(extensionId) {
        return `https://chromewebstore.google.com/detail/${extensionId}`;
    }

    function getCrxDownloadUrl(extensionId) {
        const query = encodeURIComponent(`id=${extensionId}&installsource=ondemand&uc`);
        return `https://clients2.google.com/service/update2/crx?response=redirect&prodversion=${CLIENT_VERSION}&acceptformat=crx2,crx3&x=${query}`;
    }

    async function fetchCrxBuffer(extensionId) {
        const payload = await sendMessageToBackground({
            type: "FETCH_CRX_BASE64",
            extensionId,
            clientVersion: CLIENT_VERSION
        });

        if (!payload || !payload.ok || !payload.base64) {
            throw new Error(msg("downloadFailed"));
        }

        const crxBuffer = base64ToArrayBuffer(payload.base64);
        if (!isCrxBuffer(crxBuffer)) {
            throw new Error(msg("downloadFailed"));
        }

        return crxBuffer;
    }

    function sendMessageToBackground(message) {
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage(message, response => {
                const runtimeError = chrome.runtime.lastError;
                if (runtimeError) {
                    reject(new Error(runtimeError.message));
                    return;
                }

                if (!response) {
                    reject(new Error("Empty response from background"));
                    return;
                }

                resolve(response);
            });
        });
    }

    function base64ToArrayBuffer(base64) {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let index = 0; index < binary.length; index += 1) {
            bytes[index] = binary.charCodeAt(index);
        }

        return bytes.buffer;
    }

    function isCrxBuffer(buffer) {
        const bytes = new Uint8Array(buffer);
        if (bytes.length < 4) {
            return false;
        }

        return String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]) === "Cr24";
    }

    async function downloadCrx(extension) {
        const crxBuffer = await fetchCrxBuffer(extension.id);
        const crxBlob = new Blob([crxBuffer], { type: "application/x-chrome-extension" });
        const objectUrl = URL.createObjectURL(crxBlob);

        try {
            await chrome.downloads.download({
                url: objectUrl,
                filename: buildDownloadFilename(extension, "crx"),
                conflictAction: "uniquify",
                saveAs: true
            });
        } finally {
            URL.revokeObjectURL(objectUrl);
        }
    }

    async function downloadZipFromCrx(extension) {
        const crxBuffer = await fetchCrxBuffer(extension.id);
        const zipBuffer = extractZipPayloadFromCrx(crxBuffer);
        if (!zipBuffer) {
            throw new Error(msg("zipExtractionFailed"));
        }

        const zipBlob = new Blob([zipBuffer], { type: "application/zip" });
        const objectUrl = URL.createObjectURL(zipBlob);

        try {
            await chrome.downloads.download({
                url: objectUrl,
                filename: buildDownloadFilename(extension, "zip"),
                conflictAction: "uniquify",
                saveAs: true
            });
        } finally {
            URL.revokeObjectURL(objectUrl);
        }
    }

    function extractZipPayloadFromCrx(buffer) {
        const bytes = new Uint8Array(buffer);
        if (bytes.length < 16) {
            return null;
        }

        const magic = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
        if (magic !== "Cr24") {
            return null;
        }

        const view = new DataView(buffer);
        const version = view.getUint32(4, true);
        if (version === 2) {
            const publicKeyLength = view.getUint32(8, true);
            const signatureLength = view.getUint32(12, true);
            const zipStart = 16 + publicKeyLength + signatureLength;
            return buffer.slice(zipStart);
        }

        if (version === 3) {
            const headerLength = view.getUint32(8, true);
            const zipStart = 12 + headerLength;
            return buffer.slice(zipStart);
        }

        return null;
    }

    function buildDownloadFilename(extension, ext) {
        const safeName = sanitizeFilenamePart(extension?.name, "extension");
        const safeVersion = sanitizeFilenamePart(extension?.version, "0");
        return `${safeName}-${safeVersion}.${ext}`;
    }

    function sanitizeFilenamePart(value, fallback) {
        const reserved = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;
        const normalized = String(value || "")
            .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_")
            .replace(/\s+/g, " ")
            .replace(/_+/g, "_")
            .trim()
            .replace(/[. ]+$/g, "");

        let result = normalized || fallback;
        if (reserved.test(result)) {
            result = `${fallback}_${result}`;
        }

        return result.slice(0, 110);
    }
    //#endregion

    //#region Rendering
    function updateCounter() {
        installedCounterEl.textContent = `${msg("installedCountHint")} ${allExtensions.length}`;
    }

    function renderList() {
        const sorted = [...allExtensions].sort(extensionComparator);
        const fragment = document.createDocumentFragment();

        sorted.forEach((extension, index) => {
            const node = rowTemplateEl.content.firstElementChild.cloneNode(true);
            node.dataset.id = extension.id;

            const numberEl = node.querySelector(".ext-number");
            const iconEl = node.querySelector(".ext-icon");
            const nameEl = node.querySelector(".ext-name");
            const versionEl = node.querySelector(".ext-version");
            const rowDownloadBtnEl = node.querySelector(".row-download-btn");
            const devBadgeEl = node.querySelector(".dev-badge");
            const settingsBtnEl = node.querySelector(".settings-btn");
            const toggleInputEl = node.querySelector(".toggle-input");
            const toggleLabelEl = node.querySelector(".toggle");
            const rowActionsEl = node.querySelector(".row-actions");

            numberEl.textContent = `${index + 1}.`;
            iconEl.src = pickIconUrl(extension.icons);
            iconEl.alt = extension.name;
            nameEl.textContent = extension.name;
            versionEl.textContent = `${msg("labelVersion")}: ${extension.version}`;

            const isDev = isDevelopmentExtension(extension);
            if (isDev) {
                devBadgeEl.classList.remove("slot-placeholder");
                devBadgeEl.textContent = msg("devBadge");
                rowDownloadBtnEl.classList.add("slot-placeholder");
                rowDownloadBtnEl.onclick = null;
                rowDownloadBtnEl.title = "";
            } else {
                devBadgeEl.classList.add("slot-placeholder");
                devBadgeEl.textContent = msg("devBadge");
                rowDownloadBtnEl.classList.remove("slot-placeholder");
                rowDownloadBtnEl.title = msg("downloadZipArchiveTitle");
                rowDownloadBtnEl.querySelector("img").alt = msg("downloadZip");
                rowDownloadBtnEl.addEventListener("click", async event => {
                    event.stopPropagation();
                    try {
                        await downloadZipFromCrx(extension);
                        NotificationService.show(msg("downloadStarted"));
                    } catch {
                        NotificationService.show(msg("zipExtractionFailed"));
                    }
                });
            }

            settingsBtnEl.title = msg("openSettings");
            settingsBtnEl.querySelector("img").alt = msg("openSettings");
            if (extension.optionsUrl) {
                settingsBtnEl.classList.remove("slot-placeholder");
                settingsBtnEl.addEventListener("click", event => {
                    event.stopPropagation();
                    chrome.tabs.create({ url: extension.optionsUrl });
                });
            } else {
                settingsBtnEl.classList.add("slot-placeholder");
            }

            toggleLabelEl.title = msg("toggleExtension");
            toggleInputEl.checked = !!extension.enabled;
            rowActionsEl.addEventListener("click", event => {
                event.stopPropagation();
            });
            toggleInputEl.addEventListener("click", event => {
                event.stopPropagation();
            });
            toggleInputEl.addEventListener("change", async event => {
                event.stopPropagation();
                await handleToggleExtension(extension.id, event.target.checked);
            });

            node.addEventListener("click", () => {
                openDetailsModal(extension.id);
            });

            fragment.appendChild(node);
        });

        extensionsListEl.replaceChildren(fragment);
    }

    function pickIconUrl(icons = []) {
        if (!Array.isArray(icons) || icons.length === 0) {
            return "../icon/logo.png";
        }

        const sorted = [...icons].sort((a, b) => (b.size || 0) - (a.size || 0));
        return sorted[0].url || "../icon/logo.png";
    }
    //#endregion

    //#region Modal
    function openDetailsModal(extensionId) {
        const extension = allExtensions.find(item => item.id === extensionId);
        if (!extension) {
            return;
        }

        currentDetailsExtension = extension;
        detailNameEl.textContent = extension.name;
        detailDescriptionEl.textContent = (extension.description || "").trim() || msg("noDescription");
        detailVersionEl.textContent = extension.version;
        detailTypeEl.textContent = isDevelopmentExtension(extension) ? msg("typeDev") : msg("typeRegular");

        const storeUrl = getStoreUrl(extension.id);
        const isDev = isDevelopmentExtension(extension);
        if (isDev) {
            storeActionsEl.classList.add("hidden");
            downloadActionsRowEl.classList.add("hidden");
        } else {
            storeActionsEl.classList.remove("hidden");
            downloadActionsRowEl.classList.remove("hidden");
            openStoreBtnEl.onclick = () => chrome.tabs.create({ url: storeUrl });
            copyStoreBtnEl.onclick = async () => {
                try {
                    await navigator.clipboard.writeText(storeUrl);
                    NotificationService.show(msg("copied"));
                } catch {
                    NotificationService.show(msg("copyFailed"));
                }
            };
        }

        if (extension.optionsUrl) {
            optionsActionRowEl.classList.remove("hidden");
            openOptionsBtnEl.onclick = () => chrome.tabs.create({ url: extension.optionsUrl });
        } else {
            optionsActionRowEl.classList.add("hidden");
            openOptionsBtnEl.onclick = null;
        }

        downloadCrxBtnEl.onclick = async () => {
            try {
                await downloadCrx(extension);
                NotificationService.show(msg("downloadStarted"));
            } catch {
                NotificationService.show(msg("downloadFailed"));
            }
        };

        downloadZipBtnEl.onclick = async () => {
            try {
                await downloadZipFromCrx(extension);
                NotificationService.show(msg("downloadStarted"));
            } catch {
                NotificationService.show(msg("zipExtractionFailed"));
            }
        };

        uninstallBtnEl.onclick = () => {
            showUninstallConfirm(extension);
        };

        modalBackdropEl.classList.remove("hidden");
        modalBackdropEl.setAttribute("aria-hidden", "false");
    }

    function closeDetailsModal() {
        currentDetailsExtension = null;
        modalBackdropEl.classList.add("hidden");
        modalBackdropEl.setAttribute("aria-hidden", "true");
    }

    function showUninstallConfirm(extension) {
        pendingUninstallExtension = extension;
        confirmTextEl.textContent = msg("confirmRemovalText", extension.name);
        confirmBackdropEl.classList.remove("hidden");
        confirmBackdropEl.setAttribute("aria-hidden", "false");
    }

    function closeUninstallConfirm() {
        pendingUninstallExtension = null;
        confirmBackdropEl.classList.add("hidden");
        confirmBackdropEl.setAttribute("aria-hidden", "true");
    }
    //#endregion

    //#region Data
    async function loadExtensions() {
        allExtensions = await chrome.management.getAll();
        updateCounter();
        renderList();
    }

    async function handleToggleExtension(extensionId, enabled) {
        try {
            await chrome.management.setEnabled(extensionId, enabled);
            await loadExtensions();
        } catch {
            NotificationService.show(msg("toggleFailed"));
            await loadExtensions();
        }
    }

    async function uninstallExtension(extensionId) {
        try {
            await chrome.management.uninstall(extensionId, { showConfirmDialog: false });
            NotificationService.show(msg("removed"));
            closeUninstallConfirm();
            closeDetailsModal();
            await loadExtensions();
        } catch {
            NotificationService.show(msg("removeFailed"));
        }
    }
    //#endregion

    //#region Events
    closeModalBtnEl.addEventListener("click", closeDetailsModal);
    modalBackdropEl.addEventListener("click", event => {
        if (event.target === modalBackdropEl) {
            closeDetailsModal();
        }
    });

    confirmBackdropEl.addEventListener("click", event => {
        if (event.target === confirmBackdropEl) {
            closeUninstallConfirm();
        }
    });

    confirmNoBtnEl.addEventListener("click", closeUninstallConfirm);
    confirmYesBtnEl.addEventListener("click", async () => {
        if (!pendingUninstallExtension) {
            return;
        }

        await uninstallExtension(pendingUninstallExtension.id);
    });

    chrome.management.onEnabled.addListener(loadExtensions);
    chrome.management.onDisabled.addListener(loadExtensions);
    chrome.management.onInstalled.addListener(loadExtensions);
    chrome.management.onUninstalled.addListener(loadExtensions);

    document.addEventListener("keydown", event => {
        if (event.key === "Escape") {
            if (!confirmBackdropEl.classList.contains("hidden")) {
                closeUninstallConfirm();
                return;
            }

            if (!modalBackdropEl.classList.contains("hidden")) {
                closeDetailsModal();
            }
        }
    });
    //#endregion

    //#region Init
    async function init() {
        applyStaticTexts();
        await loadExtensions();
    }

    init();
    //#endregion
})();

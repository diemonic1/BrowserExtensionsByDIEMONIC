(() => {
    //#region Icon version
    const ICON_VERSIONS = ["v1", "v2", "v3", "v4", "v5", "v6", "v7", "v8", "v9", "v10", "v11"];
    const ICON_SIZES = [16, 32, 48, 64, 128, 256, 512];
    const DEFAULT_ICON_SETTINGS = { iconVersion: "v1" };

    function buildIconPaths(version) {
        const path = {};
        ICON_SIZES.forEach((size) => {
            path[size] = `icon/${version}/${size}.png`;
        });
        return path;
    }

    function applyIconVersion(version) {
        const resolvedVersion = ICON_VERSIONS.includes(version) ? version : DEFAULT_ICON_SETTINGS.iconVersion;
        chrome.action.setIcon({ path: buildIconPaths(resolvedVersion) });
    }

    chrome.storage.sync.get(DEFAULT_ICON_SETTINGS, (settings) => {
        applyIconVersion(settings.iconVersion);
    });

    chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName !== "sync" || !changes.iconVersion) {
            return;
        }

        applyIconVersion(changes.iconVersion.newValue);
    });
    //#endregion

    //#region Helpers
    function getCrxDownloadUrl(extensionId, clientVersion) {
        const query = encodeURIComponent(`id=${extensionId}&installsource=ondemand&uc`);
        return `https://clients2.google.com/service/update2/crx?response=redirect&prodversion=${clientVersion}&acceptformat=crx2,crx3&x=${query}`;
    }

    function arrayBufferToBase64(buffer) {
        const bytes = new Uint8Array(buffer);
        let binary = "";
        const chunkSize = 0x8000;

        for (let offset = 0; offset < bytes.length; offset += chunkSize) {
            const chunk = bytes.subarray(offset, offset + chunkSize);
            binary += String.fromCharCode(...chunk);
        }

        return btoa(binary);
    }

    function isCrxBuffer(buffer) {
        const bytes = new Uint8Array(buffer);
        if (bytes.length < 4) {
            return false;
        }

        return String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]) === "Cr24";
    }
    //#endregion

    //#region Messaging
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
        if (!message || message.type !== "FETCH_CRX_BASE64") {
            return undefined;
        }

        (async () => {
            try {
                const crxUrl = getCrxDownloadUrl(message.extensionId, message.clientVersion || "133.0.0.0");
                const response = await fetch(crxUrl, {
                    method: "GET",
                    redirect: "follow",
                    cache: "no-store"
                });

                if (!response.ok) {
                    sendResponse({ ok: false, error: "Network error" });
                    return;
                }

                const buffer = await response.arrayBuffer();
                if (!isCrxBuffer(buffer)) {
                    sendResponse({ ok: false, error: "Invalid CRX response" });
                    return;
                }

                sendResponse({
                    ok: true,
                    base64: arrayBufferToBase64(buffer)
                });
            } catch (error) {
                sendResponse({
                    ok: false,
                    error: error instanceof Error ? error.message : "Unknown error"
                });
            }
        })();

        return true;
    });
    //#endregion
})();

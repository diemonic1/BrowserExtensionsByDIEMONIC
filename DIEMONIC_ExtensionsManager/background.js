(() => {
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

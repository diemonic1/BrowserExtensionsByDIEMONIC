chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || message.type !== "fetch-cbr-xml") {
        return;
    }

    const url = "https://www.cbr.ru/scripts/XML_daily.asp";

    fetch(url, { cache: "no-store" })
        .then(async (response) => {
            if (!response.ok) {
                sendResponse({ ok: false });
                return;
            }
            const buffer = await response.arrayBuffer();
            const text = new TextDecoder("windows-1251").decode(buffer);
            sendResponse({ ok: true, xml: text });
        })
        .catch(() => {
            sendResponse({ ok: false });
        });

    return true;
});

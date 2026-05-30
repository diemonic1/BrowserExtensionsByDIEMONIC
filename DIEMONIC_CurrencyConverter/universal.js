(function () {
    const TEST_RATES_ERROR_POPUP = false;

    const APP = {
        defaultTtlMinutes: 180,
        minTtlMinutes: 1,
        maxTtlMinutes: 600
    };

    const TOKEN_TO_CODE = {
        "a$": "AUD",
        "aud": "AUD",
        "azn": "AZN",
        "bhd": "BHD",
        "r$": "BRL",
        "brl": "BRL",
        "c$": "CAD",
        "cad": "CAD",
        "chf": "CHF",
        "cny": "CNY",
        "\u5143": "CNY",
        "k\u010d": "CZK",
        "czk": "CZK",
        "dkk": "DKK",
        "kr": "DKK",
        "eur": "EUR",
        "\u20ac": "EUR",
        "gbp": "GBP",
        "\u00a3": "GBP",
        "gel": "GEL",
        "hk$": "HKD",
        "hkd": "HKD",
        "ft": "HUF",
        "huf": "HUF",
        "inr": "INR",
        "\u20b9": "INR",
        "jpy": "JPY",
        "\u00a5": "JPY",
        "kzt": "KZT",
        "\u20b8": "KZT",
        "krw": "KRW",
        "\u20a9": "KRW",
        "nz$": "NZD",
        "nzd": "NZD",
        "pln": "PLN",
        "z\u0142": "PLN",
        "qar": "QAR",
        "ron": "RON",
        "sar": "SAR",
        "s$": "SGD",
        "sgd": "SGD",
        "sek": "SEK",
        "thb": "THB",
        "\u0e3f": "THB",
        "tjs": "TJS",
        "tmt": "TMT",
        "try": "TRY",
        "\u20ba": "TRY",
        "uah": "UAH",
        "\u20b4": "UAH",
        "usd": "USD",
        "$": "USD",
        "vnd": "VND",
        "\u20ab": "VND",
        "zar": "ZAR",
        "rub": "RUB",
        "rur": "RUB",
        "\u20bd": "RUB",
        "\u0440\u0443\u0431": "RUB",
        "\u0440\u0443\u0431.": "RUB"
    };

    const TOKENS = Object.keys(TOKEN_TO_CODE).sort((a, b) => b.length - a.length);

    function sendMessage(message) {
        return new Promise((resolve) => {
            chrome.runtime.sendMessage(message, (response) => {
                if (chrome.runtime.lastError) {
                    resolve({ ok: false, error: chrome.runtime.lastError.message });
                    return;
                }
                resolve(response || { ok: false, error: "No response" });
            });
        });
    }

    function parseNumber(raw) {
        const compact = String(raw || "").replace(/\u00a0/g, " ").replace(/\s+/g, "");
        if (!compact) {
            return null;
        }

        const commaCount = (compact.match(/,/g) || []).length;
        const dotCount = (compact.match(/\./g) || []).length;
        let normalized = compact;

        if (commaCount && dotCount) {
            const lastComma = compact.lastIndexOf(",");
            const lastDot = compact.lastIndexOf(".");
            const decimalSeparator = lastComma > lastDot ? "," : ".";
            const otherSeparator = decimalSeparator === "," ? "." : ",";
            normalized = compact.split(otherSeparator).join("");
            normalized = normalized.replace(decimalSeparator, ".");
        } else if (commaCount) {
            if (commaCount === 1 && /,\d{1,2}$/.test(compact)) {
                normalized = compact.replace(",", ".");
            } else {
                normalized = compact.split(",").join("");
            }
        } else if (dotCount) {
            if (!(dotCount === 1 && /\.\d{1,2}$/.test(compact))) {
                normalized = compact.split(".").join("");
            }
        }

        const value = Number(normalized);
        return Number.isFinite(value) ? value : null;
    }

    function formatAmount(value, suffix) {
        const fixed = Number(value).toFixed(2);
        const parts = fixed.split(".");
        const integer = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, " ");
        const fraction = parts[1] === "00" ? "" : `,${parts[1]}`;
        return `${integer}${fraction} ${suffix}`;
    }

    function formatAmountHtml(value, suffix) {
        const fixed = Number(value).toFixed(2);
        const parts = fixed.split(".");
        const integer = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, " ");
        const fraction = parts[1] === "00" ? "" : `,${parts[1]}`;
        const fractionHtml = fraction ? `<span class="dc-fraction">${fraction}</span>` : "";
        return `${integer}${fractionHtml} ${suffix}`;
    }

    function escapeRegExp(value) {
        return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }

    function parsePriceCandidate(candidate) {
        const text = String(candidate || "").trim();
        if (!text || !/\d/.test(text)) {
            return null;
        }

        for (const token of TOKENS) {
            const code = TOKEN_TO_CODE[token];
            const escaped = escapeRegExp(token);
            const prefixPattern = new RegExp(`^${escaped}\\s*([\\d\\s\\u00a0.,]+)$`, "i");
            const suffixPattern = new RegExp(`^([\\d\\s\\u00a0.,]+)\\s*${escaped}$`, "i");

            const prefixMatch = text.match(prefixPattern);
            if (prefixMatch) {
                const amount = parseNumber(prefixMatch[1]);
                if (amount && amount > 0) {
                    return { amount, code, raw: text };
                }
            }

            const suffixMatch = text.match(suffixPattern);
            if (suffixMatch) {
                const amount = parseNumber(suffixMatch[1]);
                if (amount && amount > 0) {
                    return { amount, code, raw: text };
                }
            }
        }

        return null;
    }

    function extractPriceParts(text) {
        const compact = String(text || "").replace(/\u00a0/g, " ");
        const matches = [];
        const pattern = /([A-Za-z$\u20ac\u00a3\u00a5\u20a9\u20bd\u20b4\u20b8\u20ba\u20ab\u20b9\u0e3f\u5143]{1,7}\s*[\d][\d\s.,]*|[\d][\d\s.,]*\s*[A-Za-z$\u20ac\u00a3\u00a5\u20a9\u20bd\u20b4\u20b8\u20ba\u20ab\u20b9\u0e3f\u5143]{1,7})/g;

        let hit;
        while ((hit = pattern.exec(compact)) !== null) {
            matches.push({
                value: hit[0],
                start: hit.index,
                end: hit.index + hit[0].length
            });
        }

        return matches;
    }

    function isElementVisible(element) {
        if (!element || !element.isConnected) {
            return false;
        }
        if (element.closest("[hidden], [aria-hidden='true']")) {
            return false;
        }
        const style = window.getComputedStyle(element);
        if (style.display === "none" || style.visibility === "hidden" || style.visibility === "collapse") {
            return false;
        }
        return element.getClientRects().length > 0;
    }

    function isTextNodeVisible(node) {
        if (!node || node.nodeType !== Node.TEXT_NODE || !node.parentElement) {
            return false;
        }
        if (!/\S/.test(node.textContent || "")) {
            return false;
        }
        if (!isElementVisible(node.parentElement)) {
            return false;
        }

        const range = document.createRange();
        range.selectNodeContents(node);
        const visible = range.getClientRects().length > 0;
        return visible;
    }

    function buildTooltip() {
        if (!document.getElementById("dc-tooltip-style")) {
            const style = document.createElement("style");
            style.id = "dc-tooltip-style";
            style.textContent = ".dc-price-tooltip .dc-fraction{color:#6d6d6d;}";
            document.documentElement.appendChild(style);
        }

        const tooltip = document.createElement("div");
        tooltip.className = "dc-price-tooltip";
        tooltip.style.position = "fixed";
        tooltip.style.zIndex = "2147483647";
        tooltip.style.pointerEvents = "none";
        tooltip.style.padding = "8px 10px";
        tooltip.style.borderRadius = "10px";
        tooltip.style.background = "rgba(26, 26, 26, 1)";
        tooltip.style.color = "#ececec";
        tooltip.style.border = "1px solid rgba(217, 70, 131, 0.35)";
        tooltip.style.boxShadow = "0 14px 30px rgba(0, 0, 0, 0.35)";
        tooltip.style.font = "600 14px/1.35 Segoe UI, Tahoma, sans-serif";
        tooltip.style.lineHeight = "1.7";
        tooltip.style.display = "none";
        document.documentElement.appendChild(tooltip);
        return tooltip;
    }

    function showRatesErrorPopup(errorText) {
        const existing = document.getElementById("dc-rates-error-popup");
        if (existing) {
            existing.remove();
        }

        if (!document.getElementById("dc-rates-error-popup-style")) {
            const style = document.createElement("style");
            style.id = "dc-rates-error-popup-style";
            style.textContent = [
                ".dc-rates-error-popup{position:fixed;left:16px;bottom:16px;z-index:2147483647;max-width:min(520px,calc(100vw - 32px));background:#1b1014;color:#ffdce8;border:1px solid rgba(255,109,162,.48);border-radius:12px;box-shadow:0 16px 34px rgba(0,0,0,.45);padding:12px 38px 12px 12px;font:600 13px/1.45 Segoe UI,Tahoma,sans-serif;}",
                ".dc-rates-error-close{position:absolute;right:8px;top:6px;border:none;background:transparent;color:#ff9fc6;cursor:pointer;font:700 18px/1 Segoe UI,Tahoma,sans-serif;padding:2px 6px;}",
                ".dc-rates-error-close:hover{color:#ffd9e9;}"
            ].join("");
            document.documentElement.appendChild(style);
        }

        const popup = document.createElement("div");
        popup.id = "dc-rates-error-popup";
        popup.className = "dc-rates-error-popup";

        const close = document.createElement("button");
        close.type = "button";
        close.className = "dc-rates-error-close";
        close.setAttribute("aria-label", "Close notification");
        close.textContent = "\u00d7";

        const text = document.createElement("div");
        text.textContent = `Ошибка загрузки курсов валют: ${errorText}`;

        close.addEventListener("click", () => popup.remove());
        popup.appendChild(close);
        popup.appendChild(text);
        document.documentElement.appendChild(popup);

        window.setTimeout(() => {
            popup.remove();
        }, 15000);
    }

    function showTooltip(tooltip, targetRect, html) {
        tooltip.innerHTML = html;
        tooltip.style.display = "block";

        const spacing = 8;
        const tipRect = tooltip.getBoundingClientRect();
        const showAbove = targetRect.top > tipRect.height + spacing + 4;
        const top = showAbove
            ? targetRect.top - tipRect.height - spacing
            : targetRect.bottom + spacing;

        const desiredLeft = targetRect.left + targetRect.width / 2 - tipRect.width / 2;
        const maxLeft = Math.max(4, window.innerWidth - tipRect.width - 4);
        const left = Math.max(4, Math.min(desiredLeft, maxLeft));

        tooltip.style.top = `${Math.max(4, top)}px`;
        tooltip.style.left = `${left}px`;
    }

    function hideTooltip(tooltip) {
        tooltip.style.display = "none";
    }

    function createConversionText(parsed, rates) {
        if (!parsed || !rates || !rates[parsed.code]) {
            return null;
        }

        if (parsed.code === "RUB") {
            return null;
        }

        const rub = parsed.amount * rates[parsed.code];
        if (!Number.isFinite(rub)) {
            return null;
        }

        if (parsed.code === "USD") {
            return formatAmountHtml(rub, "\u0440\u0443\u0431.");
        }

        if (!rates.USD) {
            return formatAmountHtml(rub, "\u0440\u0443\u0431.");
        }

        const usd = rub / rates.USD;
        return `${formatAmountHtml(rub, "\u0440\u0443\u0431.")}\n${formatAmountHtml(usd, "$")}`;
    }

    async function initUniversalContent() {
        const ratesBundle = await sendMessage({ type: "rates:get" });
        if (TEST_RATES_ERROR_POPUP) {
            showRatesErrorPopup("This popup is running in test mode");
        }

        if (!TEST_RATES_ERROR_POPUP && ratesBundle && ratesBundle.warningError) {
            showRatesErrorPopup(ratesBundle.warningError);
        }

        if (!ratesBundle || !ratesBundle.ok || !ratesBundle.rates) {
            if (!TEST_RATES_ERROR_POPUP) {
                const message = ratesBundle && ratesBundle.error ? ratesBundle.error : "Unknown rates loading error";
                showRatesErrorPopup(message);
            }
            return;
        }

        if (!document.body) {
            return;
        }

        const tooltip = buildTooltip();
        const processed = new WeakSet();

        function bindSpan(span, parsed) {
            if (processed.has(span)) {
                return;
            }
            processed.add(span);

            span.addEventListener("mouseenter", () => {
                const text = createConversionText(parsed, ratesBundle.rates);
                if (!text) {
                    return;
                }
                showTooltip(tooltip, span.getBoundingClientRect(), text.replace(/\n/g, "<br>"));
            });

            span.addEventListener("mouseleave", () => hideTooltip(tooltip));
            span.addEventListener("blur", () => hideTooltip(tooltip));
        }

        function scan(root) {
            const walker = document.createTreeWalker(root || document.body, NodeFilter.SHOW_TEXT);
            const changes = [];
            let node;
            while ((node = walker.nextNode())) {
                if (!node.parentElement) {
                    continue;
                }
                const parent = node.parentElement;
                if (parent.closest("script,style,textarea,code,pre,noscript")) {
                    continue;
                }
                if (parent.closest(".dc-price-target")) {
                    continue;
                }
                if (parent.closest("[data-ext-converted], [data-ext-price-mem]")) {
                    continue;
                }
                const text = node.textContent;
                if (!text || text.length > 2000) {
                    continue;
                }
                if (!isTextNodeVisible(node)) {
                    continue;
                }

                const parts = extractPriceParts(text);
                if (!parts.length) {
                    continue;
                }

                const parsedParts = parts
                    .map((part) => ({ part, parsed: parsePriceCandidate(part.value) }))
                    .filter((item) => item.parsed && item.parsed.code !== "RUB");

                if (parsedParts.length) {
                    changes.push({ node, parsedParts });
                }
            }

            changes.forEach(({ node, parsedParts }) => {
                const source = node.textContent;
                if (!source || !node.parentNode) {
                    return;
                }

                const frag = document.createDocumentFragment();
                let cursor = 0;

                parsedParts.forEach(({ part, parsed }) => {
                    if (part.start < cursor) {
                        return;
                    }
                    const before = source.slice(cursor, part.start);
                    const target = source.slice(part.start, part.end);
                    if (before) {
                        frag.appendChild(document.createTextNode(before));
                    }

                    const span = document.createElement("span");
                    span.className = "dc-price-target";
                    span.textContent = target;
                    span.style.cursor = "help";
                    span.style.textDecoration = "underline dotted rgba(123, 157, 239, 0.7)";
                    span.style.textUnderlineOffset = "2px";
                    span.tabIndex = -1;
                    bindSpan(span, parsed);
                    frag.appendChild(span);

                    cursor = part.end;
                });

                const rest = source.slice(cursor);
                if (rest) {
                    frag.appendChild(document.createTextNode(rest));
                }

                node.parentNode.replaceChild(frag, node);
            });
        }

        scan(document.body);

        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === "childList") {
                    mutation.addedNodes.forEach((added) => {
                        if (added.nodeType === Node.ELEMENT_NODE) {
                            scan(added);
                            return;
                        }
                        if (added.nodeType === Node.TEXT_NODE && added.parentElement) {
                            scan(added.parentElement);
                        }
                    });
                    return;
                }

                if (mutation.type === "attributes" && mutation.target.nodeType === Node.ELEMENT_NODE) {
                    scan(mutation.target);
                    return;
                }

                if (mutation.type === "characterData" && mutation.target.parentElement) {
                    scan(mutation.target.parentElement);
                }
            });
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            characterData: true,
            attributeFilter: ["class", "style", "hidden", "aria-hidden"]
        });
    }

    function toLocalDateString(timestamp) {
        if (!timestamp) {
            return "\u043d\u0435\u0442 \u0434\u0430\u043d\u043d\u044b\u0445";
        }
        return new Date(timestamp).toLocaleString("ru-RU");
    }

    async function initOptionsPage() {
        const ttlSlider = document.getElementById("ttlSlider");
        const ttlValue = document.getElementById("ttlValue");
        const lastUpdate = document.getElementById("lastUpdate");
        const ratesList = document.getElementById("ratesList");

        if (!ttlSlider || !ttlValue || !lastUpdate || !ratesList) {
            return;
        }

        const status = await sendMessage({ type: "rates:status" });
        const ratesResponse = await sendMessage({ type: "rates:get" });

        const ttlMinutes = status && status.ok ? status.ttlMinutes : APP.defaultTtlMinutes;
        ttlSlider.min = String(APP.minTtlMinutes);
        ttlSlider.max = String(APP.maxTtlMinutes);
        ttlSlider.value = String(ttlMinutes);
        ttlValue.textContent = `${ttlMinutes} \u043c\u0438\u043d.`;

        lastUpdate.textContent = toLocalDateString(status?.lastUpdated || ratesResponse?.lastUpdated || 0);

        const ratesMap = ratesResponse && ratesResponse.ok ? ratesResponse.rates : null;
        const ratesMeta = ratesResponse && ratesResponse.ok ? ratesResponse.meta : null;
        const entries = Object.entries(ratesMap || {}).sort((a, b) => a[0].localeCompare(b[0]));
        ratesList.innerHTML = "";

        if (!entries.length) {
            const empty = document.createElement("div");
            empty.className = "empty";
            empty.textContent = "Не удалось загрузить курсы валют.";
            ratesList.appendChild(empty);
        } else {
            entries.forEach(([code, rub]) => {
                const name = ratesMeta && ratesMeta[code] && ratesMeta[code].name
                    ? ratesMeta[code].name
                    : code;
                const row = document.createElement("div");
                row.className = "rate-row";
                row.innerHTML = `<span>${code} - ${name}</span><span>${formatAmount(rub, "\u0440\u0443\u0431.")}</span>`;
                ratesList.appendChild(row);
            });
        }

        ttlSlider.addEventListener("input", () => {
            ttlValue.textContent = `${ttlSlider.value} \u043c\u0438\u043d.`;
        });

        ttlSlider.addEventListener("change", async () => {
            const ttl = Number(ttlSlider.value);
            await sendMessage({ type: "rates:set-ttl", ttlMinutes: ttl });
            const refreshed = await sendMessage({ type: "rates:status" });
            ttlValue.textContent = `${refreshed?.ttlMinutes || ttl} \u043c\u0438\u043d.`;
            lastUpdate.textContent = toLocalDateString(refreshed?.lastUpdated || 0);
        });
    }

    async function initPopupPage() {
        const lastUpdate = document.getElementById("popupLastUpdate");
        const ttl = document.getElementById("popupTtl");
        const openOptions = document.getElementById("openOptions");

        if (!lastUpdate || !ttl || !openOptions) {
            return;
        }

        const status = await sendMessage({ type: "rates:status" });
        lastUpdate.textContent = toLocalDateString(status?.lastUpdated || 0);
        ttl.textContent = `${status?.ttlMinutes || APP.defaultTtlMinutes} \u043c\u0438\u043d.`;

        openOptions.addEventListener("click", () => {
            chrome.runtime.openOptionsPage();
        });
    }

    if (location.protocol === "http:" || location.protocol === "https:") {
        initUniversalContent();
    }

    if (location.pathname.endsWith("options.html")) {
        initOptionsPage();
    }

    if (location.pathname.endsWith("popup.html")) {
        initPopupPage();
    }
})();

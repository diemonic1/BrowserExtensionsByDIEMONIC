const SUPPORTED_URL_PREFIXES = [
    "https://steamdb.info/sub/",
    "https://steamdb.info/app/",
    "https://steamdb.info/bundle/"
];

const TOOLTIP_CURRENCY_MAP = {
    "A$": "AUD", "AZN": "AZN", "BHD": "BHD", "R$": "BRL", "C$": "CAD",
    "CHF": "CHF", "\u5143": "CNY", "K\u010d": "CZK", "kr": "DKK", "\u20ac": "EUR",
    "\u00a3": "GBP", "GEL": "GEL", "HK$": "HKD", "Ft": "HUF", "\u20b9": "INR",
    "\u00a5": "JPY", "\u20b8": "KZT", "\u20a9": "KRW", "NZ$": "NZD", "z\u0142": "PLN",
    "QAR": "QAR", "RON": "RON", "SAR": "SAR", "S$": "SGD", "SEK": "SEK",
    "\u0e3f": "THB", "TJS": "TJS", "TMT": "TMT", "\u20ba": "TRY", "\u20b4": "UAH",
    "$": "USD", "\u20ab": "VND", "ZAR": "ZAR"
};

(async () => {
    const isSupportedPage = SUPPORTED_URL_PREFIXES.some((prefix) => location.href.startsWith(prefix));
    if (!isSupportedPage) {
        return;
    }

    const STORAGE_KEYS = {
        position: "converter_position",
        currency: "converter_currency",
        amount: "converter_amount",
        cbrUnavailable: "converter_cbr_unavailable"
    };

    const CBR_URL = "https://www.cbr.ru/scripts/XML_daily.asp";
    const storageGet = (keys) => new Promise((resolve) => chrome.storage.local.get(keys, resolve));
    const storageSet = (obj) => new Promise((resolve) => chrome.storage.local.set(obj, resolve));
    const sendMessage = (message) => new Promise((resolve) => {
        chrome.runtime.sendMessage(message, (response) => {
            if (chrome.runtime.lastError) {
                resolve({ ok: false });
                return;
            }
            resolve(response || { ok: false });
        });
    });

    const roundToTwo = (value) => Math.round((value + Number.EPSILON) * 100) / 100;

    const formatGroupedNumber = (value) => {
        const fixed = Number(value).toFixed(2);
        const parts = fixed.split(".");
        const integer = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, " ");
        const fraction = parts[1] === "00" ? "" : `,${parts[1]}`;
        return `${integer}${fraction}`;
    };

    const formatRublesHtml = (formattedValue) => {
        const commaIndex = formattedValue.indexOf(",");
        if (commaIndex === -1) {
            return `${formattedValue}\u00a0\u20bd`;
        }
        const integerPart = formattedValue.slice(0, commaIndex);
        const fractionalPart = formattedValue.slice(commaIndex);
        return `${integerPart}<span class="cc-rub-fraction">${fractionalPart}</span>\u00a0\u20bd`;
    };

    const sanitizeInput = (text) => String(text || "").replace(/\D+/g, "");
    const formatInputValue = (text) => sanitizeInput(text).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    const toNumberFromInput = (text) => Number(sanitizeInput(text) || "0");

    const state = {
        ratesMap: null,
        ratesMeta: null,
        selectedCode: "",
        amount: "",
        unavailable: false,
        dragging: false,
        dragOffsetX: 0,
        dragOffsetY: 0
    };

    const ui = {
        root: null,
        dragHandle: null,
        input: null,
        select: null,
        result: null,
        errorLink: null
    };

    const renderResult = () => {
        const rate = state.ratesMap ? state.ratesMap[state.selectedCode] : null;
        if (!rate) {
            ui.result.textContent = "\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u0432\u0430\u043b\u044e\u0442\u0443";
            return;
        }

        const inputNumber = toNumberFromInput(state.amount);
        if (!inputNumber) {
            ui.result.innerHTML = "0\u00a0\u20bd";
            return;
        }

        const converted = roundToTwo(inputNumber * rate);
        ui.result.innerHTML = formatRublesHtml(formatGroupedNumber(converted));
    };

    const savePosition = async () => {
        const x = parseInt(ui.root.style.left, 10);
        const y = parseInt(ui.root.style.top, 10);
        if (Number.isFinite(x) && Number.isFinite(y)) {
            await storageSet({ [STORAGE_KEYS.position]: { x, y } });
        }
    };

    const clampPosition = (x, y) => {
        const maxX = Math.max(0, window.innerWidth - ui.root.offsetWidth);
        const maxY = Math.max(0, window.innerHeight - ui.root.offsetHeight);
        return {
            x: Math.min(Math.max(0, x), maxX),
            y: Math.min(Math.max(0, y), maxY)
        };
    };

    const updateUnavailableState = async (isUnavailable) => {
        state.unavailable = isUnavailable;
        ui.root.classList.toggle("cc-cbr-unavailable", isUnavailable);
        await storageSet({ [STORAGE_KEYS.cbrUnavailable]: isUnavailable });
    };

    const adjustSelectWidth = () => {
        const selectedOption = ui.select.options[ui.select.selectedIndex];
        if (!selectedOption) {
            return;
        }
        const tempDiv = document.createElement("div");
        tempDiv.style.position = "absolute";
        tempDiv.style.visibility = "hidden";
        tempDiv.style.whiteSpace = "nowrap";
        tempDiv.textContent = selectedOption.textContent;
        document.body.appendChild(tempDiv);
        const width = tempDiv.offsetWidth + 2;
        document.body.removeChild(tempDiv);
        ui.select.style.width = `${width}px`;
    };

    const createUI = async () => {
        const saved = await storageGet([
            STORAGE_KEYS.position,
            STORAGE_KEYS.currency,
            STORAGE_KEYS.amount,
            STORAGE_KEYS.cbrUnavailable
        ]);

        state.selectedCode = saved[STORAGE_KEYS.currency] || "";
        state.amount = sanitizeInput(saved[STORAGE_KEYS.amount] || "");
        state.unavailable = Boolean(saved[STORAGE_KEYS.cbrUnavailable]);

        const root = document.createElement("div");
        root.className = "cc-widget";

        const dragHandle = document.createElement("button");
        dragHandle.type = "button";
        dragHandle.className = "cc-drag-handle";
        dragHandle.setAttribute("aria-label", "Move");

        const top = document.createElement("div");
        top.className = "cc-top";

        const inputWrap = document.createElement("div");
        inputWrap.className = "cc-input-wrap";

        const input = document.createElement("input");
        input.className = "cc-input";
        input.type = "text";
        input.inputMode = "numeric";
        input.autocomplete = "off";
        input.placeholder = "Amount";
        input.value = formatInputValue(state.amount);

        const select = document.createElement("select");
        select.className = "cc-select";

        const result = document.createElement("div");
        result.className = "cc-result";

        const errorLink = document.createElement("a");
        errorLink.className = "cc-error-link";
        errorLink.href = CBR_URL;
        errorLink.target = "_blank";
        errorLink.rel = "noopener noreferrer";
        errorLink.textContent = "Could not download currency rates";

        inputWrap.appendChild(input);
        inputWrap.appendChild(select);
        top.appendChild(inputWrap);
        root.appendChild(dragHandle);
        root.appendChild(top);
        root.appendChild(result);
        root.appendChild(errorLink);
        document.body.appendChild(root);

        ui.root = root;
        ui.dragHandle = dragHandle;
        ui.input = input;
        ui.select = select;
        ui.result = result;
        ui.errorLink = errorLink;

        if (saved[STORAGE_KEYS.position] && Number.isFinite(saved[STORAGE_KEYS.position].x) && Number.isFinite(saved[STORAGE_KEYS.position].y)) {
            const clamped = clampPosition(saved[STORAGE_KEYS.position].x, saved[STORAGE_KEYS.position].y);
            ui.root.style.left = `${clamped.x}px`;
            ui.root.style.top = `${clamped.y}px`;
        } else {
            const centeredX = Math.max(0, Math.round((window.innerWidth - ui.root.offsetWidth) / 2));
            const centeredY = Math.max(0, Math.round((window.innerHeight - ui.root.offsetHeight) / 2));
            ui.root.style.left = `${centeredX}px`;
            ui.root.style.top = `${centeredY}px`;
        }

        if (state.unavailable) {
            ui.root.classList.add("cc-cbr-unavailable");
        }

        input.addEventListener("input", async () => {
            const raw = sanitizeInput(input.value);
            state.amount = raw;
            input.value = formatInputValue(raw);
            await storageSet({ [STORAGE_KEYS.amount]: raw });
            renderResult();
        });

        select.addEventListener("change", async () => {
            state.selectedCode = select.value;
            await storageSet({ [STORAGE_KEYS.currency]: state.selectedCode });
            adjustSelectWidth();
            renderResult();
        });

        const onPointerMove = (event) => {
            if (!state.dragging) {
                return;
            }
            const x = event.clientX - state.dragOffsetX;
            const y = event.clientY - state.dragOffsetY;
            const clamped = clampPosition(x, y);
            ui.root.style.left = `${clamped.x}px`;
            ui.root.style.top = `${clamped.y}px`;
        };

        const onPointerUp = async () => {
            if (!state.dragging) {
                return;
            }
            state.dragging = false;
            document.removeEventListener("pointermove", onPointerMove);
            document.removeEventListener("pointerup", onPointerUp);
            await savePosition();
        };

        dragHandle.addEventListener("pointerdown", (event) => {
            event.preventDefault();
            const rect = ui.root.getBoundingClientRect();
            state.dragging = true;
            state.dragOffsetX = event.clientX - rect.left;
            state.dragOffsetY = event.clientY - rect.top;
            document.addEventListener("pointermove", onPointerMove);
            document.addEventListener("pointerup", onPointerUp);
        });

        window.addEventListener("resize", async () => {
            const x = parseInt(ui.root.style.left, 10) || 0;
            const y = parseInt(ui.root.style.top, 10) || 0;
            const clamped = clampPosition(x, y);
            ui.root.style.left = `${clamped.x}px`;
            ui.root.style.top = `${clamped.y}px`;
            await savePosition();
        });
    };

    const fillCurrencies = async () => {
        ui.select.innerHTML = "";
        const codes = Object.keys(state.ratesMap || {}).filter((code) => code !== "RUB").sort();
        codes.forEach((code) => {
            const option = document.createElement("option");
            const name = state.ratesMeta && state.ratesMeta[code] ? state.ratesMeta[code].name : code;
            option.value = code;
            option.textContent = `${name} (${code})`;
            ui.select.appendChild(option);
        });

        const fallbackCode = codes.includes("USD") ? "USD" : (codes[0] || "");
        if (!state.selectedCode || !codes.includes(state.selectedCode)) {
            state.selectedCode = fallbackCode;
            await storageSet({ [STORAGE_KEYS.currency]: state.selectedCode });
        }

        ui.select.value = state.selectedCode;
        adjustSelectWidth();
    };

    const loadRates = async () => {
        const bundle = await sendMessage({ type: "rates:get" });
        if (!bundle || !bundle.ok || !bundle.rates) {
            await updateUnavailableState(true);
            ui.result.textContent = "No data";
            return;
        }

        state.ratesMap = bundle.rates;
        state.ratesMeta = bundle.meta || {};
        await fillCurrencies();
        await updateUnavailableState(bundle.source === "stale-cache" || bundle.source === "fallback-cache");
        renderResult();
    };

    const parseTooltipPrice = (text) => {
        const match = String(text || "").trim().match(/^([^\d]*?)([\d\s\u00a0,.]+)([^\d]*)$/);
        if (!match) {
            return null;
        }
        const prefix = match[1].trim();
        const suffix = match[3].trim();
        const symbol = prefix || suffix;
        const code = TOOLTIP_CURRENCY_MAP[symbol] || null;
        if (!code) {
            return null;
        }

        const numStr = match[2].replace(/[\s\u00a0]/g, "").replace(",", ".");
        const amount = Number(numStr);
        if (!Number.isFinite(amount) || amount <= 0) {
            return null;
        }
        return { amount, code };
    };

    const convertTooltipPrice = (text) => {
        const parsed = parseTooltipPrice(text);
        if (!parsed || !state.ratesMap || !state.ratesMap[parsed.code]) {
            return null;
        }
        return formatGroupedNumber(roundToTwo(parsed.amount * state.ratesMap[parsed.code]));
    };

    const tryApplyPriceConversion = (nodes, textMatcher, additionalClass) => {
        for (let i = 0; i < nodes.length; i += 1) {
            const node = nodes[i];
            if (node.nodeType !== Node.TEXT_NODE || !textMatcher(node.textContent)) {
                continue;
            }
            const bEl = nodes[i + 1];
            if (!bEl || bEl.tagName !== "B") {
                continue;
            }

            const rubles = convertTooltipPrice(bEl.textContent);
            if (rubles !== null) {
                const injected = document.createElement("span");
                injected.className = "cc-tooltip-rub";
                if (additionalClass) {
                    injected.classList.add(additionalClass);
                }
                injected.innerHTML = `<b>${formatRublesHtml(rubles)}</b>`;
                bEl.after(injected);
            }
            return true;
        }
        return false;
    };

    const processTooltipSpan = (span) => {
        span.querySelectorAll(".cc-tooltip-rub").forEach((el) => el.remove());
        const nodes = Array.from(span.childNodes);
        if (tryApplyPriceConversion(nodes, (text) => String(text).includes("Discounted price:"), "cc-tooltip-rub-bottom")) {
            return;
        }
        tryApplyPriceConversion(nodes, (text) => {
            const t = String(text);
            return t.includes("Price:") || t.includes("price:");
        });
    };

    const initTooltipObserver = () => {
        const observeTooltipSpan = (tooltip) => {
            const span = tooltip.querySelector("span");
            if (!span) {
                return;
            }

            processTooltipSpan(span);
            const observer = new MutationObserver(() => {
                observer.disconnect();
                processTooltipSpan(span);
                observer.observe(span, { childList: true, subtree: true, characterData: true });
            });
            observer.observe(span, { childList: true, subtree: true, characterData: true });
        };

        const attachToRoot = (root) => {
            const existingTooltip = root.querySelector("div.highcharts-tooltip");
            if (existingTooltip) {
                setTimeout(() => observeTooltipSpan(existingTooltip), 20);
                return;
            }

            const rootObserver = new MutationObserver((mutations, obs) => {
                for (const mutation of mutations) {
                    for (const added of mutation.addedNodes) {
                        if (added.nodeType !== Node.ELEMENT_NODE) {
                            continue;
                        }
                        const found = (added.tagName === "DIV" && added.classList?.contains("highcharts-tooltip"))
                            ? added
                            : added.querySelector?.("div.highcharts-tooltip");
                        if (found) {
                            obs.disconnect();
                            setTimeout(() => observeTooltipSpan(found), 20);
                            return;
                        }
                    }
                }
            });
            rootObserver.observe(root, { childList: true, subtree: true });
        };

        document.querySelectorAll(".chart-container").forEach(attachToRoot);
        const bodyObserver = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                for (const added of mutation.addedNodes) {
                    if (added.nodeType !== Node.ELEMENT_NODE) {
                        continue;
                    }
                    if (added.classList?.contains("chart-container")) {
                        attachToRoot(added);
                    }
                    added.querySelectorAll?.(".chart-container").forEach(attachToRoot);
                }
            }
        });
        bodyObserver.observe(document.body, { childList: true, subtree: true });
    };

    await createUI();
    await loadRates();
    initTooltipObserver();
})();

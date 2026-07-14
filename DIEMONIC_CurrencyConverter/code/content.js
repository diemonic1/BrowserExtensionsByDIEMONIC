const SUPPORTED_URL_PREFIXES = [
    "https://steamdb.info/sub/",
    "https://steamdb.info/app/",
    "https://steamdb.info/bundle/"
];

const TOOLTIP_CURRENCY_MAP = {
    "A$": "AUD", "AZN": "AZN", "BHD": "BHD", "R$": "BRL", "C$": "CAD",
    "BRL": "BRL", "CAD": "CAD", "CHF": "CHF", "CNY": "CNY", "\u5143": "CNY",
    "CZK": "CZK", "K\u010d": "CZK", "DKK": "DKK", "kr": "DKK", "EUR": "EUR", "\u20ac": "EUR",
    "GBP": "GBP", "\u00a3": "GBP", "GEL": "GEL", "HK$": "HKD", "HKD": "HKD", "HUF": "HUF", "Ft": "HUF",
    "INR": "INR", "\u20b9": "INR", "JPY": "JPY", "\u00a5": "JPY", "KZT": "KZT", "\u20b8": "KZT",
    "KRW": "KRW", "\u20a9": "KRW", "NZ$": "NZD", "NZD": "NZD", "PLN": "PLN", "z\u0142": "PLN",
    "QAR": "QAR", "RON": "RON", "SAR": "SAR", "S$": "SGD", "SGD": "SGD", "SEK": "SEK",
    "THB": "THB", "\u0e3f": "THB", "TJS": "TJS", "TMT": "TMT", "TRY": "TRY", "\u20ba": "TRY",
    "UAH": "UAH", "\u20b4": "UAH", "USD": "USD", "\u0024": "USD", "$": "USD", "VND": "VND", "\u20ab": "VND",
    "ZAR": "ZAR", "RUB": "RUB", "RUR": "RUB", "\u20bd": "RUB", "\u0440\u0443\u0431": "RUB", "\u0440\u0443\u0431.": "RUB",
    "\u0434\u043e\u043b\u043b\u0430\u0440": "USD", "\u0434\u043e\u043b\u043b\u0430\u0440\u0430": "USD", "\u0434\u043e\u043b\u043b\u0430\u0440\u043e\u0432": "USD",
    "\u0442\u0435\u043d\u0433\u0435": "KZT",
    "долларов": "USD", "доллар": "USD",
    "долларов": "USD", "доллара": "USD", "доллару": "USD", "долларом": "USD",
};

const TOOLTIP_CURRENCY_TOKENS = Object.keys(TOOLTIP_CURRENCY_MAP).sort((a, b) => b.length - a.length);

const TOOLTIP_REFRESH_INTERVAL_MS = 16;
const TOOLTIP_CURSOR_OFFSET_X = -40;
const TOOLTIP_CURSOR_OFFSET_Y = -120;

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
        dragOffsetY: 0,
        cursorClientX: null,
        cursorClientY: null
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
        const normalized = String(text || "").trim().replace(/\u00a0/g, " ");
        if (!normalized || !/\d/.test(normalized)) {
            return null;
        }

        for (const token of TOOLTIP_CURRENCY_TOKENS) {
            const code = TOOLTIP_CURRENCY_MAP[token];
            const escapedToken = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            const prefixMatch = normalized.match(new RegExp(`^${escapedToken}\\s*([\\d\\s.,]+)$`, "i"));
            if (prefixMatch) {
                const amount = Number(prefixMatch[1].replace(/[\s]/g, "").replace(",", "."));
                if (Number.isFinite(amount) && amount > 0) {
                    return { amount, code };
                }
            }

            const suffixMatch = normalized.match(new RegExp(`^([\\d\\s.,]+)\\s*${escapedToken}$`, "i"));
            if (suffixMatch) {
                const amount = Number(suffixMatch[1].replace(/[\s]/g, "").replace(",", "."));
                if (Number.isFinite(amount) && amount > 0) {
                    return { amount, code };
                }
            }
        }

        return null;
    };

    const convertTooltipPrice = (text) => {
        const parsed = parseTooltipPrice(text);
        if (!parsed || !state.ratesMap || !state.ratesMap[parsed.code]) {
            return null;
        }
        return formatGroupedNumber(roundToTwo(parsed.amount * state.ratesMap[parsed.code]));
    };

    const clearTooltipOverlays = () => {
        document.querySelectorAll(".cc-tooltip-rub").forEach((el) => el.remove());
    };

    const isTooltipHidden = (tooltip) => {
        if (!tooltip || tooltip.nodeType !== Node.ELEMENT_NODE) {
            return true;
        }

        const visibilityAttr = tooltip.getAttribute("visibility");
        if (visibilityAttr === "hidden" || visibilityAttr === "collapse") {
            return true;
        }

        const style = window.getComputedStyle(tooltip);
        return style.visibility === "hidden" || style.visibility === "collapse" || style.display === "none" || style.opacity === "0";
    };

    const splitTooltipLines = (contentRoot) => {
        const lines = [];
        let currentLine = [];

        Array.from(contentRoot.childNodes).forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE && node.tagName === "BR") {
                if (currentLine.length) {
                    lines.push(currentLine);
                    currentLine = [];
                }
                return;
            }
            currentLine.push(node);
        });

        if (currentLine.length) {
            lines.push(currentLine);
        }

        return lines;
    };

    const getTooltipLinePriceElement = (lineNodes) => {
        for (const node of lineNodes) {
            if (node.nodeType !== Node.ELEMENT_NODE) {
                continue;
            }
            if (node.tagName === "B") {
                return node;
            }
            const nestedBold = node.querySelector?.("b");
            if (nestedBold) {
                return nestedBold;
            }
        }
        return null;
    };

    const tryApplyPriceConversion = (lineNodes, textMatcher, additionalClass) => {
        const lineText = lineNodes.map((node) => node.textContent || "").join("").trim();
        if (!textMatcher(lineText)) {
            return false;
        }

        const priceElement = getTooltipLinePriceElement(lineNodes);
        if (!priceElement) {
            return false;
        }

        const rubles = convertTooltipPrice(priceElement.textContent);
        if (rubles === null) {
            return true;
        }

        const injected = document.createElement("span");
        injected.className = "cc-tooltip-rub";
        if (additionalClass) {
            injected.classList.add(additionalClass);
        }
        injected.innerHTML = formatRublesHtml(rubles);

        const fallbackRect = priceElement.getBoundingClientRect();
        const cursorX = state.cursorClientX ?? fallbackRect.left;
        const cursorY = state.cursorClientY ?? fallbackRect.top;

        injected.style.left = `${Math.round(cursorX + TOOLTIP_CURSOR_OFFSET_X)}px`;
        if (additionalClass) {
            injected.style.top = `${Math.round(cursorY - 4 + TOOLTIP_CURSOR_OFFSET_Y)}px`;
        } else {
            injected.style.top = `${Math.round(cursorY + 4 + TOOLTIP_CURSOR_OFFSET_Y)}px`;
        }

        document.body.appendChild(injected);
        return true;
    };

    const processTooltipContent = (contentRoot, tooltip) => {
        if (isTooltipHidden(tooltip)) {
            clearTooltipOverlays();
            return;
        }

        clearTooltipOverlays();
        const lines = splitTooltipLines(contentRoot);
        if (lines.some((lineNodes) => tryApplyPriceConversion(lineNodes, (text) => text.includes("Discounted price:"), "cc-tooltip-rub-bottom"))) {
            return;
        }
        lines.some((lineNodes) => tryApplyPriceConversion(lineNodes, (text) => {
            return text.includes("Initial price:") || text.includes("Price:") || text.includes("price:");
        }));
    };

    const initTooltipObserver = () => {
        const observedRoots = new WeakSet();
        const observedTooltips = new WeakSet();
        const observedPanels = new WeakSet();

        const getTooltipContentRoot = (tooltip) => {
            if (!tooltip || tooltip.nodeType !== Node.ELEMENT_NODE) {
                return null;
            }

            return tooltip.querySelector("foreignObject body > div")
                || tooltip.querySelector("foreignObject div[data-z-index='1']")
                || tooltip.querySelector("span");
        };

        const observeTooltipContent = (tooltip) => {
            if (!tooltip || observedTooltips.has(tooltip)) {
                return;
            }

            const contentRoot = getTooltipContentRoot(tooltip);
            if (!contentRoot) {
                return;
            }

            observedTooltips.add(tooltip);
            processTooltipContent(contentRoot, tooltip);

            const tooltipObserver = new MutationObserver(() => {
                processTooltipContent(contentRoot, tooltip);
            });
            tooltipObserver.observe(tooltip, { attributes: true, attributeFilter: ["visibility", "style", "class", "opacity", "transform"] });

            if (observedRoots.has(contentRoot)) {
                return;
            }

            observedRoots.add(contentRoot);
            const observer = new MutationObserver(() => {
                observer.disconnect();
                processTooltipContent(contentRoot, tooltip);
                observer.observe(contentRoot, { childList: true, subtree: true, characterData: true });
            });
            observer.observe(contentRoot, { childList: true, subtree: true, characterData: true });
        };

        const processAllTooltips = () => {
            document.querySelectorAll(".highcharts-tooltip").forEach((tooltip) => {
                observeTooltipContent(tooltip);
            });
        };

        let refreshTimeoutId = null;
        const scheduleTooltipRefresh = () => {
            if (refreshTimeoutId !== null) {
                return;
            }
            refreshTimeoutId = window.setTimeout(() => {
                refreshTimeoutId = null;
                processAllTooltips();
            }, TOOLTIP_REFRESH_INTERVAL_MS);
        };

        const observeTabPanel = (panel) => {
            if (!panel || observedPanels.has(panel)) {
                return;
            }

            observedPanels.add(panel);
            panel.addEventListener("pointermove", (event) => {
                state.cursorClientX = event.clientX;
                state.cursorClientY = event.clientY;
                scheduleTooltipRefresh();
            }, { passive: true });
            const panelObserver = new MutationObserver(() => {
                scheduleTooltipRefresh();
            });
            panelObserver.observe(panel, { childList: true, subtree: true, characterData: true });
        };

        const attachTabPanelObservers = (root = document) => {
            if (root.nodeType !== Node.ELEMENT_NODE && root !== document) {
                return;
            }

            if (root instanceof Element && root.matches("[role='tabpanel']")) {
                observeTabPanel(root);
            }

            root.querySelectorAll?.("[role='tabpanel']").forEach(observeTabPanel);
        };

        processAllTooltips();
        attachTabPanelObservers();

        // The tabpanel-scoped listeners above only exist on pages that actually render a
        // [role="tabpanel"] wrapper (e.g. app pages with multiple tabs). Bundle/sub pages don't
        // have one at all, so without a page-wide fallback, processAllTooltips() only ever runs
        // once at load - before Highcharts has even created the tooltip element on hover - and
        // never gets a chance to re-scan and discover it afterwards. A document-level listener
        // works everywhere regardless of page layout.
        document.addEventListener("pointermove", (event) => {
            state.cursorClientX = event.clientX;
            state.cursorClientY = event.clientY;
            scheduleTooltipRefresh();
        }, { passive: true });

        const pageObserver = new MutationObserver((mutations) => {
            let hasAddedElement = false;
            for (const mutation of mutations) {
                for (const addedNode of mutation.addedNodes) {
                    if (addedNode.nodeType !== Node.ELEMENT_NODE) {
                        continue;
                    }
                    hasAddedElement = true;
                    attachTabPanelObservers(addedNode);
                }
            }
            if (hasAddedElement) {
                scheduleTooltipRefresh();
            }
        });
        pageObserver.observe(document.body, { childList: true, subtree: true });
    };

    await createUI();
    await loadRates();
    initTooltipObserver();
})();

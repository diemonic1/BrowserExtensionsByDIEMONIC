const CBR_URL = "https://www.cbr.ru/scripts/XML_daily.asp";
const STORAGE_KEYS = {
    ratesMap: "cc_rates_map",
    ratesMeta: "cc_rates_meta",
    lastUpdated: "cc_last_updated",
    ttlMinutes: "cc_ttl_minutes"
};

const DEFAULT_TTL_MINUTES = 180;
const MIN_TTL_MINUTES = 1;
const MAX_TTL_MINUTES = 600;

const memory = {
    ratesMap: null,
    ratesMeta: null,
    lastUpdated: 0,
    ttlMinutes: DEFAULT_TTL_MINUTES,
    loaded: false
};

const storageGet = (keys) => new Promise((resolve) => chrome.storage.local.get(keys, resolve));
const storageSet = (obj) => new Promise((resolve) => chrome.storage.local.set(obj, resolve));

function clampTtl(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) {
        return DEFAULT_TTL_MINUTES;
    }
    return Math.min(MAX_TTL_MINUTES, Math.max(MIN_TTL_MINUTES, Math.round(num)));
}

function parseCbrNumber(value) {
    return Number(String(value || "").replace(/\s+/g, "").replace(",", "."));
}

function extractTag(block, tagName) {
    const match = block.match(new RegExp(`<${tagName}>([\\s\\S]*?)<\\/${tagName}>`, "i"));
    return match ? match[1].trim() : "";
}

function parseCbrXml(xmlText) {
    const blocks = String(xmlText || "").match(/<Valute[^>]*>[\s\S]*?<\/Valute>/gi) || [];
    const ratesMap = { RUB: 1 };
    const ratesMeta = { RUB: { code: "RUB", name: "Russian Ruble", ratePerUnit: 1 } };

    blocks.forEach((block) => {
        const code = extractTag(block, "CharCode");
        const name = extractTag(block, "Name");
        const nominal = parseCbrNumber(extractTag(block, "Nominal"));
        const value = parseCbrNumber(extractTag(block, "Value"));

        if (!code || !name || !nominal || !value) {
            return;
        }

        const ratePerUnit = value / nominal;
        if (!Number.isFinite(ratePerUnit) || ratePerUnit <= 0) {
            return;
        }

        ratesMap[code] = ratePerUnit;
        ratesMeta[code] = { code, name, ratePerUnit };
    });

    return { ratesMap, ratesMeta };
}

function isFresh(lastUpdated, ttlMinutes) {
    if (!lastUpdated || !ttlMinutes) {
        return false;
    }
    return Date.now() - lastUpdated < ttlMinutes * 60 * 1000;
}

async function loadMemoryFromStorage() {
    if (memory.loaded) {
        return;
    }
    const data = await storageGet([
        STORAGE_KEYS.ratesMap,
        STORAGE_KEYS.ratesMeta,
        STORAGE_KEYS.lastUpdated,
        STORAGE_KEYS.ttlMinutes
    ]);

    memory.ratesMap = data[STORAGE_KEYS.ratesMap] || null;
    memory.ratesMeta = data[STORAGE_KEYS.ratesMeta] || null;
    memory.lastUpdated = Number(data[STORAGE_KEYS.lastUpdated] || 0);
    memory.ttlMinutes = clampTtl(data[STORAGE_KEYS.ttlMinutes] || DEFAULT_TTL_MINUTES);
    memory.loaded = true;
}

async function persistMemory() {
    await storageSet({
        [STORAGE_KEYS.ratesMap]: memory.ratesMap,
        [STORAGE_KEYS.ratesMeta]: memory.ratesMeta,
        [STORAGE_KEYS.lastUpdated]: memory.lastUpdated,
        [STORAGE_KEYS.ttlMinutes]: memory.ttlMinutes
    });
}

async function fetchRatesFromCbr() {
    const response = await fetch(CBR_URL, { cache: "no-store" });
    if (!response.ok) {
        throw new Error(`CBR request failed: HTTP ${response.status}`);
    }

    const buffer = await response.arrayBuffer();
    const xmlText = new TextDecoder("windows-1251").decode(buffer);
    const parsed = parseCbrXml(xmlText);

    if (!parsed || !parsed.ratesMap || !parsed.ratesMap.USD) {
        throw new Error("CBR parse failed: USD rate was not found");
    }

    memory.ratesMap = parsed.ratesMap;
    memory.ratesMeta = parsed.ratesMeta;
    memory.lastUpdated = Date.now();
    await persistMemory();
}

async function getRatesBundle(forceUpdate) {
    await loadMemoryFromStorage();

    if (!forceUpdate && memory.ratesMap && isFresh(memory.lastUpdated, memory.ttlMinutes)) {
        return {
            ok: true,
            rates: memory.ratesMap,
            meta: memory.ratesMeta || {},
            lastUpdated: memory.lastUpdated,
            ttlMinutes: memory.ttlMinutes,
            source: "memory"
        };
    }

    if (!forceUpdate && memory.ratesMap && !isFresh(memory.lastUpdated, memory.ttlMinutes)) {
        try {
            await fetchRatesFromCbr();
        } catch (error) {
            const errorMessage = error && error.message ? error.message : "Unknown CBR error";
            return {
                ok: true,
                rates: memory.ratesMap,
                meta: memory.ratesMeta || {},
                lastUpdated: memory.lastUpdated,
                ttlMinutes: memory.ttlMinutes,
                source: "stale-cache",
                warningError: errorMessage
            };
        }
    } else if (forceUpdate || !memory.ratesMap) {
        try {
            await fetchRatesFromCbr();
        } catch (error) {
            const errorMessage = error && error.message ? error.message : "Unknown CBR error";
            if (memory.ratesMap) {
                return {
                    ok: true,
                    rates: memory.ratesMap,
                    meta: memory.ratesMeta || {},
                    lastUpdated: memory.lastUpdated,
                    ttlMinutes: memory.ttlMinutes,
                    source: "fallback-cache",
                    warningError: errorMessage
                };
            }
            return { ok: false, error: errorMessage };
        }
    }

    return {
        ok: true,
        rates: memory.ratesMap,
        meta: memory.ratesMeta || {},
        lastUpdated: memory.lastUpdated,
        ttlMinutes: memory.ttlMinutes,
        source: "network"
    };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || !message.type) {
        return;
    }

    if (message.type === "rates:get") {
        getRatesBundle(Boolean(message.force)).then(sendResponse);
        return true;
    }

    if (message.type === "rates:status") {
        loadMemoryFromStorage().then(() => {
            sendResponse({
                ok: true,
                lastUpdated: memory.lastUpdated,
                ttlMinutes: memory.ttlMinutes
            });
        });
        return true;
    }

    if (message.type === "rates:set-ttl") {
        loadMemoryFromStorage().then(async () => {
            memory.ttlMinutes = clampTtl(message.ttlMinutes);
            await persistMemory();
            sendResponse({ ok: true, ttlMinutes: memory.ttlMinutes });
        });
        return true;
    }
});

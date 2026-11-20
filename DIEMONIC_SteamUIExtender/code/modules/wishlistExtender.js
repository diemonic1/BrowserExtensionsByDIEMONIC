(function () {
    function isSteamWishlistPage() {
        return /^https:\/\/store\.steampowered\.com\/wishlist\//.test(window.location.href);
    }

    function getSteamAppIdFromHref(href) {
        const match = href.match(/^https:\/\/store\.steampowered\.com\/app\/(\d+)(?:\/|$|[?#])/);
        return match ? match[1] : null;
    }

    const BUTTON_CLASS = 'diemonic-ea-button';

    const EARLY_ACCESS_TEXT_RE = /^(ранний доступ|early access)$/i;
    const RELEASE_DATE_LABEL_RE = /^(дата выхода|release date)\s*:?$/i;
    const DATE_ADDED_TEXT_RE = /^(дата добавления|date added|added on)/i;

    const MONTH_NAME_INDEX = {
        jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
        jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
        'янв': 0, 'фев': 1, 'мар': 2, 'апр': 3, 'май': 4, 'мая': 4, 'июн': 5,
        'июл': 6, 'авг': 7, 'сен': 8, 'окт': 9, 'ноя': 10, 'дек': 11,
    };

    function monthIndex(name) {
        return MONTH_NAME_INDEX[name.toLowerCase().slice(0, 3)];
    }

    function buildValidDate(year, month0, day) {
        if (month0 === undefined) {
            return null;
        }

        const parsedDate = new Date(year, month0, day);
        if (
            Number.isNaN(parsedDate.getTime()) ||
            parsedDate.getFullYear() !== year ||
            parsedDate.getMonth() !== month0 ||
            parsedDate.getDate() !== day
        ) {
            return null;
        }

        return parsedDate;
    }

    // Only full dates (day + month + year) are accepted. "Q1 2027", "2026", "Coming soon"
    // and similar values mean the game is not out yet.
    const DATE_EXTRACTORS = [
        // dd.mm.yyyy
        {
            re: /(?:^|\D)(\d{1,2})\.(\d{1,2})\.(\d{4})(?:\D|$)/,
            build: (m) => buildValidDate(Number(m[3]), Number(m[2]) - 1, Number(m[1])),
        },
        // mm/dd/yyyy (US numeric)
        {
            re: /(?:^|\D)(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\D|$)/,
            build: (m) => buildValidDate(Number(m[3]), Number(m[1]) - 1, Number(m[2])),
        },
        // "10 июн. 2026 г." / "10 июня 2026"
        {
            re: /(\d{1,2})\s+([а-яё]{3,})\.?\s+(\d{4})/i,
            build: (m) => buildValidDate(Number(m[3]), monthIndex(m[2]), Number(m[1])),
        },
        // "Jun 10, 2026" / "June 10 2026"
        {
            re: /\b([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})\b/,
            build: (m) => buildValidDate(Number(m[3]), monthIndex(m[1]), Number(m[2])),
        },
        // "10 Jun, 2026" / "10 June 2026"
        {
            re: /\b(\d{1,2})\s+([A-Za-z]{3,9})\.?,?\s+(\d{4})\b/,
            build: (m) => buildValidDate(Number(m[3]), monthIndex(m[2]), Number(m[1])),
        },
    ];

    function parseReleaseDate(text) {
        const normalized = (text || '').replace(/\s+/g, ' ').trim();
        for (const extractor of DATE_EXTRACTORS) {
            const match = normalized.match(extractor.re);
            if (!match) {
                continue;
            }

            const parsedDate = extractor.build(match);
            if (parsedDate) {
                return parsedDate;
            }
        }

        return null;
    }

    function isPastOrTodayDate(dateValue) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const normalized = new Date(dateValue);
        normalized.setHours(0, 0, 0, 0);

        return normalized.getTime() <= today.getTime();
    }

    function leafText(element) {
        return (element.textContent || '').replace(/\s+/g, ' ').trim();
    }

    function hasEarlyAccessBadge(row) {
        for (const span of row.querySelectorAll('span')) {
            if (span.classList.contains(BUTTON_CLASS) || span.children.length > 0) {
                continue;
            }

            if (EARLY_ACCESS_TEXT_RE.test(leafText(span))) {
                return true;
            }
        }

        return false;
    }

    // The button goes right before the "Date added: ..." text in the row's top-right corner,
    // so it never covers the game's title, categories or Steam's own tags.
    function findDateAddedElement(row) {
        for (const element of row.querySelectorAll('div, span')) {
            if (element.children.length === 0 && DATE_ADDED_TEXT_RE.test(leafText(element))) {
                return element;
            }
        }

        return null;
    }

    function isReleased(row) {
        for (const element of row.querySelectorAll('div, span')) {
            if (element.children.length > 0 || !RELEASE_DATE_LABEL_RE.test(leafText(element))) {
                continue;
            }

            const valueElement = element.nextElementSibling;
            if (!valueElement) {
                return false;
            }

            const releaseDate = parseReleaseDate(valueElement.textContent);
            return Boolean(releaseDate) && isPastOrTodayDate(releaseDate);
        }

        return false;
    }

    function getRowAppId(row) {
        const link = row.querySelector('a[href^="https://store.steampowered.com/app/"]');
        return link ? getSteamAppIdFromHref(link.href) : null;
    }

    function stopEvent(event) {
        event.stopPropagation();
    }

    function createEarlyAccessButton(appId) {
        const button = document.createElement('span');
        button.className = BUTTON_CLASS;
        button.textContent = chrome.i18n.getMessage("earlyAccessLabel");
        button.title = chrome.i18n.getMessage("openNewsTooltip");
        button.dataset.appId = appId;
        button.setAttribute('role', 'link');

        button.addEventListener('mousedown', stopEvent);
        button.addEventListener('pointerdown', stopEvent);
        button.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            window.open(`https://store.steampowered.com/news/app/${appId}`, '_blank');
        });

        return button;
    }

    function removeButtons(buttons) {
        buttons.forEach((button) => button.remove());
    }

    function processRow(row) {
        const appId = getRowAppId(row);
        const anchor = appId && hasEarlyAccessBadge(row) && isReleased(row) ? findDateAddedElement(row) : null;

        const buttons = Array.from(row.querySelectorAll(`.${BUTTON_CLASS}`));

        if (!anchor) {
            removeButtons(buttons);
            return;
        }

        const existing = buttons.length === 1 ? buttons[0] : null;
        const isUpToDate =
            existing &&
            existing.dataset.appId === appId &&
            existing.nextElementSibling === anchor;

        if (isUpToDate) {
            return;
        }

        removeButtons(buttons);
        anchor.before(createEarlyAccessButton(appId));
    }

    function processWishlist() {
        document.querySelectorAll('[data-index]').forEach(processRow);
    }

    let processingScheduled = false;
    let observerStarted = false;

    function scheduleProcessing() {
        if (processingScheduled) {
            return;
        }

        processingScheduled = true;
        requestAnimationFrame(() => {
            processingScheduled = false;
            processWishlist();
        });
    }

    function startWishlistObserver() {
        if (observerStarted || !document.body) {
            return;
        }

        const observer = new MutationObserver((mutations) => {
            const hasRelevantChanges = mutations.some(
                (mutation) => mutation.type === 'characterData' || mutation.addedNodes.length > 0 || mutation.removedNodes.length > 0
            );
            if (hasRelevantChanges) {
                scheduleProcessing();
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
            characterData: true,
        });

        observerStarted = true;
    }

    function init() {
        if (!isSteamWishlistPage()) {
            return;
        }

        scheduleProcessing();
        startWishlistObserver();
    }

    chrome.storage.sync.get({ moduleWishlistExtenderEnabled: true }, (settings) => {
        if (!settings.moduleWishlistExtenderEnabled) return;

        if (document.readyState === 'complete') {
            init();
        } else {
            window.addEventListener('load', init, { once: true });
        }
    });
})();

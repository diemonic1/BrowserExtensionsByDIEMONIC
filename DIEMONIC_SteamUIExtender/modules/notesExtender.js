(function () {
    function isSteamNotesListPage() {
        return /^https:\/\/steamcommunity\.com\/notes\/list(?:[/?#]|$)/.test(window.location.href);
    }

    function isHrefWithAppId(hrefValue) {
        if (!hrefValue) {
            return false;
        }

        return /\/notes\/app\/\d+(?:\/|$|[?#])/.test(hrefValue);
    }

    function isNotesGameHref(hrefValue) {
        if (!hrefValue) {
            return false;
        }

        return /\/notes\/(?:app|shortcut)\//.test(hrefValue);
    }

    function findNotesList() {
        const candidateLists = document.querySelectorAll('ul');

        for (const list of candidateLists) {
            const links = list.querySelectorAll(':scope > li > a[href]');
            if (!links.length) {
                continue;
            }

            const hasNotesLinks = Array.from(links).some((link) => isNotesGameHref(link.getAttribute('href')));
            if (hasNotesLinks) {
                return list;
            }
        }

        return null;
    }

    function createSeparatorItem() {
        const li = document.createElement('li');
        li.className = 'diemonic-notes-separator';
        li.setAttribute('aria-hidden', 'true');
        li.style.listStyle = 'none';
        li.style.margin = '8px 0';

        const line = document.createElement('hr');
        line.style.border = '0';
        line.style.borderTop = '1px solid rgba(255, 255, 255, 0.35)';
        line.style.margin = '0';

        li.appendChild(line);
        return li;
    }

    function reorderNotesList(list) {
        const allItems = Array.from(list.querySelectorAll(':scope > li'));
        if (!allItems.length) {
            return false;
        }

        const idItems = [];
        const noIdItems = [];

        for (const item of allItems) {
            if (item.classList.contains('diemonic-notes-separator')) {
                continue;
            }

            const anchor = item.querySelector(':scope > a[href]');
            const href = anchor ? anchor.getAttribute('href') || '' : '';

            if (!isNotesGameHref(href)) {
                idItems.push(item);
                continue;
            }

            if (isHrefWithAppId(href)) {
                idItems.push(item);
            } else {
                noIdItems.push(item);
            }
        }

        if (!idItems.length || !noIdItems.length) {
            list.querySelectorAll(':scope > li.diemonic-notes-separator').forEach((separator) => separator.remove());
            return false;
        }

        const separators = Array.from(list.querySelectorAll(':scope > li.diemonic-notes-separator'));
        const itemsWithoutSeparators = allItems.filter((item) => !item.classList.contains('diemonic-notes-separator'));
        const desiredOrder = [...idItems, ...noIdItems];

        const isSameOrder =
            itemsWithoutSeparators.length === desiredOrder.length &&
            itemsWithoutSeparators.every((item, index) => item === desiredOrder[index]);

        const hasSingleSeparatorInRightPlace =
            separators.length === 1 &&
            separators[0].previousElementSibling === idItems[idItems.length - 1] &&
            separators[0].nextElementSibling === noIdItems[0];

        if (isSameOrder && hasSingleSeparatorInRightPlace) {
            return false;
        }

        separators.forEach((separator) => separator.remove());

        const fragment = document.createDocumentFragment();
        idItems.forEach((item) => fragment.appendChild(item));
        fragment.appendChild(createSeparatorItem());
        noIdItems.forEach((item) => fragment.appendChild(item));
        list.appendChild(fragment);

        return true;
    }

    let observer = null;
    let processingScheduled = false;
    let applyingReorder = false;
    let interactionListenerAttached = false;
    let navigationHooksAttached = false;
    let lastKnownUrl = window.location.href;

    function processNotesList() {
        if (!isSteamNotesListPage()) {
            return false;
        }

        const list = findNotesList();
        if (!list) {
            return false;
        }

        applyingReorder = true;
        try {
            reorderNotesList(list);
        } finally {
            applyingReorder = false;
        }

        return true;
    }

    function scheduleNotesProcessing() {
        if (processingScheduled) {
            return;
        }

        processingScheduled = true;
        requestAnimationFrame(() => {
            processingScheduled = false;
            processNotesList();
        });
    }

    function startNotesListObserver() {
        if (observer || !document.body) {
            return;
        }

        observer = new MutationObserver(() => {
            if (applyingReorder || !isSteamNotesListPage()) {
                return;
            }

            scheduleNotesProcessing();
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    function schedulePostInteractionProcessing() {
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                scheduleNotesProcessing();
            });
        });
    }

    function attachInteractionListener() {
        if (interactionListenerAttached) {
            return;
        }

        document.addEventListener('click', (event) => {
            if (!isSteamNotesListPage()) {
                return;
            }

            const target = event.target;
            if (!(target instanceof Element)) {
                return;
            }

            const anchor = target.closest('a[href]');
            if (!anchor) {
                return;
            }

            const href = anchor.getAttribute('href') || '';
            if (!isNotesGameHref(href)) {
                return;
            }

            schedulePostInteractionProcessing();
        }, true);

        interactionListenerAttached = true;
    }

    function handleUrlChange() {
        const currentUrl = window.location.href;
        if (currentUrl === lastKnownUrl) {
            return;
        }

        lastKnownUrl = currentUrl;
        if (isSteamNotesListPage()) {
            scheduleNotesProcessing();
        }
    }

    function attachNavigationHooks() {
        if (navigationHooksAttached) {
            return;
        }

        const originalPushState = history.pushState;
        const originalReplaceState = history.replaceState;

        history.pushState = function (...args) {
            const result = originalPushState.apply(this, args);
            handleUrlChange();
            return result;
        };

        history.replaceState = function (...args) {
            const result = originalReplaceState.apply(this, args);
            handleUrlChange();
            return result;
        };

        window.addEventListener('popstate', handleUrlChange);
        window.addEventListener('hashchange', handleUrlChange);

        navigationHooksAttached = true;
    }

    function init() {
        attachNavigationHooks();
        attachInteractionListener();
        startNotesListObserver();

        if (isSteamNotesListPage()) {
            scheduleNotesProcessing();
        }
    }

    chrome.storage.sync.get({ moduleNotesExtenderEnabled: true }, (settings) => {
        if (!settings.moduleNotesExtenderEnabled) return;

        if (document.readyState === 'complete') {
            init();
        } else {
            window.addEventListener('load', init, { once: true });
        }
    });
})();

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

    const SEPARATOR_CLASS = 'diemonic-notes-separator';
    const TOGGLE_CLASS = 'diemonic-notes-toggle';
    const OTHER_ITEM_CLASS = 'diemonic-notes-other';

    let otherNotesExpanded = false;

    function isServiceItem(item) {
        return item.classList.contains(SEPARATOR_CLASS) || item.classList.contains(TOGGLE_CLASS);
    }

    function createToggleItem() {
        const li = document.createElement('li');
        li.className = TOGGLE_CLASS;
        li.style.listStyle = 'none';
        li.style.margin = '0 0 8px';

        const button = document.createElement('div');
        button.setAttribute('role', 'button');
        button.tabIndex = 0;
        button.style.display = 'flex';
        button.style.alignItems = 'center';
        button.style.justifyContent = 'space-between';
        button.style.gap = '8px';
        button.style.padding = '6px 8px';
        button.style.cursor = 'pointer';
        button.style.userSelect = 'none';
        button.style.color = 'rgba(255, 255, 255, 0.75)';
        button.style.borderRadius = '3px';
        button.style.width = 'fit-content';
        button.addEventListener('mouseenter', () => {
            button.style.background = 'rgba(255, 255, 255, 0.08)';
        });
        button.addEventListener('mouseleave', () => {
            button.style.background = '';
        });

        const label = document.createElement('span');
        label.textContent = chrome.i18n.getMessage("otherNotesLabel");

        const arrow = document.createElement('span');
        arrow.className = 'diemonic-notes-toggle-arrow';

        button.appendChild(label);
        button.appendChild(arrow);
        li.appendChild(button);

        const toggle = (event) => {
            event.preventDefault();
            event.stopPropagation();
            otherNotesExpanded = !otherNotesExpanded;

            const list = li.parentElement;
            if (!list) {
                return;
            }

            applyingReorder = true;
            try {
                applyCollapsedState(list);
            } finally {
                applyingReorder = false;
            }
        };

        button.addEventListener('click', toggle);
        button.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                toggle(event);
            }
        });

        return li;
    }

    function applyCollapsedState(list) {
        const toggleItem = list.querySelector(`:scope > li.${TOGGLE_CLASS}`);
        if (toggleItem) {
            const button = toggleItem.firstElementChild;
            const arrow = toggleItem.querySelector('.diemonic-notes-toggle-arrow');
            const arrowText = otherNotesExpanded ? '▲' : '▼';
            const expandedText = String(otherNotesExpanded);

            if (arrow && arrow.textContent !== arrowText) {
                arrow.textContent = arrowText;
            }
            if (button && button.getAttribute('aria-expanded') !== expandedText) {
                button.setAttribute('aria-expanded', expandedText);
            }
        }

        const display = otherNotesExpanded ? '' : 'none';
        list.querySelectorAll(`:scope > li.${OTHER_ITEM_CLASS}`).forEach((item) => {
            if (item.style.display !== display) {
                item.style.display = display;
            }
        });
    }

    function markOtherItems(idItems, noIdItems) {
        idItems.forEach((item) => {
            if (item.classList.contains(OTHER_ITEM_CLASS)) {
                item.classList.remove(OTHER_ITEM_CLASS);
                item.style.display = '';
            }
        });
        noIdItems.forEach((item) => {
            if (!item.classList.contains(OTHER_ITEM_CLASS)) {
                item.classList.add(OTHER_ITEM_CLASS);
            }
        });
    }

    function reorderNotesList(list) {
        const allItems = Array.from(list.querySelectorAll(':scope > li'));
        if (!allItems.length) {
            return false;
        }

        const idItems = [];
        const noIdItems = [];

        for (const item of allItems) {
            if (isServiceItem(item)) {
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
            list.querySelectorAll(`:scope > li.${SEPARATOR_CLASS}, :scope > li.${TOGGLE_CLASS}`).forEach((item) => item.remove());
            markOtherItems([...idItems, ...noIdItems], []);
            return false;
        }

        markOtherItems(idItems, noIdItems);

        const separators = Array.from(list.querySelectorAll(`:scope > li.${SEPARATOR_CLASS}`));
        const toggles = Array.from(list.querySelectorAll(`:scope > li.${TOGGLE_CLASS}`));
        const itemsWithoutService = allItems.filter((item) => !isServiceItem(item));
        const desiredOrder = [...idItems, ...noIdItems];

        const isSameOrder =
            itemsWithoutService.length === desiredOrder.length &&
            itemsWithoutService.every((item, index) => item === desiredOrder[index]);

        const hasServiceItemsInRightPlace =
            separators.length === 1 &&
            toggles.length === 1 &&
            separators[0].previousElementSibling === idItems[idItems.length - 1] &&
            separators[0].nextElementSibling === toggles[0] &&
            toggles[0].nextElementSibling === noIdItems[0];

        if (isSameOrder && hasServiceItemsInRightPlace) {
            applyCollapsedState(list);
            return false;
        }

        separators.forEach((separator) => separator.remove());
        const toggleItem = toggles[0] || createToggleItem();
        toggles.slice(1).forEach((toggle) => toggle.remove());

        const fragment = document.createDocumentFragment();
        idItems.forEach((item) => fragment.appendChild(item));
        fragment.appendChild(createSeparatorItem());
        fragment.appendChild(toggleItem);
        noIdItems.forEach((item) => fragment.appendChild(item));
        list.appendChild(fragment);

        applyCollapsedState(list);
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

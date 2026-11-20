(function () {
    const STEAMID_ATTRIBUTE = 'diemonicWishlistSteamid';
    const BACKUP_STORAGE_KEY = 'wishlistSorterBackup';
    const PANEL_ID = 'diemonic-sorter-panel';
    const MOVE_DELAY_MS = 300;
    const STORE_ITEMS_CHUNK = 100;

    function msg(key, substitutions) {
        return chrome.i18n.getMessage(key, substitutions);
    }

    function isSteamWishlistPage() {
        return /^https:\/\/store\.steampowered\.com\/wishlist\//.test(window.location.href);
    }

    function sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    // ---------------------------------------------------------------- Steam data

    async function fetchJson(url) {
        const response = await fetch(url, { credentials: 'omit' });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status} for ${url}`);
        }
        return response.json();
    }

    async function fetchWishlist(steamId) {
        const json = await fetchJson(`https://api.steampowered.com/IWishlistService/GetWishlist/v1/?steamid=${steamId}`);
        return (json.response && json.response.items) || [];
    }

    async function fetchReleaseInfo(appIds) {
        const releaseByAppId = new Map();

        for (let start = 0; start < appIds.length; start += STORE_ITEMS_CHUNK) {
            const chunk = appIds.slice(start, start + STORE_ITEMS_CHUNK);
            const input = {
                ids: chunk.map((appid) => ({ appid })),
                // country_code is required by Steam; release dates don't depend on it.
                context: { language: 'english', country_code: 'US' },
                data_request: { include_release: true },
            };
            const url = 'https://api.steampowered.com/IStoreBrowseService/GetItems/v1/?input_json=' +
                encodeURIComponent(JSON.stringify(input));
            const json = await fetchJson(url);

            for (const item of (json.response && json.response.store_items) || []) {
                if (item.appid && item.release) {
                    releaseByAppId.set(item.appid, item.release);
                }
            }
        }

        return releaseByAppId;
    }

    // Same request Steam's own drag-and-drop sends.
    async function sendReorder(updates) {
        const response = await fetch('/wishlist/action', {
            method: 'POST',
            credentials: 'include',
            redirect: 'manual',
            headers: {
                'x-valve-request-type': 'mutationAction',
                'Content-Type': 'application/json; charset=utf-8',
            },
            body: JSON.stringify({ m: 'Reorder', mp: [updates] }),
        });

        if (response.type === 'opaqueredirect' || !response.ok) {
            throw new Error(`HTTP ${response.status || 'redirect'}`);
        }

        const json = await response.json();
        if (!json || !json.data || json.data.result !== 1) {
            throw new Error(`result ${json && json.data ? json.data.result : 'unknown'}`);
        }
    }

    // ---------------------------------------------------------------- ordering

    // Steam's own order: ranked items by priority, unranked (priority 0) last, then by date added.
    function compareSteamOrder(a, b) {
        const pa = a.priority || Number.MAX_SAFE_INTEGER;
        const pb = b.priority || Number.MAX_SAFE_INTEGER;
        if (pa !== pb) return pa - pb;
        if ((a.date_added || 0) !== (b.date_added || 0)) return (a.date_added || 0) - (b.date_added || 0);
        return (a.appid || 0) - (b.appid || 0);
    }

    const GROUP_RELEASED = 1;
    const GROUP_RELEASED_EA = 2;
    const GROUP_BY_DISPLAY = {
        date_full: 3,
        date_month: 4,
        date_quarter: 5,
        date_year: 6,
        text_comingsoon: 7,
        text_tba: 8,
    };
    const GROUP_UNKNOWN = 8;
    const DATED_GROUPS = new Set([3, 4, 5, 6]);
    const MANUAL_GROUPS = new Set([GROUP_RELEASED, GROUP_RELEASED_EA]);

    function getGroup(release) {
        if (!release) {
            return GROUP_UNKNOWN;
        }

        if (!release.is_coming_soon) {
            return release.is_early_access ? GROUP_RELEASED_EA : GROUP_RELEASED;
        }

        return GROUP_BY_DISPLAY[release.coming_soon_display] || GROUP_UNKNOWN;
    }

    function buildTargetOrder(currentItems, releaseByAppId) {
        const entries = currentItems.map((item, index) => {
            const release = releaseByAppId.get(item.appid);
            return {
                item,
                index,
                group: getGroup(release),
                releaseDate: (release && release.steam_release_date) || 0,
            };
        });

        entries.sort((a, b) => {
            if (a.group !== b.group) return a.group - b.group;

            // Groups 1-2: the user's own order stays as it is.
            if (MANUAL_GROUPS.has(a.group)) return a.index - b.index;

            // Dated groups: the closer the release, the higher.
            if (DATED_GROUPS.has(a.group) && a.releaseDate !== b.releaseDate) {
                if (!a.releaseDate) return 1;
                if (!b.releaseDate) return -1;
                return a.releaseDate - b.releaseDate;
            }

            // Ties and undated groups: recently added first.
            const addedDiff = (b.item.date_added || 0) - (a.item.date_added || 0);
            return addedDiff !== 0 ? addedDiff : a.index - b.index;
        });

        const groupCounts = {};
        entries.forEach((entry) => {
            groupCounts[entry.group] = (groupCounts[entry.group] || 0) + 1;
        });

        return { targetAppIds: entries.map((entry) => entry.item.appid), groupCounts };
    }

    // Port of Steam's own move logic: take the item out of `from`, insert it at `to`,
    // renumber priorities up to the last ranked item and report only the changed ones.
    function moveItem(items, from, to) {
        const result = items.slice();
        const [moved] = result.splice(from, 1);
        result.splice(to, 0, moved);

        let lastRanked = to;
        for (let i = result.length - 1; i > lastRanked; i--) {
            if (result[i].priority > 0) {
                lastRanked = i;
                break;
            }
        }

        const updates = [];
        const newItems = result.map((item, index) => {
            if (index > lastRanked) return item;
            const priority = index + 1;
            if (item.priority === priority) return item;
            updates.push({ appid: item.appid, priority });
            return { ...item, priority };
        });

        return { newItems, updates };
    }

    // Moves needed to turn `currentItems` into `targetAppIds`, one game per move.
    function planMoves(currentItems, targetAppIds) {
        let items = currentItems.slice();
        const moves = [];

        targetAppIds.forEach((appid, targetIndex) => {
            if (items[targetIndex] && items[targetIndex].appid === appid) return;

            const from = items.findIndex((item) => item.appid === appid);
            if (from < 0) return;

            const { newItems, updates } = moveItem(items, from, targetIndex);
            items = newItems;
            if (updates.length) moves.push({ appid, updates });
        });

        return moves;
    }

    // ---------------------------------------------------------------- UI

    let busy = false;
    let statusElement = null;
    let restoreButton = null;

    function setStatus(text) {
        if (statusElement) statusElement.textContent = text || '';
    }

    function setBusy(value) {
        busy = value;
        document.querySelectorAll(`#${PANEL_ID} button`).forEach((button) => {
            button.disabled = value;
        });
    }

    function getBackup() {
        return new Promise((resolve) => {
            chrome.storage.local.get({ [BACKUP_STORAGE_KEY]: null }, (data) => resolve(data[BACKUP_STORAGE_KEY]));
        });
    }

    function saveBackup(steamId, appIds) {
        return new Promise((resolve) => {
            chrome.storage.local.set({ [BACKUP_STORAGE_KEY]: { steamId, appIds, savedAt: Date.now() } }, resolve);
        });
    }

    async function refreshRestoreButton(steamId) {
        if (!restoreButton) return;
        const backup = await getBackup();
        const available = Boolean(backup && backup.steamId === steamId && backup.appIds && backup.appIds.length);
        restoreButton.style.display = available ? '' : 'none';
        if (available) {
            restoreButton.title = msg('sorterRestoreTooltip', [new Date(backup.savedAt).toLocaleString()]);
        }
    }

    async function loadCurrentItems(steamId) {
        const items = await fetchWishlist(steamId);
        return items.slice().sort(compareSteamOrder);
    }

    async function applyMoves(moves) {
        for (let i = 0; i < moves.length; i++) {
            setStatus(msg('sorterProgress', [String(i + 1), String(moves.length)]));
            await sendReorder(moves[i].updates);
            if (i < moves.length - 1) await sleep(MOVE_DELAY_MS);
        }
    }

    function describeGroups(groupCounts) {
        const lines = [];
        for (let group = 1; group <= 8; group++) {
            if (groupCounts[group]) lines.push(`${msg(`sorterGroup${group}`)}: ${groupCounts[group]}`);
        }
        return lines.join('\n');
    }

    async function runSort(steamId) {
        if (busy) return;
        setBusy(true);

        try {
            setStatus(msg('sorterLoading'));
            const currentItems = await loadCurrentItems(steamId);
            const releaseByAppId = await fetchReleaseInfo(currentItems.map((item) => item.appid));
            const { targetAppIds, groupCounts } = buildTargetOrder(currentItems, releaseByAppId);
            const moves = planMoves(currentItems, targetAppIds);

            if (!moves.length) {
                setStatus(msg('sorterAlreadySorted'));
                return;
            }

            setStatus('');
            const confirmed = window.confirm(
                msg('sorterConfirm', [String(moves.length)]) + '\n\n' + describeGroups(groupCounts)
            );
            if (!confirmed) return;

            await saveBackup(steamId, currentItems.map((item) => item.appid));
            await applyMoves(moves);

            setStatus(msg('sorterDone'));
            window.location.reload();
        } catch (error) {
            console.error('[DIEMONIC] wishlist sort failed', error);
            setStatus(msg('sorterError', [String(error && error.message ? error.message : error)]));
        } finally {
            setBusy(false);
            refreshRestoreButton(steamId);
        }
    }

    async function runRestore(steamId) {
        if (busy) return;

        const backup = await getBackup();
        if (!backup || backup.steamId !== steamId) return;
        if (!window.confirm(msg('sorterRestoreConfirm', [new Date(backup.savedAt).toLocaleString()]))) return;

        setBusy(true);
        try {
            setStatus(msg('sorterLoading'));
            const currentItems = await loadCurrentItems(steamId);
            const present = new Set(currentItems.map((item) => item.appid));
            const restored = backup.appIds.filter((appid) => present.has(appid));
            const restoredSet = new Set(restored);
            // Games added after the backup keep their place after the restored ones.
            currentItems.forEach((item) => {
                if (!restoredSet.has(item.appid)) restored.push(item.appid);
            });

            const moves = planMoves(currentItems, restored);
            if (moves.length) {
                await applyMoves(moves);
            }

            setStatus(msg('sorterDone'));
            window.location.reload();
        } catch (error) {
            console.error('[DIEMONIC] wishlist restore failed', error);
            setStatus(msg('sorterError', [String(error && error.message ? error.message : error)]));
        } finally {
            setBusy(false);
        }
    }

    function createButton(text, onClick) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'diemonic-sorter-button';
        button.textContent = text;
        button.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            onClick();
        });
        return button;
    }

    function createPanel(steamId) {
        const panel = document.createElement('div');
        panel.id = PANEL_ID;

        const sortButton = createButton(msg('sorterButton'), () => runSort(steamId));
        sortButton.title = msg('sorterButtonTooltip');
        restoreButton = createButton(msg('sorterRestoreButton'), () => runRestore(steamId));
        restoreButton.style.display = 'none';

        statusElement = document.createElement('span');
        statusElement.className = 'diemonic-sorter-status';

        panel.appendChild(sortButton);
        panel.appendChild(restoreButton);
        panel.appendChild(statusElement);

        refreshRestoreButton(steamId);
        return panel;
    }

    // The list allows reordering (own wishlist, "your order" sort) exactly when Steam enables
    // drag-and-drop, i.e. renders drag handles in its rows. Position inputs alone aren't enough:
    // they are also shown in other sort modes.
    function isReorderAllowed() {
        return Boolean(document.querySelector('[data-index] [data-rfd-drag-handle-draggable-id]'));
    }

    // The wishlist toolbar is the flex row holding the "search by name, tag or category" input
    // (the store-wide search in the header lives inside a <form> and is skipped).
    function findToolbarAnchor() {
        const inputs = document.querySelectorAll('input:not([type]), input[type="text"], input[type="search"]');
        for (const input of inputs) {
            if (input.closest('[data-index]') || input.closest('form')) continue;
            if (input.placeholder) return input;
        }
        return null;
    }

    function updatePanel() {
        const steamId = document.documentElement.dataset[STEAMID_ATTRIBUTE];
        const existing = document.getElementById(PANEL_ID);
        const shouldShow = Boolean(steamId) && isReorderAllowed();

        if (!shouldShow) {
            if (existing && !busy) existing.remove();
            return;
        }

        const anchor = findToolbarAnchor();
        if (!anchor) return;

        if (existing && existing.previousElementSibling === anchor) return;
        if (existing) existing.remove();

        anchor.after(createPanel(steamId));
    }

    let scheduled = false;

    function scheduleUpdate() {
        if (scheduled) return;
        scheduled = true;
        requestAnimationFrame(() => {
            scheduled = false;
            updatePanel();
        });
    }

    function init() {
        if (!isSteamWishlistPage()) return;

        scheduleUpdate();
        new MutationObserver(scheduleUpdate).observe(document.body, { childList: true, subtree: true });
        new MutationObserver(scheduleUpdate).observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['data-diemonic-wishlist-steamid'],
        });
    }

    chrome.storage.sync.get({ moduleWishlistSorterEnabled: true }, (settings) => {
        if (!settings.moduleWishlistSorterEnabled) return;

        if (document.readyState === 'complete') {
            init();
        } else {
            window.addEventListener('load', init, { once: true });
        }
    });
})();

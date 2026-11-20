// Runs in the page's own JS world (manifest "world": "MAIN"), because the isolated content
// script can't see window.SSR. It only copies the wishlist owner's steamid into a data
// attribute that wishlistSorter.js reads.
(function () {
    const ATTRIBUTE = 'diemonicWishlistSteamid';

    function readSteamId() {
        try {
            const queryData = window.SSR && window.SSR.renderContext && window.SSR.renderContext.queryData;
            if (!queryData) {
                return null;
            }

            const parsed = typeof queryData === 'string' ? JSON.parse(queryData) : queryData;
            for (const query of parsed.queries || []) {
                const key = query.queryKey || [];
                if (key[0] === 'WishlistSortedFiltered' && /^\d{17}$/.test(String(key[1]))) {
                    return String(key[1]);
                }
            }
        } catch (error) {
            // The page structure changed; the sorter simply won't show its button.
        }

        return null;
    }

    function publish(attempt) {
        const steamId = readSteamId();
        if (steamId) {
            document.documentElement.dataset[ATTRIBUTE] = steamId;
            return;
        }

        if (attempt < 40) {
            setTimeout(() => publish(attempt + 1), 250);
        }
    }

    publish(0);
})();

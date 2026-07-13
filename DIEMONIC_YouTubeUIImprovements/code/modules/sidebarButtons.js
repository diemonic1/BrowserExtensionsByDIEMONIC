(function () {
    window.__diemonicYT = window.__diemonicYT || {};

    const buttons = [
        { id: 'yt-custom-subscriptions', text: chrome.i18n.getMessage('subscriptionsLabel'), url: 'https://www.youtube.com/feed/subscriptions', iconURL: "assets/subs.png" },
        { id: 'yt-custom-watch-later', text: chrome.i18n.getMessage('watchLaterLabel'), url: 'https://www.youtube.com/playlist?list=WL', iconURL: "assets/later.png" },
        { id: 'yt-custom-playlists', text: chrome.i18n.getMessage('playlistsLabel'), url: 'https://www.youtube.com/feed/playlists', iconURL: "assets/playlists.png" }
    ];

    const baseStyle = `
        display: flex;
        align-items: center;
        height: 40px;
        padding: 0 12px;
        border-radius: 10px;
        cursor: pointer;
        user-select: none;
        color: #f1f1f1;
        font-size: 14px;
        font-weight: 500;
    `;

    // Finds the sidebar "Home" entry: Russian label first (original behavior), then a
    // language-independent structural match by href, then the English label as a last resort.
    function findHomeItem() {
        let el = [...document.querySelectorAll('[title="Главная"]')]
            .find((e) => e.textContent.includes('Главная'));
        if (el) return el;

        el = document.querySelector('ytd-guide-entry-renderer a#endpoint[href="/"]');
        if (el) return el;

        el = [...document.querySelectorAll('[title="Home"]')]
            .find((e) => e.textContent.includes('Home'));
        if (el) return el;

        return null;
    }

    function waitForMainItemParent() {
        return new Promise((resolve) => {
            const timer = setInterval(() => {
                const child = findHomeItem();
                if (child?.parentElement) {
                    clearInterval(timer);
                    resolve(child.parentElement);
                }
            }, 300);
        });
    }

    async function spawnButtons() {
        const mainItem = await waitForMainItemParent();

        let insertAfter = mainItem;

        buttons.forEach(({ id, text, url, iconURL }) => {
            if (document.getElementById(id)) return;

            const btn = document.createElement('div');
            btn.id = id;
            btn.title = text;
            btn.style.cssText = baseStyle;

            btn.addEventListener('mouseenter', () => { btn.style.background = 'rgba(255,255,255,0.1)'; });
            btn.addEventListener('mouseleave', () => { btn.style.background = 'transparent'; });

            const icon = document.createElement('img');
            icon.src = chrome.runtime.getURL(iconURL);
            icon.style.cssText = `
                width: 24px;
                height: 24px;
                margin-right: 24px;
                object-fit: contain;
            `;

            const label = document.createElement('span');
            if (window.location.href.includes(url))
                label.style = "font-weight: 900; text-decoration: underline;";
            label.innerHTML = text;

            btn.append(icon, label);

            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                window.location.href = url;
            });

            btn.addEventListener('mousedown', (e) => {
                if (e.button !== 1) return;
                e.preventDefault();
                e.stopPropagation();
                window.open(url, '_blank');
            });

            insertAfter.after(btn);
            insertAfter = btn;
        });
    }

    function init() {
        window.addEventListener("load", () => {
            spawnButtons();
        });

        spawnButtons();

        const pushState = history.pushState;
        history.pushState = function () {
            pushState.apply(history, arguments);
            spawnButtons();
        };
        const replaceState = history.replaceState;
        history.replaceState = function () {
            replaceState.apply(history, arguments);
            spawnButtons();
        };
        window.addEventListener('popstate', spawnButtons);

        // Safety net for dynamic transitions the above hooks might miss
        setInterval(spawnButtons, 500);
    }

    window.__diemonicYT.sidebarButtons = { init };
})();

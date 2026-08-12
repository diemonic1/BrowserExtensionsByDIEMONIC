(function () {
    window.__diemonicYT = window.__diemonicYT || {};

    // Ported from "Control Panel for YouTube"'s "Restore Related sidebar layout" option
    // (revertGiantRelated in its page.js): YouTube's #secondary sidebar grows to ~550px and
    // switches the Related list to a 2-column grid of oversized thumbnails once the window is
    // wide enough. This shrinks the sidebar back down and forces the Related list back to a
    // single column of compact, YouTube-classic-style rows.
    const STYLE_ID = "diemonic_youtube_relatedSidebarStyle";

    function buildCss(width) {
        // min-width can't exceed the sidebar's own (max-)width, or the two custom properties
        // would fight each other - capping it here keeps any width the user picks valid.
        const minWidth = Math.min(300, width);

        return `
            ytd-watch-flexy #secondary {
                --ytd-watch-flexy-sidebar-width: ${width}px;
                --ytd-watch-flexy-sidebar-min-width: ${minWidth}px;
                max-width: var(--ytd-watch-flexy-sidebar-width);
            }
            #secondary #related {
                .ytLockupViewModelVertical {
                    -moz-box-orient: vertical;
                    -moz-box-direction: normal;
                    flex-direction: row;
                    height: inherit;
                }
                .ytLockupViewModelVertical .ytLockupViewModelContentImage {
                    display: -moz-box;
                    display: flex;
                    -moz-box-flex: 0;
                    flex: none;
                    padding-right: 16px;
                    -moz-box-pack: center;
                    justify-content: center;
                    max-width: 500px;
                }
                .ytLockupViewModelVertical .ytLockupViewModelMetadata {
                    -moz-box-flex: 1;
                    flex: 1;
                }
                .ytLockupViewModelVertical.ytLockupViewModelCollectionStack1 {
                    position: relative;
                    margin-top: 6px;
                }
                .ytLockupViewModelVertical.ytLockupViewModelCollectionStack2 {
                    position: relative;
                    margin-top: 10px;
                }
                .ytLockupViewModelHorizontal.ytLockupViewModelCompact .ytLockupViewModelContentImage {
                    padding-right: 8px;
                }
                .ytLockupViewModelVertical .ytLockupMetadataViewModelAvatar {
                    display: none;
                }
                .ytLockupViewModelVertical .ytLockupViewModelContentImage {
                    width: 168px;
                    padding-bottom: 0;
                }
                .ytLockupViewModelContentImage {
                    max-width: 168px;
                }
                ytd-watch-next-secondary-results-renderer[use-dynamic-secondary-columns]:not(:has(ytd-item-section-renderer)) #items.ytd-watch-next-secondary-results-renderer,
                ytd-watch-next-secondary-results-renderer[use-dynamic-secondary-columns] #contents.ytd-item-section-renderer {
                    grid-template-columns: 1fr;
                }
                ytd-watch-next-secondary-results-renderer[use-dynamic-secondary-columns] .lockup.ytd-watch-next-secondary-results-renderer {
                    margin-bottom: 0;
                }
            }
        `;
    }

    function applyStyle(width) {
        let styleEl = document.getElementById(STYLE_ID);
        if (!styleEl) {
            styleEl = document.createElement("style");
            styleEl.id = STYLE_ID;
            document.documentElement.appendChild(styleEl);
        }
        styleEl.textContent = buildCss(width);
    }

    function init(settings) {
        applyStyle(settings.relatedSidebarWidth);
    }

    window.__diemonicYT.relatedSidebar = { init };
})();

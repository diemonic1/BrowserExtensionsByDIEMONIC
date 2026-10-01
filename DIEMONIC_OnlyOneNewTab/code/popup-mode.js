// The same page is used as the options page and as the toolbar popup (options.html?popup=1).
function isPopup() {
    if (new URLSearchParams(location.search).has('popup')) {
        return true;
    }
    try {
        return chrome.extension.getViews({ type: 'popup' }).includes(window);
    } catch (error) {
        return false;
    }
}

if (isPopup()) {
    document.documentElement.classList.add('popup');
}

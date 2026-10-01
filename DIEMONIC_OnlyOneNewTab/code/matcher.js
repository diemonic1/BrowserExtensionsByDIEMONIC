// Shared between background.js (importScripts) and options.js (<script>).

const DEFAULT_SETTINGS = {
    enabled: true,
    patterns: [],
    closeNewTabPages: true
};

// Schemes of "normal" pages. Anything else whose path looks like a start page
// (chrome://newtab, edge://newtab, browser://newtab, vivaldi://startpage, ...) is a new tab page.
const WEB_SCHEMES = ['http:', 'https:', 'file:', 'ftp:', 'data:', 'blob:', 'view-source:'];
// Markers are searched inside each part of the address (opera://startpageshared/ contains "startpage").
const NEW_TAB_MARKERS = ['newtab', 'new-tab', 'new_tab', 'startpage', 'start-page', 'start_page', 'speeddial', 'speed-dial', 'ntp'];

function normalizeSettings(raw) {
    const settings = Object.assign({}, DEFAULT_SETTINGS, raw || {});
    const seen = new Set();

    settings.enabled = Boolean(settings.enabled);
    settings.closeNewTabPages = Boolean(settings.closeNewTabPages);
    settings.patterns = (Array.isArray(settings.patterns) ? settings.patterns : [])
        .map(normalizePattern)
        .filter((pattern) => pattern && !seen.has(pattern) && seen.add(pattern));

    return settings;
}

// "https://www.GitHub.com/" -> "github.com"
function normalizePattern(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/^[a-z][a-z0-9+.-]*:\/\//, '')
        .replace(/^www\./, '')
        .replace(/\/+$/, '');
}

function getTabUrl(tab) {
    return tab.pendingUrl || tab.url || '';
}

function isBlankUrl(url) {
    return !url || url === 'about:blank';
}

function isNewTabPage(url) {
    if (isBlankUrl(url) || url === 'about:newtab' || url === 'about:home' || url === 'about:privatebrowsing') {
        return true;
    }

    let parsed;
    try {
        parsed = new URL(url);
    } catch (error) {
        return false;
    }

    if (WEB_SCHEMES.includes(parsed.protocol)) {
        return false;
    }

    // chrome://newtab/ -> host "newtab"; chrome-search://local-ntp/local-ntp.html -> host "local-ntp"
    const parts = (parsed.host + '/' + parsed.pathname).toLowerCase().split(/[/.]+/).filter(Boolean);
    return parts.some((part) => NEW_TAB_MARKERS.some((marker) => part.includes(marker)));
}

// Turns a URL into "host/path?query" without scheme and "www." for matching against patterns.
function toComparable(url) {
    try {
        const parsed = new URL(url);
        if (!parsed.host) {
            return '';
        }
        const host = parsed.host.toLowerCase().replace(/^www\./, '');
        return host + parsed.pathname.replace(/\/+$/, '') + parsed.search;
    } catch (error) {
        return '';
    }
}

function wildcardToRegExp(pattern) {
    // "*.google.com" also matches "google.com" itself
    const subdomains = pattern.startsWith('*.');
    const body = subdomains ? pattern.slice(2) : pattern;
    const escaped = body.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
    return new RegExp('^' + (subdomains ? '(.*\\.)?' : '') + escaped + '$');
}

// "github.com"          -> github.com, gist.github.com, github.com/user/repo
// "github.com/user"     -> github.com/user, github.com/user/repo (not github.com/username)
// "*.google.com/maps*"  -> wildcard over "host/path?query"
function matchesPattern(url, pattern) {
    const target = toComparable(url);
    if (!target) {
        return false;
    }

    if (pattern.includes('*')) {
        return wildcardToRegExp(pattern).test(target);
    }

    const slash = pattern.indexOf('/');
    const patternHost = slash === -1 ? pattern : pattern.slice(0, slash);
    const patternPath = slash === -1 ? '' : pattern.slice(slash);

    const targetSlash = target.search(/[/?]/);
    const targetHost = targetSlash === -1 ? target : target.slice(0, targetSlash);
    const targetPath = targetSlash === -1 ? '' : target.slice(targetSlash);

    if (targetHost !== patternHost && !targetHost.endsWith('.' + patternHost)) {
        return false;
    }

    if (!patternPath) {
        return true;
    }

    return targetPath === patternPath
        || targetPath.startsWith(patternPath + '/')
        || targetPath.startsWith(patternPath + '?')
        || (patternPath.includes('?') && targetPath.startsWith(patternPath + '&'));
}

// Returns the key of the group the tab belongs to, or null if the tab is not tracked.
function getGroupKey(url, settings) {
    if (settings.closeNewTabPages && isNewTabPage(url)) {
        return '#newtab';
    }

    const pattern = settings.patterns.find((item) => matchesPattern(url, item));
    return pattern ? 'pattern:' + pattern : null;
}

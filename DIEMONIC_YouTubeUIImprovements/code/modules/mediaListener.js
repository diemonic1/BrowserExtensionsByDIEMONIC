(function () {
    window.__diemonicYT = window.__diemonicYT || {};

    function initIntervals() {
        var firstDelay = 300      // first interval between executions
        var timeoutDelay = 10000  // time after which the first interval turns off and the second turns on
        var secondDelay = 10000   // second interval between executions
        let firstInterval = setInterval(initMediaSession, firstDelay);
        setTimeout(function () {
            clearInterval(firstInterval);
            setInterval(initMediaSession, secondDelay);
        }, timeoutDelay);
    }

    var nexttimeF = 0;

    function handleFullscreenKey(event) {
        if (event.keyCode == 125 && new Date().getTime() > nexttimeF) {
            // F14 keyCode: 125 , f keyCode: 70
            nexttimeF = new Date().getTime() + 100;
            let evt = new KeyboardEvent("keydown", { key: "f", keyCode: 70 });
            document.dispatchEvent(evt);
            window.__diemonicYT.log(chrome.i18n.getMessage("fullscreenKeyLog"));
        }
    }

    function initMediaSession() {
        var nexttime = 0;

        navigator.mediaSession.setActionHandler('nexttrack', function () {
            if (new Date().getTime() - 48 > nexttime) { // single click
                setTimeout(function () {
                    if (new Date().getTime() - 48 > nexttime) {
                        forward(document);
                    }
                }, 50);
            } else { // long press (repeated firing)
                nextMedia(document);
            }
            nexttime = new Date().getTime();
        });

        navigator.mediaSession.setActionHandler('previoustrack', function () {
            if (new Date().getTime() - 48 > nexttime) {
                setTimeout(function () {
                    if (new Date().getTime() - 48 > nexttime) {
                        backward(document);
                    }
                }, 50);
            } else {
                prevMedia(document);
            }
            nexttime = new Date().getTime();
        });
    }

    function forward(element) { // ArrowRight
        let evt = new KeyboardEvent("keydown", { key: "ArrowRight", keyCode: 39 });
        document.dispatchEvent(evt);
    }
    function backward(element) { // ArrowLeft
        let evt = new KeyboardEvent("keydown", { key: "ArrowLeft", keyCode: 37 });
        document.dispatchEvent(evt);
    }

    function nextMedia(element) {
        element.querySelectorAll('iframe').forEach(function (item) {
            try {
                if (iframe.contentWindow) {
                    nextMedia(iframe.contentWindow.document);
                }
            } catch (err) { }
        });
        if (document.querySelector('[class*="ytp-next-button"]')) {
            document.querySelector('[class*="ytp-next-button"]').click();
        } else {
            window.history.forward();
        }
    };

    function prevMedia(element) {
        element.querySelectorAll('iframe').forEach(function (item) {
            try {
                if (iframe.contentWindow) {
                    prevMedia(iframe.contentWindow.document);
                }
            } catch (err) { }
        });
        if (document.querySelector('[class*="ytp-prev-button"]') && document.querySelector('[class*="ytp-prev-button"]').getAttribute('aria-disabled') == 'false') {
            document.querySelector('[class*="ytp-prev-button"]').click();
        } else {
            window.history.back();
        }
    };

    function init() {
        document.addEventListener('keydown', handleFullscreenKey);

        window.addEventListener("load", () => {
            initIntervals();
        });
    }

    window.__diemonicYT.mediaListener = { init };
})();

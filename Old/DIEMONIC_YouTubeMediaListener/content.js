window.onload = function () {
  initIntervals();
}

//#region фоновое прослушивание событий кнопок

function initIntervals() {
  var firstDelay = 300 // first interval between executions
  var timeoutDelay = 10000 // time after which the first interval turns off and the second turns on
  var secondDelay = 10000 // second interval between executions
  let firstInterval = setInterval(initMediaSession, firstDelay);
  setTimeout(function () {
    clearInterval(firstInterval);
    setInterval(initMediaSession, secondDelay);
  }, timeoutDelay);
}

var nexttimeF = 0;

document.addEventListener('keydown', function (event) {
  if (event.keyCode == 125 && new Date().getTime() > nexttimeF) {
    //F14 keyCode: 125 , f 70
    nexttimeF = new Date().getTime() + 100;

    let evt = new KeyboardEvent("keydown", {
      key: "f",
      keyCode: 70
    });

    document.dispatchEvent(evt);
    console.log("f");
  }
});

function initMediaSession() {
  /*
  navigator.mediaSession.setActionHandler('play', function() {space(document)});

  navigator.mediaSession.setActionHandler('pause', function() {space(document)});
*/

  var nexttime = 0;

  navigator.mediaSession.setActionHandler('nexttrack', function () {
    if (new Date().getTime() - 48 > nexttime) { // if a single click occurs
      setTimeout(function () {
        if (new Date().getTime() - 48 > nexttime) {
          forward(document);
        }
      }, 50);
    } else { // if there is a long press
      nextMedia(document);
    }
    nexttime = new Date().getTime();
  });

  navigator.mediaSession.setActionHandler('previoustrack', function () {
    if (new Date().getTime() - 48 > nexttime) {// if a single click occurs
      setTimeout(function () {
        if (new Date().getTime() - 48 > nexttime) {
          backward(document);
        }
      }, 50);
    } else { // if there is a long press
      prevMedia(document);
    }
    nexttime = new Date().getTime();
  });
}

function forward(element) { // ArrowRight
  let evt = new KeyboardEvent("keydown", {
    key: "ArrowRight",
    keyCode: 39
  });
  document.dispatchEvent(evt);
}

// function forward(element) { // 5 seconds forward
//   element.querySelectorAll('video').forEach(function(item) {item.currentTime += 5; });
//   element.querySelectorAll('audio').forEach(function(item) {item.currentTime += 5; });
// }

function backward(element) { // ArrowLeft
  let evt = new KeyboardEvent("keydown", {
    key: "ArrowLeft",
    keyCode: 37
  });
  document.dispatchEvent(evt);
}

// function backward(element) { // 5 seconds backward
//   element.querySelectorAll('video').forEach(function(item) {item.currentTime -= 5; });
//   element.querySelectorAll('audio').forEach(function(item) {item.currentTime -= 5; });
// }

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

//#endregion

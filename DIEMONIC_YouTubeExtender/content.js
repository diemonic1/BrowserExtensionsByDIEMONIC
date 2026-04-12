window.onload = function () {
  initIntervals();
  SpawnButtons();
}

let container = null;

async function SpawnButtons() {
  const waitForMainItemParent = () => new Promise(resolve => {
    const timer = setInterval(() => {
      const child = [...document.querySelectorAll('[title="Главная"]')]
        .find(el => el.textContent.includes('Главная'));
      if (child?.parentElement) {
        clearInterval(timer);
        resolve(child.parentElement);
      }
    }, 300);
  });

  const mainItem = await waitForMainItemParent();

  const buttons = [
    {
      id: 'yt-custom-subscriptions',
      text: 'Подписки',
      url: 'https://www.youtube.com/feed/subscriptions',
      iconURL: "subs.png"
    },
    {
      id: 'yt-custom-watch-later',
      text: 'Смотреть позже',
      url: 'https://www.youtube.com/playlist?list=WL',
      iconURL: "later.png"
    },
    {
      id: 'yt-custom-playlists',
      text: 'Плейлисты',
      url: 'https://www.youtube.com/feed/playlists',
      iconURL: "playlists.png"
    }
  ];

  // базовые стили кнопки (приближены к YouTube)
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

  let insertAfter = mainItem;

  buttons.forEach(({ id, text, url, iconURL }) => {
    if (document.getElementById(id)) return;

    const btn = document.createElement('div');
    btn.id = id;
    btn.title = text;

    btn.style.cssText = baseStyle;

    // hover
    btn.addEventListener('mouseenter', () => {
      btn.style.background = 'rgba(255,255,255,0.1)';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.background = 'transparent';
    });

    // иконка
    const icon = document.createElement('img');
    icon.src = chrome.runtime.getURL(iconURL);
    icon.style.cssText = `
            width: 24px;
            height: 24px;
            margin-right: 24px;
            object-fit: contain;
        `;

    // текст
    const label = document.createElement('span');

    if (window.location.href.includes(url))
      label.style = "font-weight: 900; text-decoration: underline;";

    label.innerHTML = text;

    btn.append(icon, label);

    // клик → переход
    btn.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      window.location.href = url;
    });

    btn.addEventListener('mousedown', e => {
      if (e.button !== 1) return;

      e.preventDefault();
      e.stopPropagation();

      window.open(url, '_blank');
    });

    insertAfter.after(btn);
    insertAfter = btn;
  });


  /*
  // Если URL содержит watch — удаляем контейнер, если он есть
  if (window.location.href.includes("watch")
    || window.location.href.includes("yandex.ru/video/preview/")
    || window.location.href.includes("www.youtube.com/embed/")) {

    if (container) {
      container.remove();
      container = null;
    }

    return;
  }

  // Если контейнер уже есть, ничего не делаем
  if (container) return;

  // Создаем контейнер для кнопок
  container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "20px";
  container.style.bottom = "20px";
  container.style.display = "flex";
  container.style.flexDirection = "column";
  container.style.gap = "10px";
  container.style.zIndex = "9999";

  // Общий стиль для кнопок
  const buttonStyle = {
    padding: "10px 16px",
    fontSize: "14px",
    fontWeight: "500",
    borderRadius: "8px",
    border: "1px solid rgba(105, 105, 105, 1)",
    cursor: "pointer",
    backgroundColor: "rgb(15, 15, 15)",
    color: "#FFFFFF",
    boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
    transition: "all 0.2s ease",
    fontFamily: "'Roboto', 'Arial', sans-serif"
  };

  // Ховер-эффект
  function addHoverEffect(btn) {
    btn.addEventListener("mouseenter", () => {
      btn.style.backgroundColor = "rgb(41, 41, 41)";
      btn.style.transform = "translateY(-2px)";
      btn.style.boxShadow = "0 4px 8px rgba(0,0,0,0.25)";
    });
    btn.addEventListener("mouseleave", () => {
      btn.style.backgroundColor = "rgb(15, 15, 15)";
      btn.style.transform = "translateY(0)";
      btn.style.boxShadow = "0 2px 6px rgba(0,0,0,0.2)";
    });
  }

  // Создаем кнопку
  function createButton(text, url) {
    const btn = document.createElement("button");
    btn.textContent = text;
    Object.assign(btn.style, buttonStyle);
    addHoverEffect(btn);
    btn.addEventListener("click", () => {
      window.location.href = url;
    });
    return btn;
  }

  // Добавляем три кнопки
  const buttons = [
    { text: "Главная", url: "https://www.youtube.com/" },
    { text: "Подписки", url: "https://www.youtube.com/feed/subscriptions" },
    { text: "Смотреть позже", url: "https://www.youtube.com/playlist?list=WL" }
  ];

  buttons.forEach(b => container.appendChild(createButton(b.text, b.url)));

  document.body.appendChild(container);
  */
}

// Начальный вызов
SpawnButtons();

// Отслеживаем изменения URL (history.pushState / replaceState / back-forward)
const pushState = history.pushState;
history.pushState = function () {
  pushState.apply(history, arguments);
  SpawnButtons();
};
const replaceState = history.replaceState;
history.replaceState = function () {
  replaceState.apply(history, arguments);
  SpawnButtons();
};
window.addEventListener('popstate', SpawnButtons);

// На всякий случай проверяем каждые 500ms (для динамических переходов)
setInterval(SpawnButtons, 500);


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

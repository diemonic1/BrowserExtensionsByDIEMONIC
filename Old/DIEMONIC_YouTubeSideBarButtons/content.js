window.onload = function () {
  SpawnButtons();
}

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

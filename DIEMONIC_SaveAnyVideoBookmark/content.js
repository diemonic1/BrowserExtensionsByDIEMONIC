function createYoutubeBookmark() {
  const video = document.querySelector('video');

  if (!video
    && window.location.href.includes('vkvideo')
  ) {
    const interval = setInterval(() => {
      console.log('Поиск вк видео');
      const host = document.querySelector('.shadow-root-container');

      if (!host) return;

      if (host.shadowRoot) {
        const video = host.shadowRoot.querySelector('video');
        if (video) {
          console.log('Нашли вк видео:', video);
          proceedVideoBookmark(video, false, true);
          clearInterval(interval);
        }
      }
    }, 300);
  }
  else {
    if (!video) {
      showSavedToast('Видео не найдено');
      console.log('Видео не найдено');
      return;
    }

    proceedVideoBookmark(video, true, false);
  }
}

function proceedVideoBookmark(video, deleteYears, addSecondsToURL) {
  const maxLengthTitle = 40;

  try {
    const currentTime = Math.floor(video.currentTime);
    const duration = video.duration;

    if (!currentTime
      || !duration
    ) {
      showSavedToast('Видео не найдено');
      console.log('Видео не найдено');
      return;
    }

    let url = new URL(window.location.href);
    url.searchParams.set('t', currentTime);

    if (addSecondsToURL)
      url += "s";

    let title = document.title;

    title = title.replace(' - YouTube', '');
    title = title.replace('сериал, все серии, ', '');
    title = title.replace(' — смотреть онлайн в хорошем качестве — Кинопоиск', '');
    title = title.replace(' - смотреть онлайн в хорошем качестве - Кинопоиск', '');
    title = title.replace('смотреть онлайн в хорошем качестве', '');
    title = title.replace('Кинопоиск', '');

    if (deleteYears) {
      title = title
        .replace(/\s*\(\d+\s+сезон(а|ов)?\)/gi, '')
        .replace(/\b[12]\d{3}(?:[-–][12]\d{3})?\b/g, '')
        .trim();
    }
    else {
      title = title
        .replace(/\s*\(\d+\s+сезон(а|ов)?\)/gi, '')
        .trim();
    }

    if (title.length > maxLengthTitle) {
      title = title.slice(0, maxLengthTitle - 3) + '...';
    }

    if (window.location.href.startsWith('https://hd.kinopoisk.ru/film')) {
      const el = document.querySelector('[class*="styles_subtitle"]');

      if (el) {
        title += " " + el.textContent.trim();
      }
    }

    const timeFormatted = formatTime(currentTime) + ' / ' + formatTime(duration);

    const finalTitle = `${title} [${timeFormatted}]`;

    chrome.runtime.sendMessage({
      action: 'createBookmark',
      url: url.toString(),
      title: finalTitle
    });

    showSavedToast('Сохранено!');
  }
  catch (error) {
    showSavedToast('ОШИБКА: ' + error);
  }
}

function showSavedToast(text) {
  const toast = document.createElement('div');
  toast.className = 'SaveAnyVideoBookmark_notify';
  toast.textContent = text;

  document.body.appendChild(toast);

  toast.getBoundingClientRect();

  toast.classList.add('SaveAnyVideoBookmark_notify_show');

  setTimeout(() => {
    toast.classList.remove('SaveAnyVideoBookmark_notify_show');
    toast.classList.add('SaveAnyVideoBookmark_notify_hide');

    toast.addEventListener(
      'transitionend',
      () => {
        toast.remove();
      },
      { once: true }
    );
  }, 1000);
}

const formatTime = (t) => {
  const total = Math.floor(t);

  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;

  return h > 0
    ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
    : `${m}:${s.toString().padStart(2, '0')}`;
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "runСreateYoutubeBookmark") {
    createYoutubeBookmark();
  }
});
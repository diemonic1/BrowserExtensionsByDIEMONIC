const DEFAULT_VIDEO_OFFSET = 0;
const DEFAULT_TOAST_LEFT_OFFSET = '23.8%';

applyToastOffset();

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

  getSettings((settings) => {
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

      const savedTime = Math.max(0, currentTime - settings.videoOffset);

      let url = new URL(window.location.href);
      url.searchParams.set('t', savedTime);

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

      const timeFormatted = formatTime(savedTime) + ' / ' + formatTime(duration);

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
  });
}

function getSettings(callback) {
  chrome.storage.sync.get({
    videoOffset: DEFAULT_VIDEO_OFFSET,
    toastLeftOffset: DEFAULT_TOAST_LEFT_OFFSET
  }, (settings) => {
    callback({
      videoOffset: clampOffset(settings.videoOffset),
      toastLeftOffset: normalizeToastLeftOffset(settings.toastLeftOffset)
    });
  });
}

function applyToastOffset() {
  chrome.storage.sync.get({
    toastLeftOffset: DEFAULT_TOAST_LEFT_OFFSET
  }, (settings) => {
    document.documentElement.style.setProperty(
      '--save-any-video-bookmark-toast-left',
      normalizeToastLeftOffset(settings.toastLeftOffset)
    );
  });
}

function clampOffset(value) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return DEFAULT_VIDEO_OFFSET;
  }

  return Math.min(3, Math.max(0, Math.floor(numericValue)));
}

function normalizeToastLeftOffset(value) {
  if (typeof value !== 'string') {
    return DEFAULT_TOAST_LEFT_OFFSET;
  }

  const normalizedValue = value.trim().replace(',', '.');
  const matchedValue = normalizedValue.match(/^(-?\d+(?:\.\d+)?)\s*%?$/);

  if (!matchedValue) {
    return DEFAULT_TOAST_LEFT_OFFSET;
  }

  const numericValue = Number(matchedValue[1]);

  if (!Number.isFinite(numericValue)) {
    return DEFAULT_TOAST_LEFT_OFFSET;
  }

  return `${numericValue}%`;
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
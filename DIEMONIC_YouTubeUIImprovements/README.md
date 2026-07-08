# D!EMONIC | YouTube UI Improvements

## English

A single configurable browser extension for YouTube that combines four independent enhancement modules, each of which can be turned on or off separately from the settings page. It is the merged successor of four previously separate extensions (Custom Buttons, Media Listener, Sidebar Buttons, View Progress), reproducing all of their behavior in one install.

### Modules

**1. Download & preview buttons** (`customButtons`)
On any YouTube watch page, a small floating, draggable panel appears with two buttons:
- **Download** — copies the current video's URL to the clipboard and opens it through a custom, user-configurable protocol/command (default `ytDlpWebExtension://`), for handing the link off to a locally installed download tool (e.g. a yt-dlp based helper registered as a custom URI-scheme handler).
- **Preview** — opens the video's maximum-resolution thumbnail image in a new browser tab.

The panel can be dragged anywhere on the page; its position is remembered per browser profile. It automatically hides while the video is in fullscreen or theater/cinema mode and reappears when you exit it, and re-evaluates its visibility on user activity (keyboard, mouse, scroll) and on YouTube's internal page-navigation events, so it stays in sync as you browse between videos without a full page reload.

**2. Media key control** (`mediaListener`)
Lets hardware/OS media keys (or a Bluetooth headset's track controls) drive YouTube:
- A quick tap of Next/Previous track seeks the video 5 seconds forward/backward.
- Holding Next/Previous (a rapid repeated signal) instead skips to the actual next/previous video in a playlist or autoplay queue, using YouTube's own player controls.
- Also remaps the F14 key to YouTube's native fullscreen shortcut, for keyboards/macro devices that can send F14 but not `f`.

**3. Sidebar shortcut buttons** (`sidebarButtons`)
Adds three quick-access entries right after "Home" in YouTube's left sidebar menu: **Subscriptions**, **Watch later**, and **Playlists**. Each has its own icon, highlights when you're currently on that page, opens in the same tab on a left click, and opens in a new tab on a middle click. The buttons persist across YouTube's single-page-app navigation (they re-appear automatically as you browse). The sidebar's "Home" entry is located through a three-step fallback so this works regardless of the YouTube interface language: first by the Russian label, then by a language-independent structural match (the entry whose link points to `/`), then by the English label.

**4. Watch progress display** (`viewProgress`)
Adds a small circular progress ring next to the channel/owner info on watch pages (and next to the video info on playlist pages) showing `elapsed / total` time. Hovering it shows a tooltip with the percentage watched and time remaining. Updates live as the video plays and disappears automatically when you navigate away from a video.

### Settings page

Opened from the extension's entry in the browser's extensions page. Organized into three independent cards:
- **Modules** — one checkbox per module above, to enable or disable it entirely. Changes take effect the next time a YouTube tab is loaded/reloaded.
- **Logging** — a single, module-independent switch that turns on/off this extension's debug logging to the browser console. All four modules log through one shared function, tagged with this extension's own name, instead of each module logging independently.
- **Download button settings** — the download/preview button's own options: whether to show the download button, whether to show the preview button, and the protocol/command string used to hand off the video URL to an external downloader.

All settings are saved automatically as you change them (`chrome.storage.sync`, synced across the user's signed-in browser instances) — there is no separate "Save" button.

### Localization

Fully localized via `_locales` (English and Russian) — the interface language follows the browser's own language setting. This covers every settings-page label, the injected page tooltips and sidebar button labels, and every console log message. The extension's own name is intentionally identical in both languages.

### Permissions

- `storage` — saving and syncing all of the above settings.
- `host_permissions` on `https://www.youtube.com/*` — the only site this extension runs on.

---

## Русский

Единое настраиваемое расширение для YouTube, объединяющее четыре независимых модуля улучшений — каждый можно включать и выключать отдельно прямо со страницы настроек. Это объединённый преемник четырёх ранее отдельных расширений (Custom Buttons, Media Listener, Sidebar Buttons, View Progress) — весь их функционал воспроизведён в одной установке.

### Модули

**1. Кнопки загрузки и превью** (`customButtons`)
На любой странице просмотра видео YouTube появляется небольшая плавающая перетаскиваемая панель с двумя кнопками:
- **Загрузка** — копирует ссылку на текущее видео в буфer обмена и открывает её через настраиваемый пользователем протокол/команду (по умолчанию `ytDlpWebExtension://`), чтобы передать ссылку локально установленной программе для скачивания (например, обработчику на базе yt-dlp, зарегистрированному как пользовательская URI-схема).
- **Превью** — открывает миниатюру видео в максимальном разрешении в новой вкладке.

Панель можно перетащить в любое место на странице, её положение запоминается для профиля браузера. Она автоматически скрывается, когда видео в полноэкранном режиме или режиме кинотеатра, и появляется снова при выходе из него; видимость пересчитывается при активности пользователя (клавиатура, мышь, прокрутка) и при внутренних событиях навигации YouTube, поэтому панель остаётся актуальной при переходах между видео без перезагрузки страницы.

**2. Управление медиаклавишами** (`mediaListener`)
Позволяет аппаратным/системным медиаклавишам (или кнопкам управления Bluetooth-гарнитуры) управлять YouTube:
- Короткое нажатие "вперёд"/"назад" перематывает видео на 5 секунд вперёд/назад.
- Удержание "вперёд"/"назад" (частый повторяющийся сигнал) вместо этого переключает на следующее/предыдущее видео в плейлисте или очереди автовоспроизведения, используя встроенные элементы управления плеера YouTube.
- Также переназначает клавишу F14 на встроенное сочетание клавиш YouTube для полноэкранного режима — для клавиатур/макро-устройств, которые могут отправлять F14, но не `f`.

**3. Кнопки в боковом меню** (`sidebarButtons`)
Добавляет три пункта быстрого доступа сразу после "Главная" в левом боковом меню YouTube: **Подписки**, **Смотреть позже** и **Плейлисты**. У каждого своя иконка, подсветка активного пункта на текущей странице, переход в той же вкладке по левому клику и открытие в новой вкладке по клику средней кнопкой мыши. Кнопки сохраняются при SPA-навигации YouTube (появляются заново автоматически при переходах). Пункт "Главная" в боковом меню ищется через трёхступенчатый резервный механизм, чтобы это работало независимо от языка интерфейса YouTube: сначала по русской подписи, затем по языконезависимому структурному признаку (пункт, ссылка которого ведёт на `/`), затем по английской подписи.

**4. Прогресс просмотра видео** (`viewProgress`)
Добавляет небольшое кольцо прогресса рядом с информацией о канале/авторе на странице просмотра (и рядом с информацией о видео на странице плейлиста), показывающее `прошло / всего` времени. При наведении показывается подсказка с процентом просмотренного и оставшимся временем. Обновляется в реальном времени по мере воспроизведения и автоматически исчезает при уходе со страницы видео.

### Страница настроек

Открывается из карточки расширения на странице расширений браузера. Разделена на три независимые карточки:
- **Модули** — по одному чекбоксу на каждый модуль выше, для полного включения/выключения. Изменения применяются при следующей загрузке/перезагрузке вкладки YouTube.
- **Логирование** — единый переключатель, не привязанный к конкретному модулю, включающий/выключающий отладочные логи расширения в консоль браузера. Все четыре модуля пишут логи через одну общую функцию, подписанную именем самого расширения, вместо того чтобы каждый модуль логировал по-своему.
- **Настройки кнопки загрузки** — собственные параметры кнопок загрузки/превью: показывать ли кнопку загрузки, показывать ли кнопку превью, и строка протокола/команды для передачи ссылки на видео внешней программе загрузки.

Все настройки сохраняются автоматически при изменении (`chrome.storage.sync`, синхронизируется между браузерами пользователя) — отдельной кнопки "Сохранить" нет.

### Локализация

Полностью локализовано через `_locales` (английский и русский) — язык интерфейса подстраивается под язык браузера. Это касается всех подписей на странице настроек, встраиваемых в страницу подсказок и подписей кнопок бокового меню, а также всех сообщений в консоли. Название самого расширения намеренно одинаково на обоих языках.

### Разрешения

- `storage` — сохранение и синхронизация всех настроек выше.
- `host_permissions` на `https://www.youtube.com/*` — единственный сайт, на котором работает расширение.

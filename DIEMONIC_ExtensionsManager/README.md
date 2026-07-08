# D!EMONIC | Extension Manager

Менеджер установленных браузерных расширений: список всех расширений в один клик, включение/выключение, удаление, переход в настройки и выгрузка исходников (CRX/ZIP) любого расширения из каталога.

## Summary / Краткое описание

**EN:** A compact manager for your installed browser extensions — view, enable, disable, remove, and export any of them as CRX or ZIP, right from the toolbar popup.

**RU:** Компактный менеджер установленных расширений браузера — просмотр, включение/выключение, удаление и экспорт в CRX/ZIP прямо из всплывающего окна панели инструментов.

## Description / Полное описание

**EN**

D!EMONIC Extension Manager replaces the need to open the browser's built-in extensions page for everyday management tasks. Click the toolbar icon and a popup opens showing every extension currently installed, sorted with enabled extensions first, then unpacked/development extensions, then alphabetically.

Each row shows the extension's icon, name, and version, plus quick actions:
- a toggle to enable or disable the extension instantly;
- a settings shortcut that opens the extension's own options page, when it has one;
- a one-click download button that saves the extension's current package as a ZIP archive.

Clicking a row opens a details view with the extension's full description, version, and type (regular or development/unpacked). From there you can:
- open the extension's page in the Chrome Web Store, or copy its store URL to the clipboard;
- download the extension's package as a CRX or ZIP file — useful for backing up a version you rely on, inspecting what an extension contains, or reinstalling it later;
- jump straight to the extension's settings page;
- uninstall the extension, with a confirmation step to prevent accidental removal.

A live counter at the bottom of the popup shows how many extensions are currently installed, and the list updates automatically whenever an extension is installed, removed, enabled, or disabled — including changes made outside the popup. A link at the top opens the browser's native extensions page for anything the popup doesn't cover.

The extension is aimed at power users, developers, and anyone who manages several browser extensions and wants faster access to enable/disable/remove actions and the ability to keep local backups of extension packages, without digging through the standard extensions settings page. It is fully localized (English and Russian) and adapts to the browser's language automatically.

**RU**

D!EMONIC Extension Manager избавляет от необходимости каждый раз открывать встроенную страницу расширений браузера для рутинных задач. По клику на иконку в панели инструментов открывается всплывающее окно со списком всех установленных расширений: сначала включённые, затем расширения для разработчиков (распакованные), далее — по алфавиту.

В каждой строке списка отображаются иконка, название и версия расширения, а также быстрые действия:
- переключатель для мгновенного включения/выключения расширения;
- переход в настройки расширения, если они у него есть;
- кнопка для скачивания текущего пакета расширения в виде ZIP-архива в один клик.

Клик по строке открывает подробную карточку расширения с полным описанием, версией и типом (обычное или расширение для разработчиков). Из карточки можно:
- открыть страницу расширения в Chrome Web Store или скопировать ссылку на неё в буфер обмена;
- скачать пакет расширения в формате CRX или ZIP — удобно для резервного копирования нужной версии, изучения содержимого расширения или повторной установки в будущем;
- перейти в настройки расширения;
- удалить расширение — с подтверждением, чтобы избежать случайного удаления.

Счётчик внизу окна показывает текущее количество установленных расширений, а список автоматически обновляется при установке, удалении, включении или отключении любого расширения — в том числе изменений, сделанных вне всплывающего окна. Ссылка в верхней части попапа открывает стандартную страницу расширений браузера для остальных задач.

Расширение рассчитано на опытных пользователей, разработчиков и всех, кто управляет несколькими расширениями и хочет быстрее включать/выключать/удалять их, а также иметь возможность локально сохранять резервные копии пакетов расширений — без необходимости каждый раз открывать стандартную страницу настроек расширений. Поддерживается локализация (английский и русский), язык подбирается автоматически по языку браузера.

## Permissions / Обоснование разрешений

- `management` — получение списка установленных расширений и управление ими (включение/выключение/удаление) — основная функция расширения.
- `storage`, `unlimitedStorage` — хранение пользовательских настроек.
- `downloads` — сохранение CRX/ZIP пакетов на диск.
- `clipboardWrite` — копирование ссылки на страницу расширения в Chrome Web Store.
- `host_permissions` (`clients2.google.com`, `clients2.googleusercontent.com`) — загрузка CRX-пакета выбранного расширения напрямую с серверов обновлений Google для последующего экспорта пользователем.

importScripts('colors.js');

chrome.runtime.onInstalled.addListener(() => {
  console.log('my sticky notes installed successfully');

  // Основной пункт меню
  chrome.contextMenus.create({
    id: 'diemonicNotes-root',
    title: 'Создать заметку',
    contexts: ['all']
  });

  // Пункты с цветами
  NOTE_COLORS.forEach(color => {
    chrome.contextMenus.create({
      id: `diemonicNotes-color-${color.id}`,
      parentId: 'diemonicNotes-root',
      title: color.title,
      contexts: ['all']
    });
  });

  // Новый пункт меню для настроек
  chrome.contextMenus.create({
    id: 'diemonicNotes-settings',
    title: 'Посмотреть все заметки',
    contexts: ['all']
  });
});

chrome.contextMenus.onClicked.addListener((info) => {
  if (!info.menuItemId.startsWith('diemonicNotes-')) return;

  if (info.menuItemId === 'diemonicNotes-settings') {
    chrome.tabs.create({ url: chrome.runtime.getURL('options.html') });
    return;
  }

  const colorId = info.menuItemId.replace('diemonicNotes-color-', '');
  const color = NOTE_COLORS.find(c => c.id === colorId);

  if (!color) return;

  console.log('Выбран цвет заметки для создания:', color.value);
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, {
      action: 'addStickyNote',
      color: color.value
    });
  });
});

// Handle keyboard shortcuts
chrome.commands.onCommand.addListener((command) => {
  if (command === 'toggle-highlighter') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, { action: 'toggleHighlighter', enabled: true });
    });
  }
});

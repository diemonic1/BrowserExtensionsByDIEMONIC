let highlighterEnabled = false;
let currentColor = '#FF9800';
let highlights = [];
let stickyNotes = [];
const pageUrl = window.location.href;

// Initialize
init();

function init() {
  // Load existing highlights and notes for this page
  chrome.storage.local.get(['highlights', 'stickyNotes', 'selectedColor'], (result) => {
    if (result.selectedColor) {
      currentColor = result.selectedColor;
    }

    if (result.highlights && result.highlights[pageUrl]) {
      highlights = result.highlights[pageUrl];
      restoreHighlights();
    }

    if (result.stickyNotes && result.stickyNotes[pageUrl]) {
      stickyNotes = result.stickyNotes[pageUrl];
      restoreStickyNotes();
    }
  });
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'toggleHighlighter') {
    highlighterEnabled = request.enabled;
    currentColor = request.color;
    document.body.style.cursor = highlighterEnabled ? 'crosshair' : 'default';
  } else if (request.action === 'changeColor') {
    currentColor = request.color;
  } else if (request.action === 'addStickyNote') {

    const min = -50;
    const max = 50;

    const posX = (window.innerWidth / 2) + Math.floor(Math.random() * (max - min + 1)) + min;
    const posY = (window.innerHeight / 2) + Math.floor(Math.random() * (max - min + 1)) + min;

    createStickyNote(posX, posY, request.color);
  }
});

// Mouse selection for highlighting
document.addEventListener('mouseup', (e) => {
  if (!highlighterEnabled) return;

  const selection = window.getSelection();
  const text = selection.toString().trim();

  if (text.length > 0) {
    const range = selection.getRangeAt(0);
    highlightSelection(range, text);
    selection.removeAllRanges();
  }
});

function highlightSelection(range, text) {
  const span = document.createElement('span');
  span.className = 'diemonicNotes-highlight';
  span.style.backgroundColor = currentColor;
  span.style.position = 'relative';
  span.style.cursor = 'pointer';

  try {
    range.surroundContents(span);

    const highlightData = {
      id: Date.now(),
      text: text,
      color: currentColor,
      timestamp: new Date().toISOString(),
      comment: ''
    };

    highlights.push(highlightData);
    saveHighlights();

    // Add click event to add comment
    span.addEventListener('click', (e) => {
      e.stopPropagation();
      showCommentDialog(span, highlightData);
    });

    // Add hover indicator
    span.addEventListener('mouseenter', () => {
      if (highlightData.comment) {
        showTooltip(span, highlightData.comment);
      }
    });

    span.addEventListener('mouseleave', () => {
      hideTooltip();
    });

  } catch (e) {
    console.error('Could not highlight selection:', e);
  }
}

function showCommentDialog(element, highlightData) {
  const dialog = document.createElement('div');
  dialog.className = 'diemonicNotes-comment-dialog';
  dialog.innerHTML = `
    <div style="background: white; padding: 15px; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.3); min-width: 250px;">
      <h4 style="margin: 0 0 10px 0; color: #333; font-size: 14px;">Add Comment</h4>
      <textarea id="diemonicNotes-comment-input" style="width: 100%; height: 80px; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 15px; resize: vertical;">${highlightData.comment}</textarea>
      <div style="display: flex; gap: 8px; margin-top: 10px;">
        <button id="diemonicNotes-save-comment" style="flex: 1; padding: 8px; background: #667eea; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 600;">Save</button>
        <button id="diemonicNotes-delete-highlight" style="flex: 1; padding: 8px; background: #f44336; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 600;">Delete</button>
        <button id="diemonicNotes-cancel-comment" style="padding: 8px 12px; background: #eee; color: #000000; border: none; border-radius: 4px; cursor: pointer;">Cancel</button>
      </div>
    </div>
  `;

  dialog.style.position = 'fixed';
  dialog.style.top = '50%';
  dialog.style.left = '50%';
  dialog.style.transform = 'translate(-50%, -50%)';
  dialog.style.zIndex = '999999';

  document.body.appendChild(dialog);

  const input = dialog.querySelector('#diemonicNotes-comment-input');
  input.focus();

  dialog.querySelector('#diemonicNotes-save-comment').addEventListener('click', () => {
    highlightData.comment = input.value;
    saveHighlights();
    dialog.remove();
  });

  dialog.querySelector('#diemonicNotes-delete-highlight').addEventListener('click', () => {
    element.outerHTML = element.innerHTML;
    highlights = highlights.filter(h => h.id !== highlightData.id);
    saveHighlights();
    dialog.remove();
  });

  dialog.querySelector('#diemonicNotes-cancel-comment').addEventListener('click', () => {
    dialog.remove();
  });
}

function showTooltip(element, text) {
  hideTooltip();

  const tooltip = document.createElement('div');
  tooltip.id = 'diemonicNotes-tooltip';
  tooltip.textContent = text;
  tooltip.style.cssText = `
    position: absolute;
    background: rgba(0,0,0,0.9);
    color: white;
    padding: 8px 12px;
    border-radius: 6px;
    font-size: 12px;
    z-index: 999998;
    max-width: 300px;
    word-wrap: break-word;
    pointer-events: none;
  `;

  document.body.appendChild(tooltip);

  const rect = element.getBoundingClientRect();
  tooltip.style.top = (rect.top - tooltip.offsetHeight - 8) + 'px';
  tooltip.style.left = rect.left + 'px';
}

function hideTooltip() {
  const tooltip = document.getElementById('diemonicNotes-tooltip');
  if (tooltip) tooltip.remove();
}

function createStickyNoteWithData(noteData, withAdditional) {
  const note = document.createElement('div');
  note.style.cssText = `
    position: fixed;
    left: ${noteData.x}px;
    top: ${noteData.y}px;
    z-index: 999997;
    cursor: move;
    filter: drop-shadow(rgba(0, 0, 0, 0.55) 4px 4px 8px);
  `;

  const textIdForNoteTextarea = Date.now() + "_textarea";

  note.innerHTML = `
    <div 
        style="
          width: 200px;
          min-height: 150px;
          background: ${noteData.color};
          padding: 15px;
          border-radius: 4px;
          font-family: Courier New;
          clip-path: polygon(0px 0px, 100% 0px, 100% calc(100% - 20px), calc(100% - 20px) 100%, 0px 100%);
        "
    >
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
        <span style="font-size: 12px; opacity: 0.7;">Заметка</span>
        <button 
        class="diemonicNotes-delete-note" 
        style="
          background: rgba(0,0,0,0.2); 
          border: none; 
          color: white; 
          width: 20px; 
          height: 20px; 
          border-radius: 50%; 
          cursor: pointer; 
          font-weight: bold;    
          top: -9px;
          right: -9px;
          position: relative;
          opacity:0;
        "
        >×</button>
      </div>
      <textarea 
        id="` + textIdForNoteTextarea + `"
        class="diemonicNotes-note-text" 
        style="width: 100%; 
        height: ` + noteData.height + `; 
        min-height: 110px;
        background: transparent; 
        border: none; 
        outline: none; 
        resize: vertical; 
        color: #000000; 
        font-size: 15px;
      ">${noteData.text}</textarea>
    </div>
  `;

  document.body.appendChild(note);

  // Make draggable
  let isDragging = false;
  let startX, startY, initialX, initialY;

  note.addEventListener('mousedown', (e) => {
    if (e.target.classList.contains('diemonicNotes-note-text')) return;
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    initialX = note.offsetLeft;
    initialY = note.offsetTop;
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    note.style.left = (initialX + dx) + 'px';
    note.style.top = (initialY + dy) + 'px';
  });

  document.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      noteData.x = note.offsetLeft;
      noteData.y = note.offsetTop;
      saveStickyNotes();
    }
  });

  // Save text changes
  const textarea = note.querySelector('.diemonicNotes-note-text');
  textarea.addEventListener('input', () => {
    noteData.text = textarea.value;
    saveStickyNotes();
  });

  const observer = new ResizeObserver(entries => {
    noteData.height = textarea.style.height;
    saveStickyNotes();
  });

  observer.observe(textarea);

  // Delete note
  const deleteButton = note.querySelector('.diemonicNotes-delete-note');

  deleteButton.addEventListener('mouseenter', () => {
    deleteButton.style.opacity = 1;
  });

  deleteButton.addEventListener('mouseleave', () => {
    deleteButton.style.opacity = 0;
  });

  deleteButton.addEventListener('click', () => {
    // создаём подтверждающий попап
    const confirmBox = document.createElement('div');
    confirmBox.style.cssText = `
      position: absolute;
      top: -100px;
      left: 0;
      width: 100%;
      background: #f44336;
      color: white;
      padding: 12px;
      border-radius: 4px;
      z-index: 999998;
      box-sizing: border-box;
    `;

    confirmBox.innerHTML = `
      <div style="font-size: 13px; margin-bottom: 10px;">
        Действительно ли вы хотите удалить заметку?
      </div>
      <div style="display: flex; gap: 8px;">
        <button style="
          flex: 1;
          padding: 6px;
          background: white;
          color: #f44336;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-weight: bold;
        ">Да</button>
        <button style="
          flex: 1;
          padding: 6px;
          background: rgba(255,255,255,0.2);
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        ">Нет</button>
      </div>
    `;

    note.appendChild(confirmBox);

    const yesBtn = confirmBox.querySelector('button:first-child');
    const noBtn = confirmBox.querySelector('button:last-child');

    yesBtn.addEventListener('click', () => {
      confirmBox.remove();
      note.remove();
      stickyNotes = stickyNotes.filter(n => n.id !== noteData.id);
      saveStickyNotes();
    });

    noBtn.addEventListener('click', () => {
      confirmBox.remove();
    });
  });


  if (withAdditional) {
    stickyNotes.push(noteData);
    saveStickyNotes();
    textarea.focus();
  }
}

function createStickyNote(x, y, color) {
  const noteData = {
    id: Date.now(),
    x: x,
    y: y,
    color: color,
    text: '',
    height: '145px',
    timestamp: new Date().toISOString()
  };

  createStickyNoteWithData(noteData, true);
}

function saveHighlights() {
  chrome.storage.local.get(['highlights'], (result) => {
    const allHighlights = result.highlights || {};
    allHighlights[pageUrl] = highlights;
    chrome.storage.local.set({ highlights: allHighlights });
  });
}

function saveStickyNotes() {
  chrome.storage.local.get(['stickyNotes'], (result) => {
    const allNotes = result.stickyNotes || {};
    allNotes[pageUrl] = stickyNotes;
    chrome.storage.local.set({ stickyNotes: allNotes });
  });
}

function restoreHighlights() {
  // Note: Restoration of highlights is complex and may not work perfectly
  // due to dynamic page content. This is a simplified version.
  highlights.forEach(h => {
    const xpath = `//text()[contains(., '${h.text.substring(0, 50)}')]`;
    const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
    if (result.singleNodeValue) {
      // Simplified restoration - in production, would need more sophisticated matching
    }
  });
}

function restoreStickyNotes() {
  stickyNotes.forEach(noteData => {
    createStickyNoteWithData(noteData, false);
  });
}
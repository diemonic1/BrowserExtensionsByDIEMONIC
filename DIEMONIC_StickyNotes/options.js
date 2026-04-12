let allHighlights = {};
let allStickyNotes = {};

// Load all data
loadData();

function loadData() {
  chrome.storage.local.get(['highlights', 'stickyNotes'], (result) => {
    allHighlights = result.highlights || {};
    allStickyNotes = result.stickyNotes || {};

    updateStats();
    renderContent();
  });
}

function updateStats() {
  const highlightCount = Object.values(allHighlights).reduce((sum, arr) => sum + arr.length, 0);
  const noteCount = Object.values(allStickyNotes).reduce((sum, arr) => sum + arr.length, 0);
  const pageCount = new Set([...Object.keys(allHighlights), ...Object.keys(allStickyNotes)]).size;

  document.getElementById('totalHighlights').textContent = highlightCount;
  document.getElementById('totalNotes').textContent = noteCount;
  document.getElementById('totalPages').textContent = pageCount;
}

function renderContent(searchTerm = '') {
  const content = document.getElementById('content');
  content.innerHTML = '';

  const allPages = new Set([...Object.keys(allHighlights), ...Object.keys(allStickyNotes)]);

  if (allPages.size === 0) {
    content.innerHTML = `
      <div class="empty-state">
        <h2>No annotations yet</h2>
        <p>Start highlighting and creating notes on web pages!</p>
      </div>
    `;
    return;
  }

  allPages.forEach(url => {
    const pageHighlights = (allHighlights[url] || []).filter(h =>
      !searchTerm || h.text.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (h.comment && h.comment.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const pageNotes = (allStickyNotes[url] || []).filter(n =>
      !searchTerm || n.text.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (pageHighlights.length === 0 && pageNotes.length === 0 && searchTerm) return;

    const section = document.createElement('div');
    section.className = 'page-section';

    const urlObj = new URL(url);
    const displayUrl = urlObj.hostname + urlObj.pathname;

    const id = Date.now() + "_delete_button_" + url;

    section.innerHTML = `
      <div class="page-header">
        <div>
          <div class="page-url">${displayUrl}</div>
          <div class="page-date">${pageHighlights.length} highlights, ${pageNotes.length} notes</div>
        </div>
        <button class="delete-item-btn" id="${id + '_1'}">Delete All</button>
      </div>
      <div class="items-container">
      </div>
    `;

    pageHighlights.forEach(h => {
      const highlightEl = document.createElement('div');
      highlightEl.className = 'highlight-item';
      highlightEl.innerHTML = `
            <div class="highlight-text" style="border-left-color: ${h.color};">${h.text}</div>
            ${h.comment ? `<div class="highlight-comment">"${h.comment}"</div>` : ''}
            <div class="item-meta">
              <span>${new Date(h.timestamp).toLocaleDateString()}</span>
              <button class="delete-item-btn">Delete</button>
            </div>
        `;
      const delBtn = highlightEl.querySelector('.delete-item-btn');
      delBtn.addEventListener('click', () => deleteHighlight(url, h.id));
      section.querySelector('.items-container').appendChild(highlightEl);
    });

    pageNotes.forEach(n => {
      const noteEl = document.createElement('div');
      noteEl.className = 'note-item';
      noteEl.innerHTML = `
            <div class="highlight-text" style="background: ${n.color}; padding: 10px; border-radius: 4px;">
                ${n.text || '(Empty note)'}
            </div>
            <div class="item-meta">
              <span>${new Date(n.timestamp).toLocaleDateString()}</span>
              <button class="delete-item-btn">Delete</button>
            </div>
        `;
      const delBtn = noteEl.querySelector('.delete-item-btn');
      delBtn.addEventListener('click', () => deleteNote(url, n.id));
      section.querySelector('.items-container').appendChild(noteEl);
    });

    content.appendChild(section);

    const del1 = document.getElementById(id + '_1');

    del1.addEventListener('click', () => {
      deletePage(url);
    });

  });
}

// Search functionality
document.getElementById('searchInput').addEventListener('input', (e) => {
  renderContent(e.target.value);
});

// Export data
document.getElementById('exportBtn').addEventListener('click', () => {
  const data = {
    highlights: allHighlights,
    stickyNotes: allStickyNotes,
    exportDate: new Date().toISOString()
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `diemonicNotes-export-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

// Clear all data
document.getElementById('clearAllBtn').addEventListener('click', () => {
  if (confirm('Are you sure you want to delete all highlights and notes? This cannot be undone.')) {
    chrome.storage.local.set({ highlights: {}, stickyNotes: {} }, () => {
      allHighlights = {};
      allStickyNotes = {};
      updateStats();
      renderContent();
    });
  }
});

// Delete functions (called from inline onclick)
window.deleteHighlight = (url, id) => {
  allHighlights[url] = allHighlights[url].filter(h => h.id !== id);
  if (allHighlights[url].length === 0) delete allHighlights[url];
  chrome.storage.local.set({ highlights: allHighlights }, () => {
    loadData();
  });
};

window.deleteNote = (url, id) => {
  allStickyNotes[url] = allStickyNotes[url].filter(n => n.id !== id);
  if (allStickyNotes[url].length === 0) delete allStickyNotes[url];
  chrome.storage.local.set({ stickyNotes: allStickyNotes }, () => {
    loadData();
  });
};

window.deletePage = (url) => {
  if (confirm('Delete all annotations for this page? ' + url)) {
    delete allHighlights[url];
    delete allStickyNotes[url];
    chrome.storage.local.set({
      highlights: allHighlights,
      stickyNotes: allStickyNotes
    }, () => {
      loadData();
    });
  }
};
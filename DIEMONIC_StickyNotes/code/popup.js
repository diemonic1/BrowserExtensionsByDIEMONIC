let selectedColor = '#FF9800';
let highlighterEnabled = false;

// Load saved color and stats
chrome.storage.local.get(['selectedColor', 'highlights', 'stickyNotes'], (result) => {
  if (result.selectedColor) {
    selectedColor = result.selectedColor;
    updateActiveColor(selectedColor);
  }

  // Update stats
  const highlightCount = result.highlights ? Object.keys(result.highlights).reduce((sum, url) => sum + result.highlights[url].length, 0) : 0;
  const noteCount = result.stickyNotes ? Object.keys(result.stickyNotes).reduce((sum, url) => sum + result.stickyNotes[url].length, 0) : 0;

  document.getElementById('highlightCount').textContent = highlightCount;
  document.getElementById('noteCount').textContent = noteCount;
});

// Color selection
document.querySelectorAll('.color-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    selectedColor = e.target.dataset.color;
    updateActiveColor(selectedColor);
    chrome.storage.local.set({ selectedColor });

    // Send to content script
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, {
        action: 'changeColor',
        color: selectedColor
      });
    });
  });
});

function updateActiveColor(color) {
  document.querySelectorAll('.color-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.color === color);
  });
}

// Toggle highlighter
document.getElementById('toggleHighlighter').addEventListener('click', () => {
  highlighterEnabled = !highlighterEnabled;
  const btn = document.getElementById('toggleHighlighter');

  if (highlighterEnabled) {
    btn.textContent = 'Disable Highlighter';
    btn.style.background = '#f44336';
  } else {
    btn.textContent = 'Enable Highlighter';
    btn.style.background = '#667eea';
  }

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, {
      action: 'toggleHighlighter',
      enabled: highlighterEnabled,
      color: selectedColor
    });
  });
});

// Add sticky note
document.getElementById('addStickyNote').addEventListener('click', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, {
      action: 'addStickyNote',
      color: selectedColor
    });
  });
  window.close();
});

// View dashboard
document.getElementById('viewDashboard').addEventListener('click', () => {
  chrome.tabs.create({ url: 'options.html' });
});

const colorsList = document.getElementById('ColorsList');

colorsList.innerHTML = "";

NOTE_COLORS.forEach((color, index) => {
  const btn = document.createElement("button");
  btn.className = "color-btn";
  btn.dataset.color = color.value;
  btn.title = color.title;
  btn.style.background = color.value;

  if (index === 0) {
    btn.classList.add("active");
  }

  btn.addEventListener("click", () => {
    document.querySelectorAll("#ColorsList .color-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    console.log("Выбран цвет:", color.value);
  });

  colorsList.appendChild(btn);
});
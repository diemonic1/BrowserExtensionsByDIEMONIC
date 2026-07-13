const resumeInput = document.getElementById("resumeInput");
const saveState = document.getElementById("saveState");
let saveTimer = null;

function setSaveState(text) {
    saveState.textContent = text;
}

function saveResume(value) {
    chrome.storage.local.set({ resumeText: value }, () => {
        setSaveState("Сохранено");
    });
}

function scheduleSave(value) {
    setSaveState("Сохранение...");
    if (saveTimer) {
        clearTimeout(saveTimer);
    }

    saveTimer = setTimeout(() => {
        saveResume(value);
    }, 120);
}

function init() {
    chrome.storage.local.get({ resumeText: "" }, data => {
        resumeInput.value = data.resumeText || "";
        setSaveState("Готово");
    });

    resumeInput.addEventListener("input", event => {
        scheduleSave(event.target.value);
    });
}

init();

const ICON_VERSIONS = ["v1", "v2", "v3", "v4", "v5", "v6", "v7", "v8", "v9", "v10", "v11"];

const DEFAULT_SETTINGS = {
    iconVersion: "v1",
};

function buildIconGrid() {
    const grid = document.getElementById("iconGrid");
    const label = chrome.i18n.getMessage("iconOptionLabel");

    const fragment = document.createDocumentFragment();
    ICON_VERSIONS.forEach((version) => {
        const tile = document.createElement("button");
        tile.type = "button";
        tile.className = "icon-tile";
        tile.dataset.version = version;
        tile.setAttribute("aria-label", label);
        tile.setAttribute("aria-pressed", "false");

        const img = document.createElement("img");
        img.src = `../icon/${version}/128.png`;
        img.alt = "";

        const check = document.createElement("span");
        check.className = "icon-tile-check";
        check.setAttribute("aria-hidden", "true");
        check.textContent = "✓";

        tile.append(img, check);
        fragment.appendChild(tile);
    });

    grid.appendChild(fragment);
}

function applyI18n() {
    document.title = chrome.i18n.getMessage("optionsTitle");
    document.getElementById("iconSectionTitle").textContent = chrome.i18n.getMessage("iconSectionTitle");
}

function setSelectedTile(version) {
    document.querySelectorAll(".icon-tile").forEach((tile) => {
        const isSelected = tile.dataset.version === version;
        tile.classList.toggle("selected", isSelected);
        tile.setAttribute("aria-pressed", String(isSelected));
    });

    document.getElementById("headerIcon").src = `../icon/${version}/48.png`;
}

document.addEventListener("DOMContentLoaded", () => {
    buildIconGrid();
    applyI18n();

    chrome.storage.sync.get(DEFAULT_SETTINGS, (settings) => {
        setSelectedTile(settings.iconVersion);
    });

    document.getElementById("iconGrid").addEventListener("click", (event) => {
        const tile = event.target.closest(".icon-tile");
        if (!tile) {
            return;
        }

        const version = tile.dataset.version;
        setSelectedTile(version);
        chrome.storage.sync.set({ iconVersion: version });
    });
});

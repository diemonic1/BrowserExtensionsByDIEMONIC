const ICON_VERSIONS = ["v1", "v2", "v3", "v4", "v5", "v6", "v7", "v8", "v9", "v10", "v11"];

const DEFAULT_SETTINGS = {
    iconVersion: "v1",
    groups: [],
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
    document.getElementById("groupsSectionTitle").textContent = chrome.i18n.getMessage("groupsSectionTitle");
    document.getElementById("groupsInstructions").textContent = chrome.i18n.getMessage("groupsInstructions");
    document.getElementById("groupsEmptyHint").textContent = chrome.i18n.getMessage("groupsEmptyHint");
    document.getElementById("addGroupBtn").setAttribute("aria-label", chrome.i18n.getMessage("addGroupLabel"));
    document.getElementById("confirmTitle").textContent = chrome.i18n.getMessage("confirmGroupRemovalTitle");
    document.getElementById("confirmText").textContent = chrome.i18n.getMessage("confirmGroupRemovalText");
    document.getElementById("confirmCancelBtn").textContent = chrome.i18n.getMessage("cancel");
    document.getElementById("confirmDeleteBtn").textContent = chrome.i18n.getMessage("confirm");
}

function setSelectedTile(version) {
    document.querySelectorAll(".icon-tile").forEach((tile) => {
        const isSelected = tile.dataset.version === version;
        tile.classList.toggle("selected", isSelected);
        tile.setAttribute("aria-pressed", String(isSelected));
    });

    document.getElementById("headerIcon").src = `../icon/${version}/48.png`;
}

//#region Groups
let groups = [];
let dragSourceGroupId = null;
let pendingRemoveGroupId = null;

function persistGroups() {
    chrome.storage.sync.set({ groups });
}

function findGroupIndexById(id) {
    return groups.findIndex((group) => group.id === id);
}

function createGroupId() {
    return typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `group-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function openRemoveGroupConfirm(id) {
    pendingRemoveGroupId = id;
    const backdrop = document.getElementById("confirmBackdrop");
    backdrop.classList.remove("hidden");
    backdrop.setAttribute("aria-hidden", "false");
}

function closeRemoveGroupConfirm() {
    pendingRemoveGroupId = null;
    const backdrop = document.getElementById("confirmBackdrop");
    backdrop.classList.add("hidden");
    backdrop.setAttribute("aria-hidden", "true");
}

function renderGroups() {
    const list = document.getElementById("groupsList");
    const emptyHint = document.getElementById("groupsEmptyHint");
    const dragLabel = chrome.i18n.getMessage("dragGroupLabel");
    const removeLabel = chrome.i18n.getMessage("removeGroupLabel");
    const placeholder = chrome.i18n.getMessage("groupKeywordsPlaceholder");

    emptyHint.classList.toggle("hidden", groups.length > 0);

    const fragment = document.createDocumentFragment();

    groups.forEach((group) => {
        const row = document.createElement("div");
        row.className = "group-row";
        row.dataset.id = group.id;

        const handle = document.createElement("button");
        handle.type = "button";
        handle.className = "drag-handle";
        handle.setAttribute("aria-label", dragLabel);
        handle.textContent = "⠿";

        const input = document.createElement("input");
        input.type = "text";
        input.className = "group-input";
        input.placeholder = placeholder;
        input.value = group.keywords;
        input.addEventListener("input", () => {
            const idx = findGroupIndexById(group.id);
            if (idx === -1) {
                return;
            }
            groups[idx].keywords = input.value;
            persistGroups();
        });

        const removeBtn = document.createElement("button");
        removeBtn.type = "button";
        removeBtn.className = "remove-group-btn";
        removeBtn.setAttribute("aria-label", removeLabel);
        removeBtn.textContent = "×";
        removeBtn.addEventListener("click", () => {
            openRemoveGroupConfirm(group.id);
        });

        // Dragging is only initiated from the handle, so the input keeps normal
        // text-selection/cursor behavior everywhere else in the row.
        handle.addEventListener("mousedown", () => {
            row.draggable = true;
        });
        row.addEventListener("dragend", () => {
            row.draggable = false;
            row.classList.remove("dragging");
        });
        document.addEventListener("mouseup", () => {
            row.draggable = false;
        });

        row.addEventListener("dragstart", (event) => {
            dragSourceGroupId = group.id;
            row.classList.add("dragging");
            event.dataTransfer.effectAllowed = "move";
        });

        row.addEventListener("dragover", (event) => {
            event.preventDefault();
            event.dataTransfer.dropEffect = "move";
        });

        row.addEventListener("drop", (event) => {
            event.preventDefault();
            if (!dragSourceGroupId || dragSourceGroupId === group.id) {
                return;
            }

            const fromIndex = findGroupIndexById(dragSourceGroupId);
            const toIndex = findGroupIndexById(group.id);
            dragSourceGroupId = null;
            if (fromIndex === -1 || toIndex === -1) {
                return;
            }

            const [moved] = groups.splice(fromIndex, 1);
            groups.splice(toIndex, 0, moved);
            persistGroups();
            renderGroups();
        });

        row.append(handle, input, removeBtn);
        fragment.appendChild(row);
    });

    list.replaceChildren(fragment);
}

function initGroups() {
    document.getElementById("addGroupBtn").addEventListener("click", () => {
        groups.push({ id: createGroupId(), keywords: "" });
        persistGroups();
        renderGroups();

        const inputs = document.querySelectorAll(".group-input");
        const lastInput = inputs[inputs.length - 1];
        if (lastInput) {
            lastInput.focus();
        }
    });

    const confirmBackdrop = document.getElementById("confirmBackdrop");
    document.getElementById("confirmCancelBtn").addEventListener("click", closeRemoveGroupConfirm);
    confirmBackdrop.addEventListener("click", (event) => {
        if (event.target === confirmBackdrop) {
            closeRemoveGroupConfirm();
        }
    });
    document.getElementById("confirmDeleteBtn").addEventListener("click", () => {
        if (!pendingRemoveGroupId) {
            return;
        }

        groups = groups.filter((group) => group.id !== pendingRemoveGroupId);
        persistGroups();
        closeRemoveGroupConfirm();
        renderGroups();
    });
}
//#endregion

document.addEventListener("DOMContentLoaded", () => {
    buildIconGrid();
    applyI18n();
    initGroups();

    chrome.storage.sync.get(DEFAULT_SETTINGS, (settings) => {
        setSelectedTile(settings.iconVersion);
        groups = Array.isArray(settings.groups) ? settings.groups : [];
        renderGroups();
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

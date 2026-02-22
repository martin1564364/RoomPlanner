import { items, removeItem, hexStringToNumber, updateItemSettings } from './items.js';
import { startPlacement, cancelPlacement, setViewMode } from './interaction.js';
import { exportToClipboard, importFromClipboard, autosave } from './project.js';

let onRoomApply = null;
let onViewToggleCb = null;
let _roomConfig = null;
let editingItemId = null;
let is3DView = false;

export function initUI(roomApplyCallback, viewToggleCallback) {
  onRoomApply = roomApplyCallback;
  onViewToggleCb = viewToggleCallback;

  // Opacity slider label
  const opacitySlider = document.getElementById('item-opacity');
  const opacityValue = document.getElementById('opacity-value');
  opacitySlider.addEventListener('input', () => {
    opacityValue.textContent = opacitySlider.value + '%';
  });

  // Widok 2D/3D toggle
  const toggleBtn = document.getElementById('toggle-view');
  toggleBtn.addEventListener('click', () => {
    is3DView = !is3DView;
    const mode = is3DView ? '3D' : '2D';
    toggleBtn.textContent = 'Widok: ' + mode;

    // Wizualnie ukryj kontrolki edycji pokoju/mebli jeśli 3D
    const controlsSections = document.querySelectorAll('.sidebar-section:not(:last-child)');
    controlsSections.forEach(sec => {
      sec.style.opacity = is3DView ? '0.3' : '1';
      sec.style.pointerEvents = is3DView ? 'none' : 'auto';
    });

    if (is3DView && editingItemId !== null) cancelEditMode();

    setViewMode(mode);
    if (onViewToggleCb) onViewToggleCb(mode);
  });

  // Room apply button
  document.getElementById('apply-room').addEventListener('click', () => {
    const width = parseFloat(document.getElementById('room-width').value) || 4.2;
    const depth = parseFloat(document.getElementById('room-depth').value) || 2.32;
    const height = parseFloat(document.getElementById('room-height').value) || 2.5;
    if (onRoomApply) {
      onRoomApply({ width, depth, height });
      _roomConfig = { width, depth, height };
      autosave(_roomConfig);
    }
  });

  // Add furniture button
  document.getElementById('add-furniture').addEventListener('click', () => {
    const config = readItemForm(false);
    startPlacement(config);
  });

  // Add blocked zone button
  document.getElementById('add-blocked').addEventListener('click', () => {
    const config = readItemForm(true);
    startPlacement(config);
  });

  document.getElementById('save-item').addEventListener('click', () => {
    if (editingItemId === null) return;
    const item = items.find(i => i.id === editingItemId);
    const config = readItemForm(item.isBlocked);
    updateItemSettings(editingItemId, config);
    cancelEditMode();
    renderItemsList();
    autosave(getRoomConfig());
  });

  document.getElementById('cancel-edit').addEventListener('click', () => {
    cancelEditMode();
  });

  // Export button
  document.getElementById('btn-export').addEventListener('click', () => {
    const rc = getRoomConfig();
    exportToClipboard(rc);
    autosave(rc);
  });

  // Import button
  document.getElementById('btn-import').addEventListener('click', () => {
    importFromClipboard(
      (newRoom) => {
        _roomConfig = newRoom;
        if (onRoomApply) onRoomApply(newRoom);
      },
      () => {
        renderItemsList();
        autosave(getRoomConfig());
      }
    );
  });

  document.getElementById('edit-buttons').style.display = 'none';

  renderItemsList();
}

// Odczytaj aktualną konfigurację pokoju z pól formularza
function getRoomConfig() {
  if (_roomConfig) return _roomConfig;
  return {
    width: parseFloat(document.getElementById('room-width').value) || 4.2,
    depth: parseFloat(document.getElementById('room-depth').value) || 2.32,
    height: parseFloat(document.getElementById('room-height').value) || 2.5,
  };
}

function readItemForm(isBlocked) {
  const name = document.getElementById('item-name').value.trim() || 'Element';
  const width = parseFloat(document.getElementById('item-width').value) || 1.0;
  const depth = parseFloat(document.getElementById('item-depth').value) || 1.0;
  const height = parseFloat(document.getElementById('item-height').value) || 0.8;
  const floorHeight = parseFloat(document.getElementById('item-floor-height').value) || 0;
  const colorHex = document.getElementById('item-color').value;
  const opacityPct = parseInt(document.getElementById('item-opacity').value) || 0;

  let finalOpacity = opacityPct;
  if (isBlocked && opacityPct === 0) {
    // Jeżeli użytkownik dodaje strefę i nie ruszał suwaka, dajemy 50% domyślnie
    finalOpacity = 50;
  }

  if (isBlocked) {
    return { name, width, depth, height, floorHeight, color: 0xb0b0b0, opacity: finalOpacity, isBlocked: true };
  }
  return { name, width, depth, height, floorHeight, color: hexStringToNumber(colorHex), opacity: finalOpacity, isBlocked: false };
}

export function renderItemsList() {
  const list = document.getElementById('items-list');
  const empty = document.getElementById('items-empty');
  list.innerHTML = '';

  if (items.length === 0) {
    empty.style.display = '';
    return;
  }
  empty.style.display = 'none';

  for (const item of items) {
    const li = document.createElement('li');
    li.className = 'item-entry';

    // Color dot
    const dot = document.createElement('span');
    dot.className = 'item-dot';
    const colorNum = typeof item.color === 'number' ? item.color : 0xb0b0b0;
    dot.style.background = '#' + colorNum.toString(16).padStart(6, '0');
    if (item.isBlocked) dot.style.backgroundImage = 'repeating-linear-gradient(45deg,transparent,transparent 2px,rgba(0,0,0,0.2) 2px,rgba(0,0,0,0.2) 4px)';
    li.appendChild(dot);

    // Label
    const label = document.createElement('span');
    label.className = 'item-label';
    label.textContent = item.name;
    li.appendChild(label);

    // Dimensions
    const dims = document.createElement('span');
    dims.className = 'item-dims';
    dims.textContent = `${item.width}×${item.depth}`;
    li.appendChild(dims);

    const btnGroup = document.createElement('span');
    btnGroup.style.display = 'flex';
    btnGroup.style.gap = '4px';

    const editBtn = document.createElement('button');
    editBtn.className = 'item-edit';
    editBtn.textContent = '✎';
    editBtn.title = 'Edytuj element';
    editBtn.style.background = 'none';
    editBtn.style.border = 'none';
    editBtn.style.color = '#ccc';
    editBtn.style.cursor = 'pointer';
    editBtn.addEventListener('click', () => enterEditMode(item));
    btnGroup.appendChild(editBtn);

    const btn = document.createElement('button');
    btn.className = 'item-remove';
    btn.textContent = '✕';
    btn.title = 'Usuń element';
    btn.addEventListener('click', () => {
      removeItem(item.id);
      if (editingItemId === item.id) cancelEditMode();
      renderItemsList();
      autosave(getRoomConfig());
    });
    btnGroup.appendChild(btn);

    li.appendChild(btnGroup);

    list.appendChild(li);
  }
}

function enterEditMode(item) {
  editingItemId = item.id;
  document.getElementById('form-title').textContent = 'Edytuj element';
  document.getElementById('add-buttons').style.display = 'none';
  document.getElementById('edit-buttons').style.display = 'flex';

  document.getElementById('item-name').value = item.name;
  document.getElementById('item-width').value = item.width;
  document.getElementById('item-depth').value = item.depth;
  document.getElementById('item-height').value = item.height;
  if (document.getElementById('item-floor-height')) {
    document.getElementById('item-floor-height').value = item.floorHeight || 0;
  }

  const colorHex = '#' + item.color.toString(16).padStart(6, '0');
  document.getElementById('item-color').value = colorHex;
  const targetOpacity = item.isBlocked ? item.opacity : (item.opacity || 0);
  document.getElementById('item-opacity').value = targetOpacity;
  document.getElementById('opacity-value').textContent = targetOpacity + '%';

  // Anuluj umieszczanie jeśli aktywny jest ghost mesh
  cancelPlacement();
}

function cancelEditMode() {
  editingItemId = null;
  document.getElementById('form-title').textContent = 'Dodaj element';
  document.getElementById('add-buttons').style.display = 'flex';
  document.getElementById('edit-buttons').style.display = 'none';
}

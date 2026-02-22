import * as THREE from 'three';
import { items, addItem, updateItemPosition, updateItemRotation, createGhostMesh } from './items.js';
import { renderItemsList } from './ui.js';
import { autosave } from './project.js';

let canvas, orthoCamera, scene, roomConfig;
let ghostMesh = null;
let pendingConfig = null;
let isDragging = false;
let dragItemId = null;
let dragOffsetX = 0;
let dragOffsetZ = 0;
let selectedItemId = null;
let viewMode = '2D';

const SNAP_RAD = Math.PI / 2;   // 90°

const raycaster = new THREE.Raycaster();
const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const hitPoint = new THREE.Vector3();

export function initInteraction(canvasEl, orthoCam, sceneRef, roomCfg) {
  canvas = canvasEl;
  orthoCamera = orthoCam;
  scene = sceneRef;
  roomConfig = roomCfg;

  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  canvas.addEventListener('mouseup', onMouseUp);
  canvas.addEventListener('contextmenu', onContextMenu);
  window.addEventListener('keydown', onKeyDown);
}

export function updateRoomConfig(cfg) {
  Object.assign(roomConfig, cfg);
}

export function setViewMode(mode) {
  viewMode = mode;
  if (mode === '3D') {
    cancelPlacement();
    if (isDragging) onMouseUp();
    selectedItemId = null;
  }
}

export function startPlacement(config) {
  cancelPlacement();
  pendingConfig = { ...config, rotation: config.rotation ?? 0 };
  ghostMesh = createGhostMesh(pendingConfig);
  scene.add(ghostMesh);
  canvas.style.cursor = 'crosshair';
  document.getElementById('placement-hint').classList.remove('hidden');
}

export function cancelPlacement() {
  if (ghostMesh) {
    scene.remove(ghostMesh);
    ghostMesh.traverse(child => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
    });
    ghostMesh = null;
  }
  pendingConfig = null;
  canvas.style.cursor = '';
  document.getElementById('placement-hint').classList.add('hidden');
}

// NDC [-1,1]
function clientToNDC(e) {
  const rect = canvas.getBoundingClientRect();
  return new THREE.Vector2(
    ((e.clientX - rect.left) / canvas.clientWidth) * 2 - 1,
    -((e.clientY - rect.top) / canvas.clientHeight) * 2 + 1
  );
}

function raycastFloor(e) {
  raycaster.setFromCamera(clientToNDC(e), orthoCamera);
  const hit = raycaster.ray.intersectPlane(floorPlane, hitPoint);
  return hit ? hitPoint.clone() : null;
}

// Efektywne wymiary (zamieniamy W/D co 90° obrotu)
function effectiveDims(w, d, rotation) {
  const snapped = Math.round(rotation / SNAP_RAD) % 4;
  const odd = Math.abs(snapped) % 2 === 1;
  return odd ? { w: d, d: w } : { w, d };
}

function clampToRoom(x, z, w, d) {
  const hw = roomConfig.width / 2;
  const hd = roomConfig.depth / 2;
  return {
    x: Math.max(-hw + w / 2, Math.min(hw - w / 2, x)),
    z: Math.max(-hd + d / 2, Math.min(hd - d / 2, z)),
  };
}

function snapAngle(angle) {
  return Math.round(angle / SNAP_RAD) * SNAP_RAD;
}

function rotateItem(item, direction = 1) {
  const newRot = snapAngle(item.rotation + direction * SNAP_RAD);
  updateItemRotation(item.id, newRot);
  // Po obróceniu upewnij się że mebel nadal jest w pokoju
  const { w, d } = effectiveDims(item.width, item.depth, newRot);
  const clamped = clampToRoom(item.x, item.z, w, d);
  updateItemPosition(item.id, clamped.x, clamped.z);
  selectedItemId = item.id;
  autosave(roomConfig);
}

function onMouseMove(e) {
  if (viewMode === '3D') return;
  const worldPos = raycastFloor(e);
  if (!worldPos) return;

  if (ghostMesh && pendingConfig) {
    const { w, d } = effectiveDims(pendingConfig.width, pendingConfig.depth, pendingConfig.rotation ?? 0);
    const clamped = clampToRoom(worldPos.x, worldPos.z, w, d);
    ghostMesh.position.set(clamped.x, pendingConfig.height / 2, clamped.z);
  }

  if (isDragging && dragItemId !== null) {
    const item = items.find(i => i.id === dragItemId);
    if (item) {
      const { w, d } = effectiveDims(item.width, item.depth, item.rotation ?? 0);
      const clamped = clampToRoom(
        worldPos.x - dragOffsetX,
        worldPos.z - dragOffsetZ,
        w, d
      );
      updateItemPosition(dragItemId, clamped.x, clamped.z);
    }
  }
}

function onMouseDown(e) {
  if (viewMode === '3D') return;
  if (e.button !== 0) return;

  const worldPos = raycastFloor(e);
  if (!worldPos) return;

  if (pendingConfig) {
    const { w, d } = effectiveDims(pendingConfig.width, pendingConfig.depth, pendingConfig.rotation ?? 0);
    const clamped = clampToRoom(worldPos.x, worldPos.z, w, d);
    addItem({ ...pendingConfig, x: clamped.x, z: clamped.z });
    cancelPlacement();
    renderItemsList();
    autosave(roomConfig);
    return;
  }

  const hit = pickItem(e);
  if (hit) {
    selectedItemId = hit.id;
    isDragging = true;
    dragItemId = hit.id;
    canvas.style.cursor = 'grabbing';
    dragOffsetX = worldPos.x - hit.x;
    dragOffsetZ = worldPos.z - hit.z;
    e.preventDefault();
  } else {
    selectedItemId = null;
  }
}

function onMouseUp() {
  if (viewMode === '3D') return;
  if (isDragging) {
    isDragging = false;
    dragItemId = null;
    canvas.style.cursor = '';
    autosave(roomConfig);
  }
}

// PPM – obróć kliknięty mebel (lub ghost) o 90°
function onContextMenu(e) {
  if (viewMode === '3D') return;
  e.preventDefault();

  if (pendingConfig && ghostMesh) {
    pendingConfig.rotation = snapAngle((pendingConfig.rotation ?? 0) + SNAP_RAD);
    ghostMesh.rotation.y = pendingConfig.rotation;
    return;
  }

  const hit = pickItem(e);
  if (hit) rotateItem(hit);
}

function onKeyDown(e) {
  if (viewMode === '3D') return;
  if (e.key === 'Escape') { cancelPlacement(); return; }

  if (e.key === 'r' || e.key === 'R') {
    if (pendingConfig && ghostMesh) {
      pendingConfig.rotation = snapAngle((pendingConfig.rotation ?? 0) + SNAP_RAD);
      ghostMesh.rotation.y = pendingConfig.rotation;
      return;
    }
    if (selectedItemId !== null) {
      const item = items.find(i => i.id === selectedItemId);
      if (item) rotateItem(item, e.shiftKey ? -1 : 1);
    }
  }
}

function pickItem(e) {
  raycaster.setFromCamera(clientToNDC(e), orthoCamera);
  const meshes = items.filter(i => i.mesh).map(i => i.mesh);
  const intersects = raycaster.intersectObjects(meshes, false);
  if (!intersects.length) return null;
  const itemId = intersects[0].object.userData.itemId;
  return items.find(i => i.id === itemId) || null;
}

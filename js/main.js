import { initScene, updateOrthoCamera, updatePerspCamera } from './scene.js';
import { buildRoom } from './room.js';
import { initItems } from './items.js';
import { initInteraction, updateRoomConfig } from './interaction.js';
import { initUI, renderItemsList } from './ui.js';
import { autosave, loadFromLocalStorage } from './project.js';

const canvas = document.getElementById('main-canvas');

let roomConfig = { width: 4.2, depth: 2.32, height: 2.5 };

// Init Three.js scene
const { renderer, scene, orthoCamera, perspCamera, controls } = initScene(canvas);

let activeCamera = orthoCamera;

// Init items module
initItems(scene);

// Callback zastosowania pokoju – używany wszędzie
function applyRoom(newConfig) {
  Object.assign(roomConfig, newConfig);
  buildRoom(scene, roomConfig);
  updateRoomConfig(roomConfig);
  updateOrthoCamera(orthoCamera, roomConfig, canvas.clientWidth, canvas.clientHeight);
}

// Callback zmiany widoku
function onViewToggle(mode) {
  if (mode === '3D') {
    activeCamera = perspCamera;
    controls.enabled = true;
  } else {
    activeCamera = orthoCamera;
    controls.enabled = false;
  }
}

// Init interaction i UI najpierw
initInteraction(canvas, orthoCamera, scene, roomConfig);
initUI(applyRoom, onViewToggle);

// Wczytaj projekt z localStorage – MUSI być po initUI (używa renderItemsList)
const restored = loadFromLocalStorage(applyRoom);
if (restored) {
  // renderItemsList po przywróceniu elementów
  renderItemsList();
} else {
  buildRoom(scene, roomConfig);
  updateOrthoCamera(orthoCamera, roomConfig,
    canvas.clientWidth || canvas.offsetWidth || 800,
    canvas.clientHeight || canvas.offsetHeight || 600);
}

// Autosave co 10 sekund i przed zamknięciem
setInterval(() => autosave(roomConfig), 10_000);
window.addEventListener('beforeunload', () => autosave(roomConfig));

// Animation loop
function animate() {
  requestAnimationFrame(animate);

  const w = canvas.clientWidth;
  const h = canvas.clientHeight;

  if (canvas.width !== w || canvas.height !== h) {
    renderer.setSize(w, h, false);
  }

  updateOrthoCamera(orthoCamera, roomConfig, w, h);
  updatePerspCamera(perspCamera, w, h);

  if (controls.enabled) controls.update();

  renderer.render(scene, activeCamera);
}

animate();

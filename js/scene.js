import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

let renderer, scene, orthoCamera;

export function initScene(canvas) {
  // Renderer – ustaw rozmiar od razu, aby uniknąć domyślnego 300×150
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setClearColor(0x0d0d20);

  const w = canvas.clientWidth || canvas.offsetWidth || 800;
  const h = canvas.clientHeight || canvas.offsetHeight || 600;
  renderer.setSize(w, h, false);

  // Scene
  scene = new THREE.Scene();

  // Orthographic camera (top-down, 2D view)
  orthoCamera = new THREE.OrthographicCamera(-5, 5, 5, -5, 0.1, 200);
  orthoCamera.up.set(0, 0, -1);
  orthoCamera.position.set(0, 50, 0);
  orthoCamera.lookAt(0, 0, 0);

  // Perspective camera (3D view)
  const perspCamera = new THREE.PerspectiveCamera(50, w / h, 0.1, 1000);
  perspCamera.position.set(0, 4, 6); // Domyślnie na skos
  perspCamera.lookAt(0, 0, 0);

  // OrbitControls (tylko dla 3D)
  const controls = new OrbitControls(perspCamera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.maxDistance = 20;   // Zoom out limit
  controls.maxPolarAngle = Math.PI / 2 - 0.05; // Blokada przed zejściem pod podłogę
  controls.enabled = false;    // Na start wyłączone (zaczynamy od 2D)

  // Simple ambient light (needed for MeshPhongMaterial colours to show)
  scene.add(new THREE.AmbientLight(0xffffff, 1.0));
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.5);
  dirLight.position.set(5, 10, 5);
  scene.add(dirLight);

  return { renderer, scene, orthoCamera, perspCamera, controls };
}

export function updateOrthoCamera(orthoCamera, roomConfig, w, h) {
  const { width, depth } = roomConfig;
  const padding = 0.6;

  const roomAspect = width / depth;
  const viewAspect = w / h;

  let viewW, viewH;
  if (viewAspect > roomAspect) {
    viewH = depth + padding * 2;
    viewW = viewH * viewAspect;
  } else {
    viewW = width + padding * 2;
    viewH = viewW / viewAspect;
  }

  orthoCamera.left = -viewW / 2;
  orthoCamera.right = viewW / 2;
  orthoCamera.top = viewH / 2;
  orthoCamera.bottom = -viewH / 2;
  orthoCamera.updateProjectionMatrix();
}

export function updatePerspCamera(perspCamera, w, h) {
  perspCamera.aspect = w / h;
  perspCamera.updateProjectionMatrix();
}

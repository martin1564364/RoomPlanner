import * as THREE from 'three';

export let items = [];
let nextId = 1;
let scene = null;

export function initItems(sceneRef) {
  scene = sceneRef;
}

export function addItem(config) {
  const id = nextId++;
  const item = {
    id,
    name: config.name,
    width: config.width,
    depth: config.depth,
    height: config.height,
    floorHeight: config.floorHeight ?? 0,
    color: config.color,
    opacity: config.opacity ?? 0,
    x: config.x ?? 0,
    z: config.z ?? 0,
    rotation: config.rotation ?? 0,   // obrót wokół osi Y (radiany)
    isBlocked: config.isBlocked ?? false,
    mesh: null,
    sprite: null
  };

  createMesh(item);
  items.push(item);
  return item;
}

export function removeItem(id) {
  const idx = items.findIndex(i => i.id === id);
  if (idx === -1) return;
  const item = items[idx];
  disposeMesh(item);
  items.splice(idx, 1);
}

export function updateItemPosition(id, x, z) {
  const item = items.find(i => i.id === id);
  if (!item) return;
  item.x = x;
  item.z = z;
  const yCenter = item.floorHeight + item.height / 2;
  if (item.mesh) {
    item.mesh.position.set(x, yCenter, z);
    if (item.sprite) {
      item.sprite.position.set(x, item.floorHeight + item.height + 0.25, z);
    }
  }
}

export function updateItemRotation(id, rotation) {
  const item = items.find(i => i.id === id);
  if (!item) return;
  item.rotation = rotation;
  if (item.mesh) {
    item.mesh.rotation.y = rotation;
  }
}

function createMesh(item) {
  const geo = new THREE.BoxGeometry(item.width, item.height, item.depth);

  const color = item.isBlocked ? 0xb0b0b0 : item.color;
  const opacity = 1 - (item.opacity / 100);
  const transparent = item.opacity > 0 || item.isBlocked;

  const mat = new THREE.MeshPhongMaterial({
    color,
    opacity,
    transparent,
    shininess: 30
  });

  const mesh = new THREE.Mesh(geo, mat);
  const yCenter = item.floorHeight + item.height / 2;
  mesh.position.set(item.x, yCenter, item.z);
  mesh.rotation.y = item.rotation ?? 0;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.itemId = item.id;

  // Edge outline
  const edgeGeo = new THREE.EdgesGeometry(geo);
  const edgeMat = new THREE.LineBasicMaterial({
    color: item.isBlocked ? 0x888888 : darkenHex(color, 0.6),
    opacity: item.isBlocked ? 0.4 : 0.8,
    transparent: true
  });
  const edges = new THREE.LineSegments(edgeGeo, edgeMat);
  mesh.add(edges);

  // Label sprite
  const sprite = createLabel(item.name, color, item.isBlocked);

  // Etykieta musi się mieścić w obrębie mebla (max szerokość to 90% mniejszego wymiaru rzutu poziomego, maks 0.9m)
  const maxLabelWidth = Math.min(item.width, item.depth) * 0.9;
  const labelWidth = Math.min(0.9, maxLabelWidth);
  const labelHeight = labelWidth / 4; // proporcje canvasu 256:64 = 4:1

  sprite.scale.set(labelWidth, labelHeight, 1);
  sprite.position.set(item.x, item.floorHeight + item.height + 0.25, item.z);
  sprite.userData.itemId = item.id;

  scene.add(mesh);
  scene.add(sprite);

  item.mesh = mesh;
  item.sprite = sprite;
}

function disposeMesh(item) {
  if (item.mesh) {
    scene.remove(item.mesh);
    item.mesh.traverse(child => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
    });
    item.mesh = null;
  }
  if (item.sprite) {
    scene.remove(item.sprite);
    if (item.sprite.material.map) item.sprite.material.map.dispose();
    item.sprite.material.dispose();
    item.sprite = null;
  }
}

// Safari <15.4 polyfill for ctx.roundRect
function roundRectPath(ctx, x, y, w, h, r) {
  if (ctx.roundRect) {
    ctx.roundRect(x, y, w, h, r);
  } else {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }
}

function createLabel(text, color, isBlocked) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');

  // Background
  const bgColor = isBlocked ? 'rgba(120,120,120,0.8)' : hexToRgba(color, 0.85);
  ctx.fillStyle = bgColor;
  roundRectPath(ctx, 4, 4, 248, 56, 8);
  ctx.fill();

  // Border
  ctx.strokeStyle = isBlocked ? 'rgba(200,200,200,0.6)' : 'rgba(255,255,255,0.4)';
  ctx.lineWidth = 2;
  roundRectPath(ctx, 4, 4, 248, 56, 8);
  ctx.stroke();

  // Text
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 22px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 3;
  ctx.fillText(text.length > 14 ? text.slice(0, 13) + '…' : text, 128, 34);

  const texture = new THREE.CanvasTexture(canvas);
  const mat = new THREE.SpriteMaterial({ map: texture, depthTest: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(0.9, 0.225, 1);
  return sprite;
}

export function createGhostMesh(config) {
  const geo = new THREE.BoxGeometry(config.width, config.height, config.depth);
  const mat = new THREE.MeshPhongMaterial({
    color: config.isBlocked ? 0xaaaaaa : config.color,
    opacity: 0.45,
    transparent: true
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(0, config.height / 2, 0);

  const edgeGeo = new THREE.EdgesGeometry(geo);
  const edgeMat = new THREE.LineBasicMaterial({ color: 0xffffff, opacity: 0.7, transparent: true });
  mesh.add(new THREE.LineSegments(edgeGeo, edgeMat));

  mesh.userData.isGhost = true;
  return mesh;
}

// ---- helpers ----

function darkenHex(hexOrNum, factor) {
  let r, g, b;
  if (typeof hexOrNum === 'number') {
    r = (hexOrNum >> 16) & 0xff;
    g = (hexOrNum >> 8) & 0xff;
    b = hexOrNum & 0xff;
  } else {
    const c = new THREE.Color(hexOrNum);
    r = Math.round(c.r * 255);
    g = Math.round(c.g * 255);
    b = Math.round(c.b * 255);
  }
  return (Math.round(r * factor) << 16) |
    (Math.round(g * factor) << 8) |
    Math.round(b * factor);
}

function hexToRgba(hex, alpha) {
  if (typeof hex === 'number') {
    const r = (hex >> 16) & 0xff;
    const g = (hex >> 8) & 0xff;
    const b = hex & 0xff;
    return `rgba(${r},${g},${b},${alpha})`;
  }
  const c = new THREE.Color(hex);
  return `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${alpha})`;
}

export function hexStringToNumber(hex) {
  return parseInt(hex.replace('#', ''), 16);
}
export function updateItemSettings(id, config) {
  const item = items.find(i => i.id === id);
  if (!item) return;

  // Aktualizacja właściwości
  item.name = config.name;
  item.width = config.width;
  item.depth = config.depth;
  item.height = config.height;
  item.floorHeight = config.floorHeight ?? 0;
  item.color = config.color;
  item.opacity = config.opacity ?? 0;
  item.isBlocked = config.isBlocked ?? false;

  // Usunięcie starych meshów ze sceny
  const scene = item.mesh ? item.mesh.parent : null;
  if (item.mesh) {
    if (scene) scene.remove(item.mesh);
    item.mesh.geometry.dispose();
    if (Array.isArray(item.mesh.material)) {
      item.mesh.material.forEach(m => m.dispose());
    } else {
      item.mesh.material.dispose();
    }
    item.mesh = null;
  }
  if (item.sprite) {
    if (scene) scene.remove(item.sprite);
    item.sprite.material.map.dispose();
    item.sprite.material.dispose();
    item.sprite = null;
  }

  // Odtworzenie nowych z uwzględnieniem dotychczasowej pozycji (id, x, z, rotation) zachowane w `item`
  createMesh(item);

  if (scene) {
    if (item.mesh) scene.add(item.mesh);
    if (item.sprite) scene.add(item.sprite);
  }
}

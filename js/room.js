import * as THREE from 'three';

const MARGIN = 1.0;          // 1 m margines wokół pokoju
let roomGroup = null;

export function buildRoom(scene, roomConfig) {
  if (roomGroup) {
    scene.remove(roomGroup);
    roomGroup.traverse(child => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
        else child.material.dispose();
      }
    });
  }

  const { width, depth, height } = roomConfig;
  roomGroup = new THREE.Group();

  // --- Strefa marginesu (1m wokół pokoju) ---
  addMargin(roomGroup, width, depth);

  // --- Podłoga pokoju ---
  const floorGeo = new THREE.PlaneGeometry(width, depth);
  const floorMat = new THREE.MeshPhongMaterial({
    color: 0xc8a87a,
    shininess: 10,
    side: THREE.FrontSide
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  roomGroup.add(floor);

  // --- Siatka metrowa (grubsza) ---
  addGrid(roomGroup, width, depth);

  // --- Siatka 10cm (cienka) ---
  addFineGrid(roomGroup, width, depth);

  // --- Obrys pokoju ---
  addPerimeter(roomGroup, width, depth, height);

  // --- Ściany (półprzezroczyste, dla efektu 3D) ---
  addWalls(roomGroup, width, depth, height);

  scene.add(roomGroup);
  return roomGroup;
}

function addMargin(group, width, depth) {
  const mw = width + MARGIN * 2;
  const md = depth + MARGIN * 2;
  const geo = new THREE.PlaneGeometry(mw, md);
  const mat = new THREE.MeshPhongMaterial({
    color: 0x4a4a6a,   // ciemnoniebieskawy akcent
    shininess: 0,
    side: THREE.FrontSide
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = -0.002;     // tuż poniżej podłogi
  group.add(mesh);

  // Cienkie linie obrysu marginesu
  const hw = mw / 2, hd = md / 2;
  const pts = [
    new THREE.Vector3(-hw, 0.001, -hd),
    new THREE.Vector3(hw, 0.001, -hd),
    new THREE.Vector3(hw, 0.001, hd),
    new THREE.Vector3(-hw, 0.001, hd),
  ];
  const mGeo = new THREE.BufferGeometry().setFromPoints(pts);
  const mMat = new THREE.LineBasicMaterial({ color: 0x334455, opacity: 0.5, transparent: true });
  group.add(new THREE.LineLoop(mGeo, mMat));
}

function addGrid(group, width, depth) {
  const points = [];
  const x0 = -width / 2, x1 = width / 2;
  const z0 = -depth / 2, z1 = depth / 2;
  const y = 0.003;

  // Linie zakotwiczone w lewym-dolnym rogu co 1m
  for (let n = 1; x0 + n < x1; n++) {
    const x = x0 + n;
    points.push(x, y, z0, x, y, z1);
  }
  for (let n = 1; z1 - n > z0; n++) {
    const z = z1 - n;
    points.push(x0, y, z, x1, y, z);
  }

  if (points.length === 0) return;

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  const mat = new THREE.LineBasicMaterial({ color: 0xaa9966, opacity: 0.6, transparent: true });
  group.add(new THREE.LineSegments(geo, mat));
}

function addFineGrid(group, width, depth) {
  const STEP = 0.1;   // 10 cm
  const points = [];
  const x0 = -width / 2, x1 = width / 2;
  const z0 = -depth / 2, z1 = depth / 2;
  const y = 0.002;

  // Pionowe linie co 10cm (z pominięciem wielokrotności 1m – te rysuje addGrid)
  for (let n = 1; x0 + n * STEP < x1; n++) {
    if (n % 10 === 0) continue;   // pomiń grube linie 1m
    const x = +(x0 + n * STEP).toFixed(4);
    points.push(x, y, z0, x, y, z1);
  }
  // Poziome linie co 10cm
  for (let n = 1; z1 - n * STEP > z0; n++) {
    if (n % 10 === 0) continue;
    const z = +(z1 - n * STEP).toFixed(4);
    points.push(x0, y, z, x1, y, z);
  }

  if (points.length === 0) return;

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  const mat = new THREE.LineBasicMaterial({ color: 0x887755, opacity: 0.22, transparent: true });
  group.add(new THREE.LineSegments(geo, mat));
}

function addPerimeter(group, width, depth, height) {
  const hw = width / 2, hd = depth / 2;

  const floorPts = [
    new THREE.Vector3(-hw, 0.006, -hd),
    new THREE.Vector3(hw, 0.006, -hd),
    new THREE.Vector3(hw, 0.006, hd),
    new THREE.Vector3(-hw, 0.006, hd),
  ];
  const floorGeo = new THREE.BufferGeometry().setFromPoints(floorPts);
  group.add(new THREE.LineLoop(floorGeo,
    new THREE.LineBasicMaterial({ color: 0x66aaee })));

  const corners = [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]];
  const edgeMat = new THREE.LineBasicMaterial({ color: 0x6699bb, opacity: 0.7, transparent: true });
  for (const [cx, cz] of corners) {
    const cGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(cx, 0, cz),
      new THREE.Vector3(cx, height, cz),
    ]);
    group.add(new THREE.Line(cGeo, edgeMat.clone()));
  }

  const topPts = [
    new THREE.Vector3(-hw, height, -hd),
    new THREE.Vector3(hw, height, -hd),
    new THREE.Vector3(hw, height, hd),
    new THREE.Vector3(-hw, height, hd),
  ];
  group.add(new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints(topPts),
    new THREE.LineBasicMaterial({ color: 0x445566, opacity: 0.4, transparent: true })
  ));
}

function addWalls(group, width, depth, height) {
  const wallMat = new THREE.MeshPhongMaterial({
    color: 0xd4c9b0, opacity: 0.18, transparent: true,
    side: THREE.FrontSide, depthWrite: false
  });
  const edgeMat = new THREE.LineBasicMaterial({ color: 0x8899aa, opacity: 0.6, transparent: true });

  addWallPlane(group, width, height,
    new THREE.Vector3(0, height / 2, -depth / 2),
    new THREE.Euler(0, 0, 0), wallMat, edgeMat);
  addWallPlane(group, depth, height,
    new THREE.Vector3(-width / 2, height / 2, 0),
    new THREE.Euler(0, Math.PI / 2, 0), wallMat, edgeMat);
  addWallPlane(group, depth, height,
    new THREE.Vector3(width / 2, height / 2, 0),
    new THREE.Euler(0, -Math.PI / 2, 0), wallMat, edgeMat);
}

function addWallPlane(group, w, h, position, rotation, wallMat, edgeMat) {
  const geo = new THREE.PlaneGeometry(w, h);
  const mesh = new THREE.Mesh(geo, wallMat.clone());
  mesh.position.copy(position);
  mesh.rotation.copy(rotation);
  group.add(mesh);

  const edgeGeo = new THREE.EdgesGeometry(geo);
  const edges = new THREE.LineSegments(edgeGeo, edgeMat.clone());
  edges.position.copy(position);
  edges.rotation.copy(rotation);
  group.add(edges);
}

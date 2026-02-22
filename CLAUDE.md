# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the App

No build step required. Open `index.html` in Chrome:

```bash
# Option A — directly in Chrome (works fine)
open -a "Google Chrome" index.html

# Option B — local server (avoids any file:// edge cases)
python3 -m http.server 8080
# then open http://localhost:8080
```

Safari blocks ES module imports from CDN when served over `file://` — use Chrome or a local server.

## Architecture

Single-page app using **native ES modules** and **Three.js 0.160** loaded via `importmap` in `index.html`. No bundler, no npm, no build pipeline.

### Module responsibilities

| File | Responsibility |
|---|---|
| `js/main.js` | Entry point — wires all modules, owns `roomConfig`, drives the animation loop |
| `js/scene.js` | Creates renderer, `orthoCamera`, `perspCamera`, OrbitControls, and lights |
| `js/room.js` | Builds/rebuilds the room `Group` (margin, floor, grids, perimeter outline, walls) |
| `js/items.js` | Owns the `items[]` array; creates/disposes Three.js meshes and label Sprites |
| `js/interaction.js` | Mouse/keyboard handling — placement mode, drag, rotation, raycasting against floor plane |
| `js/ui.js` | Sidebar DOM event handlers; calls `startPlacement()` and renders the items list |
| `js/project.js` | Serialization, localStorage autosave, clipboard export/import |

### Rendering

Two cameras share a single `WebGLRenderer`. Default is **2D mode** (orthographic, top-down):
- `orthoCamera` at Y=50, `up.set(0,0,-1)` so the back wall appears at the top of the screen. `updateOrthoCamera()` recalculates the frustum every frame to fit the room with 0.6m padding while maintaining aspect ratio.
- **3D mode** uses `perspCamera` (50° FOV) with `OrbitControls` (damping, maxPolarAngle just above floor). The toggle dims the sidebar to indicate interactions are disabled.

Canvas sizing: CSS `position:absolute; inset:0; width:100%; height:100%`. The renderer is resized inside the animation loop via `canvas.clientWidth/clientHeight`.

### State

`roomConfig = { width, depth, height }` lives in `main.js`. When "Zastosuj" is clicked, it is mutated in place, `buildRoom()` rebuilds the scene geometry, and `updateRoomConfig()` syncs the reference in `interaction.js`.

`items[]` lives in `items.js`. Each item holds both data and live Three.js refs:

```js
{ id, name, width, depth, height, floorHeight, color, opacity,
  x, z, rotation, isBlocked, mesh, sprite }
```

Removal calls `disposeMesh()` to free GPU resources. On `updateItemSettings()` the mesh is fully recreated.

### Initialization order

This order **must** be respected in `main.js`:

1. `initScene()` — renderer + cameras + lights
2. `initItems()` — register scene ref
3. `initInteraction()` — register canvas, camera, scene, roomConfig
4. `initUI()` — attach sidebar callbacks (**must** come before `loadFromLocalStorage`)
5. `loadFromLocalStorage()` — restore saved project (calls `renderItemsList` from ui.js)
6. If no restore: `buildRoom()` + initial `renderItemsList()`
7. `animate()` — start RAF loop

### Interaction flow

**Placement:**
1. "Dodaj mebel" / "Dodaj strefę" → `readItemForm()` in `ui.js` → `startPlacement(config)` in `interaction.js`
2. Ghost `BoxGeometry` mesh follows the cursor; raycasting hits the `y=0` floor plane
3. Left-click places the item (`addItem()` in `items.js`), ghost is removed
4. ESC cancels at any time

**Drag:** Click an existing item → drag with mouse offset → `mouseup` saves via `autosave()`

**Rotation:** `R` / `Shift+R` or right-click rotates in 90° snaps. `effectiveDims()` swaps width/depth for odd-multiple rotations so `clampToRoom()` remains correct after rotation.

### Item types

`isBlocked: true` → blocked zone (door/obstacle): forced grey `0xb0b0b0`, 50% opacity default.
`isBlocked: false` → furniture: user-chosen color and opacity.

Both share `createMesh()` in `items.js`; `createGhostMesh()` produces the placement preview (lower opacity, `userData.isGhost = true`).

### Opacity convention

The UI exposes **% transparency** (0 = fully opaque). Internally: `material.opacity = 1 - pct/100`. Keep this inversion in mind when reading or writing opacity values.

### Persistence

`project.js` autosaves to `localStorage` every 10 seconds and on `beforeunload`. Export/import uses `navigator.clipboard` with a `prompt()` fallback. The serialized format is:

```json
{ "version": 1, "room": { "width", "depth", "height" }, "items": [...] }
```

Only data fields are serialized (not `mesh`/`sprite` refs). On restore, items are re-added via `addItem()`.

### Circular dependency

`interaction.js` imports `renderItemsList` from `ui.js`; `ui.js` imports `startPlacement` from `interaction.js`. This cycle is safe because both exports are functions only called at runtime (never during module initialisation).

### Adding a new item property

1. Add the field to the object literal in `items.js → addItem()`
2. Use it in `createMesh()` to affect material/geometry
3. Read it from the form in `ui.js → readItemForm()`
4. Include it in the serialization map in `project.js → serializeProject()`

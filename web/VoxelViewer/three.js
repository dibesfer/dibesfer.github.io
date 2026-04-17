import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';




// =========================
// CLASSES
// =========================

class Microxel {
    constructor(color = "#ffffff") {
        this.color = color;
        this.active = true;
    }

    destroy() {
        this.active = false;
    }
}

const voxelPresets = {
    empty_preset(size) {
        return {
            size,
            microxels: Array.from({ length: size }, () =>
                Array.from({ length: size }, () =>
                    Array.from({ length: size }, () => ({
                        color: "#ffffff",
                        active: false
                    }))
                )
            )
        };
    },

    full_preset(size) {
        return {
            size,
            microxels: Array.from({ length: size }, () =>
                Array.from({ length: size }, () =>
                    Array.from({ length: size }, () => ({
                        color: "#ffffff",
                        active: true
                    }))
                )
            )
        };
    },

    random_preset(size) {
        return {
            size,
            microxels: Array.from({ length: size }, () =>
                Array.from({ length: size }, () =>
                    Array.from({ length: size }, () => ({
                        color: "#ffffff",
                        active: Math.random() >= 0.5
                    }))
                )
            )
        };
    }
};

/*
okay, so we are generating a Voxel object during this process right?

next step will be formatting into JSON 
*/
class Voxel {
    constructor(size = 7) {
        this.size = size;
        this.name = "";
        this.microxels = Array.from({ length: size }, () =>
            Array.from({ length: size }, () =>
                Array.from({ length: size }, () => new Microxel())
            )
        );

        this.applyPreset("full");
    }

    get(x, y, z) {
        return this.microxels[x]?.[y]?.[z];
    }

    setName(name = "") {
        this.name = String(name).trim();
    }

    toJSON() {
        return {
            name: this.name,
            size: this.size,
            microxels: this.microxels.map((plane) =>
                plane.map((row) =>
                    row.map((cell) => ({
                        color: cell.color,
                        active: cell.active
                    }))
                )
            )
        };
    }

    loadFromData(data) {
        if (!data || data.size !== this.size || !Array.isArray(data.microxels)) {
            throw new Error("Loaded voxel size does not match the current editor.");
        }

        // Only explicit names should replace the current voxel name.
        if ("name" in data) {
            this.setName(data.name ?? "");
        }

        for (let x = 0; x < this.size; x++) {
            for (let y = 0; y < this.size; y++) {
                for (let z = 0; z < this.size; z++) {
                    const nextCell = data.microxels?.[x]?.[y]?.[z];

                    if (!nextCell) {
                        throw new Error(`Missing microxel at ${x},${y},${z}.`);
                    }

                    const cell = this.get(x, y, z);
                    cell.color = typeof nextCell.color === "string" ? nextCell.color : cell.color;
                    cell.active = Boolean(nextCell.active);
                }
            }
        }
    }

    applyPreset(presetName) {
        const presetBuilder = voxelPresets[`${presetName}_preset`];

        if (!presetBuilder) {
            throw new Error(`Unknown preset "${presetName}".`);
        }

        this.loadFromData(presetBuilder(this.size));
    }
}

// =========================
// WORLD
// =========================

const SIZE = 15;
const voxel = new Voxel(SIZE);
const fpsCounter = document.getElementById("fpsCounter");
const uiVoxelName = document.getElementById("UIVoxelName");
window.getVoxelSaveData = () => voxel.toJSON();
window.ensureVoxelName = (fallbackName = "Table") => {
    const nextName = voxel.name || String(fallbackName).trim() || "Table";

    voxel.setName(nextName);
    syncVoxelNameInput();

    return voxel.toJSON();
};

function syncVoxelNameInput() {
    uiVoxelName.value = voxel.name;
}

uiVoxelName.addEventListener("input", (e) => {
    voxel.setName(e.target.value);
});

syncVoxelNameInput();

console.log("🔥 INITIAL VOXEL:", voxel);

// =========================
// THREE SETUP
// =========================

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111111);

const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 1000);
camera.position.set(20, 20, 20);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);

// =========================
// LIGHTS (FIXED SYNTAX)
// =========================

const dirLight = new THREE.DirectionalLight(0xffffff, 1.4);
dirLight.position.set(15, 25, 10);
scene.add(dirLight);

scene.add(new THREE.AmbientLight(0xffffff, 0.25));
scene.add(new THREE.HemisphereLight(0xaaaaaa, 0x444444, 0.7));

// =========================
// GRID (AT GROUND LEVEL)
// =========================

scene.add(new THREE.GridHelper(SIZE, SIZE, 0xffffff, 0xffffff));

// =========================
// INSTANCED MICROXELS
// =========================

const geometry = new THREE.BoxGeometry(1, 1, 1);

const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.6,
    metalness: 0.05,
    emissive: new THREE.Color(0x0a0a0a)
});

const instanced = new THREE.InstancedMesh(
    geometry,
    material,
    SIZE * SIZE * SIZE
);

const matrix = new THREE.Matrix4();
const quaternion = new THREE.Quaternion();
const activeScale = new THREE.Vector3(1, 1, 1);
const hiddenScale = new THREE.Vector3(0, 0, 0);
const tempPosition = new THREE.Vector3();
const tempColor = new THREE.Color();
const modelCenterOffset = (SIZE - 1) / 2;
const groundOffset = 0.5;
const idToCoord = [];

let i = 0;

for (let x = 0; x < SIZE; x++) {
    for (let y = 0; y < SIZE; y++) {
        for (let z = 0; z < SIZE; z++) {

            matrix.setPosition(
                x - modelCenterOffset,
                y + groundOffset,
                z - modelCenterOffset
            );

            instanced.setMatrixAt(i, matrix);
            idToCoord[i] = { x, y, z };
            instanced.setColorAt(i, tempColor.set(voxel.get(x, y, z).color));

            i++;
        }
    }
}

instanced.instanceMatrix.needsUpdate = true;
instanced.instanceColor.needsUpdate = true;
scene.add(instanced);

function getMicroxelPosition(x, y, z) {
    return tempPosition.set(
        x - modelCenterOffset,
        y + groundOffset,
        z - modelCenterOffset
    );
}

function syncMicroxelVisual(instanceId) {
    const { x, y, z } = idToCoord[instanceId];
    const cell = voxel.get(x, y, z);

    if (!cell) return;

    const position = getMicroxelPosition(x, y, z);

    // Render state always comes from the microxel model.
    matrix.compose(
        position,
        quaternion,
        cell.active ? activeScale : hiddenScale
    );

    instanced.setMatrixAt(instanceId, matrix);
    instanced.setColorAt(instanceId, tempColor.set(cell.color));
    instanced.instanceMatrix.needsUpdate = true;
    instanced.instanceColor.needsUpdate = true;
}

function syncAllMicroxels() {
    for (let instanceId = 0; instanceId < idToCoord.length; instanceId++) {
        syncMicroxelVisual(instanceId);
    }
}

window.applyVoxelSaveData = (jsonText) => {
    try {
        const data = JSON.parse(jsonText);
        voxel.loadFromData(data);
        syncVoxelNameInput();
        syncAllMicroxels();

        return { ok: true, message: "Voxel loaded." };
    } catch (error) {
        return {
            ok: false,
            message: error instanceof Error ? error.message : "Invalid voxel JSON."
        };
    }
};

window.applyVoxelPreset = (presetName) => {
    if (!presetName) {
        return { ok: false, message: "Select a template first." };
    }

    try {
        voxel.applyPreset(presetName);
        syncAllMicroxels();

        return { ok: true, message: `Preset "${presetName}" loaded.` };
    } catch (error) {
        return {
            ok: false,
            message: error instanceof Error ? error.message : "Preset could not be loaded."
        };
    }
};

// =========================
// HIGHLIGHT
// =========================

const highlight = new THREE.Mesh(
    new THREE.BoxGeometry(1.02, 1.02, 1.02),
    new THREE.MeshBasicMaterial({
        color: 0xff0000,
        transparent: true,
        opacity: 0.5
    })
);

scene.add(highlight);

// =========================
// RAYCAST (FIX: HOVER LIVES)
// =========================

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const dragThreshold = 6;
const pointerState = {
    active: false,
    pointerId: null,
    startX: 0,
    startY: 0,
    dragged: false,
    hitInstanceId: null
};

function updatePointer(e) {
    const bounds = renderer.domElement.getBoundingClientRect();
    const localX = e.clientX - bounds.left;
    const localY = e.clientY - bounds.top;

    pointer.x = (localX / bounds.width) * 2 - 1;
    pointer.y = -(localY / bounds.height) * 2 + 1;
}

renderer.domElement.addEventListener('pointermove', updatePointer);

function getHit() {
    if (pointerState.active && pointerState.dragged) {
        return null;
    }

    raycaster.setFromCamera(pointer, camera);
    return raycaster.intersectObject(instanced)[0] || null;
}

// =========================
// POINTER INTENT → MODIFY MICROXEL
// =========================

function resetPointerState() {
    pointerState.active = false;
    pointerState.pointerId = null;
    pointerState.startX = 0;
    pointerState.startY = 0;
    pointerState.dragged = false;
    pointerState.hitInstanceId = null;
}

function destroyMicroxel(instanceId) {
    const { x, y, z } = idToCoord[instanceId];
    const cell = voxel.get(x, y, z);

    if (!cell) return;

    cell.destroy();
    syncMicroxelVisual(instanceId);
    console.log(`💥 destroyed microxel at ${x},${y},${z}`);
    console.log("🧱 VOXEL STATE:", voxel);
}

renderer.domElement.addEventListener('pointerdown', (e) => {
    updatePointer(e);

    // Only a clean primary press can become an erase action.
    if (e.button !== 0) {
        resetPointerState();
        return;
    }

    const hit = getHit();

    pointerState.active = true;
    pointerState.pointerId = e.pointerId;
    pointerState.startX = e.clientX;
    pointerState.startY = e.clientY;
    pointerState.dragged = false;
    pointerState.hitInstanceId = hit?.instanceId ?? null;
});

renderer.domElement.addEventListener('pointermove', (e) => {
    if (!pointerState.active || pointerState.pointerId !== e.pointerId) return;

    const movedX = e.clientX - pointerState.startX;
    const movedY = e.clientY - pointerState.startY;

    if (Math.hypot(movedX, movedY) >= dragThreshold) {
        pointerState.dragged = true;
        highlight.visible = false;
    }
});

window.addEventListener('pointerup', (e) => {
    updatePointer(e);

    if (!pointerState.active || pointerState.pointerId !== e.pointerId) return;

    const instanceId = pointerState.hitInstanceId;
    const shouldDestroy = !pointerState.dragged && instanceId !== null;

    resetPointerState();

    if (shouldDestroy) {
        destroyMicroxel(instanceId);
    }
});

window.addEventListener('pointercancel', resetPointerState);
renderer.domElement.addEventListener('pointerleave', () => {
    highlight.visible = false;
});

// =========================
// HIGHLIGHT UPDATE
// =========================

function updateHighlight() {
    if (pointerState.active && pointerState.dragged) {
        highlight.visible = false;
        return;
    }

    const hit = getHit();

    if (!hit) {
        highlight.visible = false;
        return;
    }

    const { x, y, z } = idToCoord[hit.instanceId];

    highlight.position.set(
        x - modelCenterOffset,
        y + groundOffset,
        z - modelCenterOffset
    );

    highlight.visible = true;
}

// =========================
// LOOP
// =========================

let lastFpsTime = performance.now();
let frameCount = 0;

function updateFps(now) {
    frameCount += 1;

    const elapsed = now - lastFpsTime;

    // Sample over a short window so the counter stays readable.
    if (elapsed < 250) return;

    const fps = Math.round((frameCount * 1000) / elapsed);
    fpsCounter.textContent = `FPS: ${fps}`;
    frameCount = 0;
    lastFpsTime = now;
}

let animationId
function animate(now = performance.now()) {
    animationId = requestAnimationFrame(animate);
    updateFps(now);
    updateHighlight();
    controls.update();
    renderer.render(scene, camera);
}
animate();

function onResize(){
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
}

addEventListener('resize', onResize);


/*
// Restoring webglcontext when mobile tab is minimized 
  document.addEventListener("visibilitychange", onVisibility)
  renderer.domElement.addEventListener("webglcontextlost", onContextLost, false)
  renderer.domElement.addEventListener("webglcontextrestored", onContextRestored, false)

  // 🔴 when tab hidden (mobile minimize)
function onVisibility() {
  if (document.hidden) {
    cancelAnimationFrame(animationId)
  } else {
    // resume clean
    onResize()
    animate()
  }
}

// 🔴 context lost
function onContextLost(event) {
  event.preventDefault()
  console.log("WebGL context lost 💀")
  cancelAnimationFrame(animationId)
}

// 🟢 context restored
function onContextRestored() {
  console.log("WebGL context restored 🔥")

  // FULL re-init (important)
  document.body.removeChild(renderer.domElement)
  init()
  animate()
}

const gl = renderer.getContext()
const ext = gl.getExtension('WEBGL_lose_context')

ext.loseContext()

setTimeout(()=> {
    ext.restoreContext()
}, 1000)

*/
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Microxel } from '/games/Kolorlando/code/data/Microxel.js';
import { Voxel } from '/games/Kolorlando/code/data/Voxel.js';

const VOXEL_EDITOR_SIZE = 15;

const voxelEditorPresets = {
    empty: {
        type: 'microxeled',
        microxelSize: VOXEL_EDITOR_SIZE,
        microxels: createMicroxelDataGrid(VOXEL_EDITOR_SIZE, { active: false })
    },
    full: {
        type: 'microxeled',
        microxelSize: VOXEL_EDITOR_SIZE,
        microxels: createMicroxelDataGrid(VOXEL_EDITOR_SIZE, { active: true })
    },
    random: null
};

// The editor produces one shared Voxel and edits its Microxels directly.
const editedVoxel = new Voxel({
    name: 'Default Voxel',
    type: 'microxeled',
    microxelSize: VOXEL_EDITOR_SIZE
});
const fpsCounter = document.getElementById('fpsCounter');
const uiVoxelName = document.getElementById('UIVoxelName');
const editorColorInput = document.getElementById('editorColorInput');
const paintToolButton = document.getElementById('paintToolButton');
const placeToolButton = document.getElementById('placeToolButton');
const eraserToolButton = document.getElementById('eraserToolButton');
const lineModeButton = document.getElementById('lineModeButton');
const boxModeButton = document.getElementById('boxModeButton');
const mirrorXInput = document.getElementById('mirrorXInput');
const mirrorYInput = document.getElementById('mirrorYInput');
const mirrorZInput = document.getElementById('mirrorZInput');
const editorToolState = {
    mode: 'erase',
    shapeMode: 'single',
    color: editorColorInput?.value || '#ffffff',
    lineStart: null,
    mirror: {
        x: false,
        y: false,
        z: false
    }
};
editedVoxel.fromJSON(voxelEditorPresets.full);

window.getVoxelSaveData = () => editedVoxel.toJSON();
window.ensureVoxelName = (fallbackName = 'Table') => {
    const nextName = editedVoxel.name || String(fallbackName).trim() || 'Table';

    editedVoxel.setName(nextName);
    syncVoxelNameInput();

    return editedVoxel.toJSON();
};

function syncVoxelNameInput() {
    uiVoxelName.value = editedVoxel.name;
}

uiVoxelName.addEventListener('input', event => {
    editedVoxel.setName(event.target.value);
});

editorColorInput?.addEventListener('input', event => {
    editorToolState.color = String(event.target.value || '#ffffff');
});

paintToolButton?.addEventListener('click', () => {
    setEditorToolMode('paint');
});

placeToolButton?.addEventListener('click', () => {
    setEditorToolMode('place');
});

eraserToolButton?.addEventListener('click', () => {
    setEditorToolMode('erase');
});

lineModeButton?.addEventListener('click', () => {
    setEditorShapeMode(editorToolState.shapeMode === 'line' ? 'single' : 'line');
});

boxModeButton?.addEventListener('click', () => {
    setEditorShapeMode(editorToolState.shapeMode === 'box' ? 'single' : 'box');
});

mirrorXInput?.addEventListener('change', event => {
    editorToolState.mirror.x = Boolean(event.target.checked);
    syncMirrorGuides();
});

mirrorYInput?.addEventListener('change', event => {
    editorToolState.mirror.y = Boolean(event.target.checked);
    syncMirrorGuides();
});

mirrorZInput?.addEventListener('change', event => {
    editorToolState.mirror.z = Boolean(event.target.checked);
    syncMirrorGuides();
});

syncVoxelNameInput();
syncEditorToolButtons();

console.log('🔥 INITIAL VOXEL:', editedVoxel);

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
// LIGHTS
// =========================

const dirLight = new THREE.DirectionalLight(0xffffff, 1.4);
dirLight.position.set(15, 25, 10);
scene.add(dirLight);

scene.add(new THREE.AmbientLight(0xffffff, 0.25));
scene.add(new THREE.HemisphereLight(0xaaaaaa, 0x444444, 0.7));

// =========================
// GRID
// =========================

scene.add(new THREE.GridHelper(VOXEL_EDITOR_SIZE, VOXEL_EDITOR_SIZE, 0xffffff, 0xffffff));

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
    VOXEL_EDITOR_SIZE * VOXEL_EDITOR_SIZE * VOXEL_EDITOR_SIZE
);

const matrix = new THREE.Matrix4();
const quaternion = new THREE.Quaternion();
const activeScale = new THREE.Vector3(1, 1, 1);
const hiddenScale = new THREE.Vector3(0, 0, 0);
const tempPosition = new THREE.Vector3();
const tempColor = new THREE.Color();
const tempHitPoint = new THREE.Vector3();
const modelCenterOffset = (VOXEL_EDITOR_SIZE - 1) / 2;
const groundOffset = 0.5;
const idToCoord = [];

let instanceId = 0;

for (let x = 0; x < VOXEL_EDITOR_SIZE; x += 1) {
    for (let y = 0; y < VOXEL_EDITOR_SIZE; y += 1) {
        for (let z = 0; z < VOXEL_EDITOR_SIZE; z += 1) {
            matrix.setPosition(
                x - modelCenterOffset,
                y + groundOffset,
                z - modelCenterOffset
            );

            instanced.setMatrixAt(instanceId, matrix);
            idToCoord[instanceId] = { x, y, z };
            instanced.setColorAt(instanceId, tempColor.set(readEditorMicroxel(x, y, z)?.color || '#ffffff'));
            instanceId += 1;
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

function readEditorMicroxel(x, y, z) {
    return editedVoxel.get(x, y, z);
}

function syncMicroxelVisual(currentInstanceId) {
    const { x, y, z } = idToCoord[currentInstanceId];
    const microxel = readEditorMicroxel(x, y, z);

    if (!microxel) return;

    const position = getMicroxelPosition(x, y, z);

    // Render state always comes from the shared Microxel model.
    matrix.compose(
        position,
        quaternion,
        microxel.active ? activeScale : hiddenScale
    );

    instanced.setMatrixAt(currentInstanceId, matrix);
    instanced.setColorAt(currentInstanceId, tempColor.set(microxel.color));
    instanced.instanceMatrix.needsUpdate = true;
    instanced.instanceColor.needsUpdate = true;
}

function syncAllMicroxels() {
    for (let currentInstanceId = 0; currentInstanceId < idToCoord.length; currentInstanceId += 1) {
        syncMicroxelVisual(currentInstanceId);
    }
}

window.applyVoxelSaveData = jsonText => {
    try {
        const rawData = JSON.parse(jsonText);
        const normalizedVoxelData = normalizeEditorVoxelData(rawData);

        editedVoxel.fromJSON(normalizedVoxelData);
        syncVoxelNameInput();
        syncAllMicroxels();

        return { ok: true, message: 'Voxel loaded.' };
    } catch (error) {
        return {
            ok: false,
            message: error instanceof Error ? error.message : 'Invalid voxel JSON.'
        };
    }
};

window.applyVoxelPreset = presetName => {
    if (!presetName) {
        return { ok: false, message: 'Select a template first.' };
    }

    const presetData = resolveVoxelEditorPreset(presetName);

    if (!presetData) {
        return { ok: false, message: `Preset "${presetName}" could not be loaded.` };
    }

    try {
        editedVoxel.fromJSON({
            ...presetData,
            name: editedVoxel.name
        });
        syncAllMicroxels();

        return { ok: true, message: `Preset "${presetName}" loaded.` };
    } catch (error) {
        return {
            ok: false,
            message: error instanceof Error ? error.message : 'Preset could not be loaded.'
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
const placementSlotHighlight = new THREE.Mesh(
    new THREE.PlaneGeometry(1.02, 1.02),
    new THREE.MeshBasicMaterial({
        color: 0xff0000,
        transparent: true,
        opacity: 0.38,
        side: THREE.DoubleSide,
        depthWrite: false
    })
);
const lineStartHighlight = new THREE.Mesh(
    new THREE.BoxGeometry(1.08, 1.08, 1.08),
    new THREE.MeshBasicMaterial({
        color: 0xffdd55,
        transparent: true,
        opacity: 0.65
    })
);
const linePreviewGeometry = new THREE.BoxGeometry(1.04, 1.04, 1.04);
const linePreviewMaterial = new THREE.MeshBasicMaterial({
    color: 0xffdd55,
    transparent: true,
    opacity: 0.32
});
const linePreviewGroup = new THREE.Group();

placementSlotHighlight.rotation.x = -Math.PI * 0.5;
placementSlotHighlight.visible = false;
lineStartHighlight.visible = false;
linePreviewGroup.visible = false;

scene.add(highlight);
scene.add(placementSlotHighlight);
scene.add(lineStartHighlight);
scene.add(linePreviewGroup);
highlight.scale.set(1, 1, 1);

const mirrorGuideX = createMirrorGuide(0xff5555);
const mirrorGuideY = createMirrorGuide(0x55ff88);
const mirrorGuideZ = createMirrorGuide(0x55aaff);
scene.add(mirrorGuideX);
scene.add(mirrorGuideY);
scene.add(mirrorGuideZ);
syncMirrorGuides();

// =========================
// RAYCAST
// =========================

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const dragThreshold = 6;
const placementPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const placementGridPosition = new THREE.Vector3();
const pointerState = {
    active: false,
    pointerId: null,
    startX: 0,
    startY: 0,
    dragged: false,
    hitInstanceId: null
};

function updatePointer(event) {
    const bounds = renderer.domElement.getBoundingClientRect();
    const localX = event.clientX - bounds.left;
    const localY = event.clientY - bounds.top;

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

function getPlacementGridTarget() {
    if (editorToolState.mode !== 'place') {
        return null;
    }

    raycaster.setFromCamera(pointer, camera);

    if (!raycaster.ray.intersectPlane(placementPlane, tempHitPoint)) {
        return null;
    }

    placementGridPosition.set(
        Math.round(tempHitPoint.x + modelCenterOffset),
        0,
        Math.round(tempHitPoint.z + modelCenterOffset)
    );

    if (!isMicroxelPositionInsideEditor(
        placementGridPosition.x,
        placementGridPosition.y,
        placementGridPosition.z
    )) {
        return null;
    }

    return {
        x: placementGridPosition.x,
        y: placementGridPosition.y,
        z: placementGridPosition.z
    };
}

function getAdjacentPlacementTarget(hit) {
    if (!hit || hit.instanceId == null) {
        return null;
    }

    const sourceCoord = idToCoord[hit.instanceId];
    if (!sourceCoord) {
        return null;
    }

    const nextCoord = {
        x: sourceCoord.x + Math.round(hit.face?.normal?.x || 0),
        y: sourceCoord.y + Math.round(hit.face?.normal?.y || 0),
        z: sourceCoord.z + Math.round(hit.face?.normal?.z || 0)
    };

    if (!isMicroxelPositionInsideEditor(nextCoord.x, nextCoord.y, nextCoord.z)) {
        return null;
    }

    return nextCoord;
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

function destroyMicroxel(targetInstanceId) {
    const { x, y, z } = idToCoord[targetInstanceId];
    const targetCoords = collectMirroredCoordinates(x, y, z);

    applyToMicroxelCoordinates(targetCoords, microxel => {
        microxel.destroy();
    });
    console.log(`💥 destroyed microxel at ${x},${y},${z}`);
    console.log('🧱 VOXEL STATE:', editedVoxel);
}

function paintMicroxel(targetInstanceId) {
    if (targetInstanceId === null) {
        return;
    }

    const { x, y, z } = idToCoord[targetInstanceId];
    const targetCoords = collectMirroredCoordinates(x, y, z);

    applyToMicroxelCoordinates(targetCoords, microxel => {
        if (!microxel.active) return;
        microxel.setColor(editorToolState.color);
    });
    console.log(`🎨 painted microxel at ${x},${y},${z}`);
    console.log('🧱 VOXEL STATE:', editedVoxel);
}

function applyEditorToolAtCoord(coord, faceNormal = null) {
    if (!coord) {
        return false;
    }

    if (editorToolState.mode === 'place') {
        if (faceNormal) {
            const nextCell = {
                x: coord.x + Math.round(faceNormal.x || 0),
                y: coord.y + Math.round(faceNormal.y || 0),
                z: coord.z + Math.round(faceNormal.z || 0)
            };

            if (!isMicroxelPositionInsideEditor(nextCell.x, nextCell.y, nextCell.z)) {
                return false;
            }

            const nextCoords = collectMirroredCoordinates(nextCell.x, nextCell.y, nextCell.z);
            applyToMicroxelCoordinates(nextCoords, microxel => {
                microxel.revive();
                microxel.setColor(editorToolState.color);
            });
            return true;
        }

        const fallbackCoords = collectMirroredCoordinates(coord.x, coord.y, coord.z);
        applyToMicroxelCoordinates(fallbackCoords, microxel => {
            microxel.revive();
            microxel.setColor(editorToolState.color);
        });
        return true;
    }

    const directCoords = collectMirroredCoordinates(coord.x, coord.y, coord.z);

    if (editorToolState.mode === 'paint') {
        applyToMicroxelCoordinates(directCoords, microxel => {
            if (!microxel.active) return;
            microxel.setColor(editorToolState.color);
        });
        return true;
    }

    if (editorToolState.mode === 'erase') {
        applyToMicroxelCoordinates(directCoords, microxel => {
            microxel.destroy();
        });
        return true;
    }

    return false;
}

function applyEditorToolAlongLine(startCoord, endCoord) {
    const lineCoords = getLineCoordinates(startCoord, endCoord);

    lineCoords.forEach(coord => {
        applyEditorToolAtCoord(coord, null);
    });

    return lineCoords.length > 0;
}

function applyEditorToolInBox(startCoord, endCoord) {
    const boxCoords = getBoxCoordinates(startCoord, endCoord);

    boxCoords.forEach(coord => {
        applyEditorToolAtCoord(coord, null);
    });

    return boxCoords.length > 0;
}

function placeMicroxel(targetInstanceId, faceNormal) {
    if (targetInstanceId === null) {
        const fallbackTarget = getPlacementGridTarget();

        if (!fallbackTarget) {
            return;
        }

        const fallbackCoords = collectMirroredCoordinates(
            fallbackTarget.x,
            fallbackTarget.y,
            fallbackTarget.z
        );

        applyToMicroxelCoordinates(fallbackCoords, microxel => {
            microxel.revive();
            microxel.setColor(editorToolState.color);
        });
        console.log(`✨ placed microxel at ${fallbackTarget.x},${fallbackTarget.y},${fallbackTarget.z}`);
        console.log('🧱 VOXEL STATE:', editedVoxel);
        return;
    }

    const { x, y, z } = idToCoord[targetInstanceId];
    const nextCell = {
        x: x + Math.round(faceNormal?.x || 0),
        y: y + Math.round(faceNormal?.y || 0),
        z: z + Math.round(faceNormal?.z || 0)
    };

    if (!isMicroxelPositionInsideEditor(nextCell.x, nextCell.y, nextCell.z)) {
        return;
    }

    const nextCoords = collectMirroredCoordinates(nextCell.x, nextCell.y, nextCell.z);

    applyToMicroxelCoordinates(nextCoords, microxel => {
        microxel.revive();
        microxel.setColor(editorToolState.color);
    });
    console.log(`✨ placed microxel at ${nextCell.x},${nextCell.y},${nextCell.z}`);
    console.log('🧱 VOXEL STATE:', editedVoxel);
}

renderer.domElement.addEventListener('pointerdown', event => {
    updatePointer(event);

    // Only a clean primary press can become an erase action.
    if (event.button !== 0) {
        resetPointerState();
        return;
    }

    const hit = getHit();

    pointerState.active = true;
    pointerState.pointerId = event.pointerId;
    pointerState.startX = event.clientX;
    pointerState.startY = event.clientY;
    pointerState.dragged = false;
    pointerState.hitInstanceId = hit?.instanceId ?? null;
});

renderer.domElement.addEventListener('pointermove', event => {
    if (!pointerState.active || pointerState.pointerId !== event.pointerId) return;

    const movedX = event.clientX - pointerState.startX;
    const movedY = event.clientY - pointerState.startY;

    if (Math.hypot(movedX, movedY) >= dragThreshold) {
        pointerState.dragged = true;
        highlight.visible = false;
    }
});

window.addEventListener('pointerup', event => {
    updatePointer(event);

    if (!pointerState.active || pointerState.pointerId !== event.pointerId) return;

    const targetInstanceId = pointerState.hitInstanceId;
    const hit = !pointerState.dragged ? getHit() : null;
    const fallbackPlacementTarget = !pointerState.dragged && targetInstanceId === null
        ? getPlacementGridTarget()
        : null;
    const shouldApplyTool = !pointerState.dragged && (
        targetInstanceId !== null
        || (editorToolState.mode === 'place' && fallbackPlacementTarget !== null)
    );

    resetPointerState();

    if (!shouldApplyTool) {
        return;
    }

    const primaryCoord = getCurrentEditorTargetCoord(hit);

    if (editorToolState.shapeMode === 'line' || editorToolState.shapeMode === 'box') {
        if (!editorToolState.lineStart) {
            editorToolState.lineStart = primaryCoord ? { ...primaryCoord } : null;
            updateSecondaryPreview(primaryCoord);
            return;
        }

        const startCoord = editorToolState.lineStart;
        editorToolState.lineStart = null;
        lineStartHighlight.visible = false;
        clearLinePreviewHighlights();

        if (editorToolState.shapeMode === 'line') {
            applyEditorToolAlongLine(startCoord, primaryCoord);
            return;
        }

        applyEditorToolInBox(startCoord, primaryCoord);
        return;
    }

    if (editorToolState.mode === 'place') {
        placeMicroxel(targetInstanceId, hit?.face?.normal);
        return;
    }

    if (editorToolState.mode === 'paint') {
        paintMicroxel(targetInstanceId);
        return;
    }

    if (editorToolState.mode === 'erase') {
        destroyMicroxel(targetInstanceId);
    }
});

window.addEventListener('pointercancel', event => {
    resetPointerState();
});
renderer.domElement.addEventListener('pointerleave', () => {
    highlight.visible = false;
    placementSlotHighlight.visible = false;
});

// =========================
// HIGHLIGHT UPDATE
// =========================

function updateHighlight() {
    if (pointerState.active && pointerState.dragged) {
        highlight.visible = false;
        placementSlotHighlight.visible = false;
        clearLinePreviewHighlights();
        return;
    }

    const hit = getHit();
    const currentTargetCoord = getCurrentEditorTargetCoord(hit);

    updateSecondaryPreview(currentTargetCoord);

    if (!hit) {
        const placementTarget = getPlacementGridTarget();

        if (!placementTarget) {
            highlight.visible = false;
            placementSlotHighlight.visible = false;
            return;
        }

        placementSlotHighlight.position.set(
            placementTarget.x - modelCenterOffset,
            0.01,
            placementTarget.z - modelCenterOffset
        );
        placementSlotHighlight.visible = true;
        highlight.visible = false;
        return;
    }

    if (!currentTargetCoord) {
        highlight.visible = false;
        placementSlotHighlight.visible = false;
        return;
    }

    const { x, y, z } = currentTargetCoord;

    highlight.position.set(
        x - modelCenterOffset,
        y + groundOffset,
        z - modelCenterOffset
    );

    placementSlotHighlight.visible = false;
    highlight.scale.set(1, 1, 1);
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

let animationId;
function animate(now = performance.now()) {
    animationId = requestAnimationFrame(animate);
    updateFps(now);
    updateHighlight();
    controls.update();
    renderer.render(scene, camera);
}
animate();

function onResize() {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
}

window.addEventListener('resize', onResize);

function createMicroxelDataGrid(size, { color = '#ffffff', active = true } = {}) {
    return Array.from({ length: size }, (_, x) =>
        Array.from({ length: size }, (_, y) =>
            Array.from({ length: size }, (_, z) => new Microxel({
                x,
                y,
                z,
                color,
                active
            }))
        )
    );
}

function createRandomMicroxelDataGrid(size) {
    return Array.from({ length: size }, () =>
        Array.from({ length: size }, () =>
            Array.from({ length: size }, () => ({
                color: '#ffffff',
                active: Math.random() >= 0.5
            }))
        )
    );
}

function resolveVoxelEditorPreset(presetName) {
    if (presetName === 'random') {
        return {
            type: 'microxeled',
            microxelSize: VOXEL_EDITOR_SIZE,
            microxels: createRandomMicroxelDataGrid(VOXEL_EDITOR_SIZE)
        };
    }

    return voxelEditorPresets[presetName] ?? null;
}

function normalizeEditorVoxelData(data = {}) {
    const nextSize = Number(data?.microxelSize ?? data?.size);

    if (Number.isFinite(nextSize) && Math.floor(nextSize) !== VOXEL_EDITOR_SIZE) {
        throw new Error(`Loaded voxel size does not match the current editor (${VOXEL_EDITOR_SIZE}).`);
    }

    return {
        ...data,
        type: 'microxeled',
        microxelSize: VOXEL_EDITOR_SIZE,
        microxels: Array.isArray(data?.microxels)
            ? data.microxels
            : createMicroxelDataGrid(VOXEL_EDITOR_SIZE, { active: false })
    };
}

function setEditorToolMode(mode = 'erase') {
    if (mode === 'place' || mode === 'paint' || mode === 'erase') {
        editorToolState.mode = mode;
    } else {
        editorToolState.mode = 'erase';
    }
    syncEditorToolButtons();
}

function syncEditorToolButtons() {
    paintToolButton?.classList.toggle('option_selected', editorToolState.mode === 'paint');
    placeToolButton?.classList.toggle('option_selected', editorToolState.mode === 'place');
    eraserToolButton?.classList.toggle('option_selected', editorToolState.mode === 'erase');
    lineModeButton?.classList.toggle('option_selected', editorToolState.shapeMode === 'line');
    boxModeButton?.classList.toggle('option_selected', editorToolState.shapeMode === 'box');
}

function syncMirrorGuides() {
    const mirrorCenter = (VOXEL_EDITOR_SIZE - 1) * 0.5 - modelCenterOffset;
    const mirrorCenterY = groundOffset + (VOXEL_EDITOR_SIZE - 1) * 0.5;
    const guideSpan = VOXEL_EDITOR_SIZE + 3;

    mirrorGuideX.visible = editorToolState.mirror.x;
    mirrorGuideY.visible = editorToolState.mirror.y;
    mirrorGuideZ.visible = editorToolState.mirror.z;

    mirrorGuideX.position.set(mirrorCenter, mirrorCenterY, 0);
    mirrorGuideX.rotation.set(0, Math.PI * 0.5, 0);
    mirrorGuideX.scale.set(guideSpan, guideSpan, 1);

    mirrorGuideY.position.set(0, mirrorCenterY, 0);
    mirrorGuideY.rotation.set(-Math.PI * 0.5, 0, 0);
    mirrorGuideY.scale.set(guideSpan, guideSpan, 1);

    mirrorGuideZ.position.set(0, mirrorCenterY, mirrorCenter);
    mirrorGuideZ.rotation.set(0, 0, 0);
    mirrorGuideZ.scale.set(guideSpan, guideSpan, 1);
}

function setEditorShapeMode(shapeMode = 'single') {
    if (shapeMode === 'line' || shapeMode === 'box') {
        editorToolState.shapeMode = shapeMode;
    } else {
        editorToolState.shapeMode = 'single';
    }
    editorToolState.lineStart = null;
    lineStartHighlight.visible = false;
    clearLinePreviewHighlights();
    syncEditorToolButtons();
}

function isMicroxelPositionInsideEditor(x, y, z) {
    return (
        x >= 0 && x < VOXEL_EDITOR_SIZE
        && y >= 0 && y < VOXEL_EDITOR_SIZE
        && z >= 0 && z < VOXEL_EDITOR_SIZE
    );
}

function getInstanceIdFromCoord(x, y, z) {
    return x * VOXEL_EDITOR_SIZE * VOXEL_EDITOR_SIZE
        + y * VOXEL_EDITOR_SIZE
        + z;
}

function collectMirroredCoordinates(x, y, z) {
    const axisValues = {
        x: editorToolState.mirror.x ? [x, mirrorCoordinate(x)] : [x],
        y: editorToolState.mirror.y ? [y, mirrorCoordinate(y)] : [y],
        z: editorToolState.mirror.z ? [z, mirrorCoordinate(z)] : [z]
    };
    const uniqueCoords = new Map();

    axisValues.x.forEach(nextX => {
        axisValues.y.forEach(nextY => {
            axisValues.z.forEach(nextZ => {
                if (!isMicroxelPositionInsideEditor(nextX, nextY, nextZ)) return;
                uniqueCoords.set(`${nextX},${nextY},${nextZ}`, {
                    x: nextX,
                    y: nextY,
                    z: nextZ
                });
            });
        });
    });

    return Array.from(uniqueCoords.values());
}

function mirrorCoordinate(value) {
    return VOXEL_EDITOR_SIZE - 1 - value;
}

function applyToMicroxelCoordinates(coords, callback) {
    coords.forEach(coord => {
        const microxel = readEditorMicroxel(coord.x, coord.y, coord.z);
        if (!microxel) return;

        callback(microxel, coord);
        syncMicroxelVisual(getInstanceIdFromCoord(coord.x, coord.y, coord.z));
    });
}

function createMirrorGuide(color) {
    const guide = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity: 0.18,
            side: THREE.DoubleSide,
            depthWrite: false
        })
    );

    guide.visible = false;
    return guide;
}

function getCurrentEditorTargetCoord(hit = getHit()) {
    if (editorToolState.mode === 'place') {
        const adjacentPlacementTarget = getAdjacentPlacementTarget(hit);
        if (adjacentPlacementTarget) {
            return adjacentPlacementTarget;
        }

        const placementTarget = getPlacementGridTarget();
        return placementTarget ? { ...placementTarget } : null;
    }

    if (hit?.instanceId != null) {
        return { ...idToCoord[hit.instanceId] };
    }

    return null;
}

function updateSecondaryPreview(currentTargetCoord) {
    if (
        (editorToolState.shapeMode !== 'line' && editorToolState.shapeMode !== 'box')
        || !editorToolState.lineStart
    ) {
        lineStartHighlight.visible = false;
        clearLinePreviewHighlights();
        return;
    }

    const startWorldPosition = getPreviewWorldPosition(editorToolState.lineStart);
    lineStartHighlight.position.copy(startWorldPosition);
    lineStartHighlight.visible = true;

    if (!currentTargetCoord) {
        clearLinePreviewHighlights();
        return;
    }

    const previewCoords = editorToolState.shapeMode === 'line'
        ? getLineCoordinates(editorToolState.lineStart, currentTargetCoord)
        : getBoxCoordinates(editorToolState.lineStart, currentTargetCoord);
    renderLinePreviewHighlights(previewCoords);
}

function getPreviewWorldPosition(coord) {
    return new THREE.Vector3(
        coord.x - modelCenterOffset,
        coord.y + groundOffset,
        coord.z - modelCenterOffset
    );
}

function renderLinePreviewHighlights(coords) {
    clearLinePreviewHighlights();

    if (!Array.isArray(coords) || coords.length < 2) {
        return;
    }

    coords.forEach(coord => {
        const previewVoxel = new THREE.Mesh(linePreviewGeometry, linePreviewMaterial);
        previewVoxel.position.copy(getPreviewWorldPosition(coord));
        linePreviewGroup.add(previewVoxel);
    });

    linePreviewGroup.visible = true;
}

function clearLinePreviewHighlights() {
    linePreviewGroup.visible = false;

    while (linePreviewGroup.children.length > 0) {
        linePreviewGroup.remove(linePreviewGroup.children[0]);
    }
}

function getLineCoordinates(startCoord, endCoord) {
    const start = {
        x: Math.round(startCoord?.x ?? 0),
        y: Math.round(startCoord?.y ?? 0),
        z: Math.round(startCoord?.z ?? 0)
    };
    const end = {
        x: Math.round(endCoord?.x ?? 0),
        y: Math.round(endCoord?.y ?? 0),
        z: Math.round(endCoord?.z ?? 0)
    };
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const dz = end.z - start.z;
    const steps = Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz));
    const coords = [];

    if (steps === 0) {
        return [start];
    }

    for (let step = 0; step <= steps; step += 1) {
        const t = step / steps;
        const coord = {
            x: Math.round(start.x + dx * t),
            y: Math.round(start.y + dy * t),
            z: Math.round(start.z + dz * t)
        };

        if (!isMicroxelPositionInsideEditor(coord.x, coord.y, coord.z)) {
            continue;
        }

        const previous = coords[coords.length - 1];
        if (previous && previous.x === coord.x && previous.y === coord.y && previous.z === coord.z) {
            continue;
        }

        coords.push(coord);
    }

    return coords;
}

function getBoxCoordinates(startCoord, endCoord) {
    const start = {
        x: Math.round(startCoord?.x ?? 0),
        y: Math.round(startCoord?.y ?? 0),
        z: Math.round(startCoord?.z ?? 0)
    };
    const end = {
        x: Math.round(endCoord?.x ?? 0),
        y: Math.round(endCoord?.y ?? 0),
        z: Math.round(endCoord?.z ?? 0)
    };
    const minX = Math.min(start.x, end.x);
    const maxX = Math.max(start.x, end.x);
    const minY = Math.min(start.y, end.y);
    const maxY = Math.max(start.y, end.y);
    const minZ = Math.min(start.z, end.z);
    const maxZ = Math.max(start.z, end.z);
    const coords = [];

    for (let x = minX; x <= maxX; x += 1) {
        for (let y = minY; y <= maxY; y += 1) {
            for (let z = minZ; z <= maxZ; z += 1) {
                if (!isMicroxelPositionInsideEditor(x, y, z)) {
                    continue;
                }

                coords.push({ x, y, z });
            }
        }
    }

    return coords;
}

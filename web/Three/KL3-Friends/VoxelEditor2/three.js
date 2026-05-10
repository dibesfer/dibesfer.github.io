import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Microxel } from './assets/classes/Microxel.js';
import { Voxel } from './assets/classes/Voxel.js';
import { Binarier } from './assets/classes/Binarier.js';
import {
    DEFAULT_MICROXEL_COLOR,
    MICROXEL_COLORS12,
    MICROXEL_PALETTE_ENCODING,
} from './assets/classes/MicroxelPalette.js';

const DEFAULT_VOXEL_EDITOR_SIZE = 15;
const MIN_VOXEL_EDITOR_SIZE = 1;
const MAX_VOXEL_EDITOR_SIZE = 64;
const LOCAL_STORAGE_VOXEL_KEY = 'voxel-editor.currentVoxel';
const LOCAL_STORAGE_SAVE_DELAY = 3000;
const HISTORY_LIMIT = 80;
const RIGHT_ANGLE_DEGREES = 90;
const ORIENTATION_LABEL_DISTANCE_PADDING = 1.2;
const ORIENTATION_LABEL_MIN_SCALE = 1.8;
const ORIENTATION_LABEL_SCALE_PER_MICROXEL = 0.32;
let voxelEditorSize = DEFAULT_VOXEL_EDITOR_SIZE;
let localStorageSaveTimeout = null;
let historyBatchDepth = 0;
let historyBatchChanged = false;
const undoStack = [];
const redoStack = [];
const voxelBinarier = new Binarier();

// The editor produces one shared Voxel and edits its Microxels directly.
const editedVoxel = new Voxel({
    name: 'Default Voxel',
    type: 'microxeled',
    microxelSize: voxelEditorSize
});
const fpsCounter = document.getElementById('fpsCounter');
const uiVoxelName = document.getElementById('UIVoxelName');
const microxelPaletteGrid = document.getElementById('microxelPaletteGrid');
const paintToolButton = document.getElementById('paintToolButton');
const placeToolButton = document.getElementById('placeToolButton');
const eraserToolButton = document.getElementById('eraserToolButton');
const lineModeButton = document.getElementById('lineModeButton');
const boxModeButton = document.getElementById('boxModeButton');
const mirrorXInput = document.getElementById('mirrorXInput');
const mirrorYInput = document.getElementById('mirrorYInput');
const mirrorZInput = document.getElementById('mirrorZInput');
const rotateXInput = document.getElementById('rotateXInput');
const rotateYInput = document.getElementById('rotateYInput');
const rotateZInput = document.getElementById('rotateZInput');
const editorToolState = {
    mode: 'erase',
    shapeMode: 'single',
    color: DEFAULT_MICROXEL_COLOR,
    lineStart: null,
    mirror: {
        x: false,
        y: false,
        z: false
    }
};
editedVoxel.fromJSON(resolveVoxelEditorPreset('full', voxelEditorSize));
restoreVoxelFromLocalStorage();
pushHistorySnapshot();

window.getVoxelSaveData = () => getBakedVoxelSaveData();
window.getVoxelBinaryBlob = (saveData = getBakedVoxelSaveData()) => voxelBinarier.encode(saveData);
window.getVoxelFileStats = async (saveData = getBakedVoxelSaveData()) => getVoxelFileStats(saveData);
window.applyVoxelFile = (file) => applyVoxelFile(file);
window.getVoxelEditorSize = () => voxelEditorSize;
window.ensureVoxelName = (fallbackName = 'Table') => {
    const nextName = editedVoxel.name || String(fallbackName).trim() || 'Table';

    editedVoxel.setName(nextName);
    syncVoxelNameInput();
    recordVoxelHistory();

    return getBakedVoxelSaveData();
};

function syncVoxelNameInput() {
    uiVoxelName.value = editedVoxel.name;
}

uiVoxelName.addEventListener('input', event => {
    editedVoxel.setName(event.target.value);
    recordVoxelHistory();
});

renderMicroxelPaletteGrid();

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

setupRotationInput(rotateXInput, 'x');
setupRotationInput(rotateYInput, 'y');
setupRotationInput(rotateZInput, 'z');

syncVoxelNameInput();
syncVoxelRotationInputs();
syncEditorToolButtons();
syncMicroxelPaletteSelection();

console.log('🔥 INITIAL VOXEL:', editedVoxel);

function renderMicroxelPaletteGrid() {
    if (!microxelPaletteGrid) return;

    microxelPaletteGrid.innerHTML = '';

    MICROXEL_COLORS12.forEach((paletteColor) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'microxel-color-button';
        button.title = `${paletteColor.name} ${paletteColor.color}`;
        button.dataset.color = paletteColor.color;
        button.style.backgroundColor = paletteColor.color;
        button.addEventListener('click', () => {
            editorToolState.color = paletteColor.color;
            syncMicroxelPaletteSelection();
        });

        microxelPaletteGrid.appendChild(button);
    });

    syncMicroxelPaletteSelection();
}

function syncMicroxelPaletteSelection() {
    if (!microxelPaletteGrid) return;

    const selectedColor = normalizeMicroxelPaletteColor(editorToolState.color);
    Array.from(microxelPaletteGrid.querySelectorAll('.microxel-color-button')).forEach((button) => {
        button.classList.toggle('is-selected', button.dataset.color === selectedColor);
    });
}

function normalizeMicroxelPaletteColor(color = DEFAULT_MICROXEL_COLOR) {
    const text = typeof color === 'string' ? color.trim().toLowerCase() : '';
    const match = MICROXEL_COLORS12.find((paletteColor) => paletteColor.color === text);

    return match?.color ?? DEFAULT_MICROXEL_COLOR;
}

function getRandomMicroxelPaletteColor() {
    return MICROXEL_COLORS12[Math.floor(Math.random() * MICROXEL_COLORS12.length)]?.color
        ?? DEFAULT_MICROXEL_COLOR;
}

function getMicroxelPaletteId(color = DEFAULT_MICROXEL_COLOR) {
    const normalizedColor = normalizeMicroxelPaletteColor(color);
    return MICROXEL_COLORS12.find((paletteColor) => paletteColor.color === normalizedColor)?.id ?? 1;
}


// =========================
// THREE SETUP
// =========================

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111111);

const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 1000);
const defaultCameraPosition = new THREE.Vector3(-20, 20, -20);
camera.position.copy(defaultCameraPosition);

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

let gridHelper = null;
let orientationNorthLabel = null;
let voxelModelGroup = null;

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

const matrix = new THREE.Matrix4();
const quaternion = new THREE.Quaternion();
const activeScale = new THREE.Vector3(1, 1, 1);
const hiddenScale = new THREE.Vector3(0, 0, 0);
const tempPosition = new THREE.Vector3();
const tempColor = new THREE.Color();
const tempHitPoint = new THREE.Vector3();
const tempVoxelRotationEuler = new THREE.Euler();
const groundOffset = 0.5;
let modelCenterOffset = getModelCenterOffset();
let instanced = null;
let idToCoord = [];

rebuildEditorMesh();

function getModelCenterOffset() {
    return (voxelEditorSize - 1) / 2;
}

function rebuildEditorMesh() {
    if (gridHelper) {
        scene.remove(gridHelper);
        gridHelper.geometry.dispose();
        gridHelper.material.dispose();
    }

    if (!voxelModelGroup) {
        voxelModelGroup = new THREE.Group();
        scene.add(voxelModelGroup);
    }

    if (instanced) {
        voxelModelGroup.remove(instanced);
        instanced.dispose?.();
    }

    modelCenterOffset = getModelCenterOffset();
    idToCoord = [];
    gridHelper = new THREE.GridHelper(voxelEditorSize, voxelEditorSize, 0xffffff, 0xffffff);
    scene.add(gridHelper);
    ensureOrientationNorthLabel();
    updateOrientationNorthLabel();
    syncVoxelModelRotation();

    instanced = new THREE.InstancedMesh(
        geometry,
        material,
        voxelEditorSize * voxelEditorSize * voxelEditorSize
    );

    let instanceId = 0;

    for (let x = 0; x < voxelEditorSize; x += 1) {
        for (let y = 0; y < voxelEditorSize; y += 1) {
            for (let z = 0; z < voxelEditorSize; z += 1) {
                idToCoord[instanceId] = { x, y, z };
                syncMicroxelVisual(instanceId);
                instanceId += 1;
            }
        }
    }

    instanced.instanceMatrix.needsUpdate = true;
    instanced.instanceColor.needsUpdate = true;
    voxelModelGroup.add(instanced);
    syncVoxelModelRotation();
    frameCameraToVoxelSize();
    updateOrientationNorthLabel();
}

function getMicroxelPosition(x, y, z) {
    return tempPosition.set(
        x - modelCenterOffset,
        y - modelCenterOffset,
        z - modelCenterOffset
    );
}

function readEditorMicroxel(x, y, z) {
    return editedVoxel.get(x, y, z);
}

function getModelCenterY() {
    return groundOffset + (voxelEditorSize - 1) * 0.5;
}

function frameCameraToVoxelSize() {
    const sizeScale = voxelEditorSize / DEFAULT_VOXEL_EDITOR_SIZE;
    const modelTarget = new THREE.Vector3(0, getModelCenterY(), 0);
    const defaultModelTarget = new THREE.Vector3(
        0,
        groundOffset + (DEFAULT_VOXEL_EDITOR_SIZE - 1) * 0.5,
        0
    );
    const cameraOffset = defaultCameraPosition
        .clone()
        .sub(defaultModelTarget)
        .multiplyScalar(sizeScale);

    controls.target.copy(modelTarget);
    camera.position.copy(modelTarget).add(cameraOffset);
    controls.update();
}

function syncMicroxelVisual(currentInstanceId) {
    const coord = idToCoord[currentInstanceId];

    if (!coord || !instanced) return;

    const { x, y, z } = coord;
    const microxel = readEditorMicroxel(x, y, z);
    const position = getMicroxelPosition(x, y, z);

    // Render state always comes from the shared Microxel model.
    matrix.compose(
        position,
        quaternion,
        microxel?.active ? activeScale : hiddenScale
    );

    instanced.setMatrixAt(currentInstanceId, matrix);
    instanced.setColorAt(currentInstanceId, tempColor.set(microxel?.color || DEFAULT_MICROXEL_COLOR));
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
        return applyVoxelData(JSON.parse(jsonText));
    } catch (error) {
        return {
            ok: false,
            message: error instanceof Error ? error.message : 'Invalid voxel JSON.'
        };
    }
};

async function applyVoxelFile(file) {
    if (!file) {
        return { ok: false, message: 'No file selected.' };
    }

    const buffer = await file.arrayBuffer();
    const data = isKL3BinaryBuffer(buffer)
        ? await voxelBinarier.decode(buffer)
        : JSON.parse(new TextDecoder().decode(buffer));
    const result = applyVoxelData(data);

    if (result.ok) {
        result.message = `${result.message} (${isKL3BinaryBuffer(buffer) ? 'binary' : 'JSON'})`;
    }

    return result;
}

function applyVoxelData(data = {}) {
    try {
        const normalizedVoxelData = normalizeEditorVoxelData(data);
        const nextSize = normalizeVoxelEditorSize(normalizedVoxelData.microxelSize);

        voxelEditorSize = nextSize;
        editedVoxel.fromJSON(normalizedVoxelData);
        syncVoxelNameInput();
        rebuildEditorMesh();
        resetEditorSelectionState();
        syncMirrorGuides();
        syncVoxelRotationInputs();
        syncVoxelModelRotation();
        updateOrientationNorthLabel();
        recordVoxelHistory();

        return { ok: true, message: `Voxel loaded (${voxelEditorSize}³).` };
    } catch (error) {
        return {
            ok: false,
            message: error instanceof Error ? error.message : 'Invalid voxel data.'
        };
    }
}

function isKL3BinaryBuffer(buffer) {
    if (!buffer || buffer.byteLength < 4) return false;

    const magic = new TextDecoder().decode(new Uint8Array(buffer, 0, 4));

    return magic === 'KL3B';
}

async function getVoxelFileStats(saveData = getBakedVoxelSaveData()) {
    const jsonBytes = new TextEncoder().encode(JSON.stringify(saveData, null, 2)).length;
    const binaryBlob = await voxelBinarier.encode(saveData);
    const binaryBytes = binaryBlob.size;
    const savedPercent = jsonBytes > 0
        ? Math.max(0, Math.round((1 - binaryBytes / jsonBytes) * 100))
        : 0;

    return {
        jsonBytes,
        binaryBytes,
        savedPercent,
    };
}

window.applyVoxelPreset = (presetName, requestedSize = voxelEditorSize) => {
    if (!presetName) {
        return { ok: false, message: 'Select a template first.' };
    }

    const nextSize = normalizeVoxelEditorSize(requestedSize);
    const presetData = resolveVoxelEditorPreset(presetName, nextSize);

    if (!presetData) {
        return { ok: false, message: `Preset "${presetName}" could not be loaded.` };
    }

    try {
        voxelEditorSize = nextSize;
        editedVoxel.fromJSON({
            ...presetData,
            name: editedVoxel.name
        });
        rebuildEditorMesh();
        resetEditorSelectionState();
        syncMirrorGuides();
        syncVoxelRotationInputs();
        syncVoxelModelRotation();
        updateOrientationNorthLabel();
        recordVoxelHistory();

        return { ok: true, message: `Preset "${presetName}" loaded (${voxelEditorSize}³).` };
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
    if (!instanced || (pointerState.active && pointerState.dragged)) {
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

function resetEditorSelectionState() {
    resetPointerState();
    editorToolState.lineStart = null;
    highlight.visible = false;
    placementSlotHighlight.visible = false;
    lineStartHighlight.visible = false;
    clearLinePreviewHighlights();
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

    runHistoryBatch(() => {
        lineCoords.forEach(coord => {
            applyEditorToolAtCoord(coord, null);
        });
    });

    return lineCoords.length > 0;
}

function applyEditorToolInBox(startCoord, endCoord) {
    const boxCoords = getBoxCoordinates(startCoord, endCoord);

    runHistoryBatch(() => {
        boxCoords.forEach(coord => {
            applyEditorToolAtCoord(coord, null);
        });
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

    highlight.position.copy(getPreviewWorldPosition({ x, y, z }));
    if (voxelModelGroup) {
        highlight.rotation.copy(voxelModelGroup.rotation);
    }

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
    updateOrientationNorthLabel();
}

window.addEventListener('resize', onResize);
window.addEventListener('beforeunload', saveVoxelToLocalStorage);
window.addEventListener('pagehide', saveVoxelToLocalStorage);
window.addEventListener('keydown', handleHistoryShortcut);

function createMicroxelDataGrid(size, { color = DEFAULT_MICROXEL_COLOR, active = true } = {}) {
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

function createEmptyMicroxelGrid(size) {
    return createMicroxelDataGrid(size, { active: false });
}

function createRandomMicroxelDataGrid(size) {
    return Array.from({ length: size }, () =>
        Array.from({ length: size }, () =>
            Array.from({ length: size }, () => ({
                color: getRandomMicroxelPaletteColor(),
                active: Math.random() >= 0.5
            }))
        )
    );
}

function resolveVoxelEditorPreset(presetName, size = voxelEditorSize) {
    const normalizedSize = normalizeVoxelEditorSize(size);

    if (presetName === 'random') {
        return {
            type: 'microxeled',
            microxelSize: normalizedSize,
            microxels: createRandomMicroxelDataGrid(normalizedSize)
        };
    }

    if (presetName === 'empty') {
        return {
            type: 'microxeled',
            microxelSize: normalizedSize,
            microxels: createMicroxelDataGrid(normalizedSize, { active: false })
        };
    }

    if (presetName === 'full') {
        return {
            type: 'microxeled',
            microxelSize: normalizedSize,
            microxels: createMicroxelDataGrid(normalizedSize, { active: true })
        };
    }

    return null;
}

function normalizeEditorVoxelData(data = {}) {
    const microxelsFromPalette = microxelPaletteToMicroxels(data?.microxelPalette, data?.color);
    const sourceMicroxels = Array.isArray(data?.microxels)
        ? data.microxels
        : microxelsFromPalette;
    const inferredSize = Array.isArray(sourceMicroxels)
        ? sourceMicroxels.length
        : data?.microxelSize || data?.size || voxelEditorSize;
    const nextSize = normalizeVoxelEditorSize(inferredSize);
    const fallbackColor = typeof data?.color === 'string' && data.color.trim()
        ? normalizeMicroxelPaletteColor(data.color)
        : DEFAULT_MICROXEL_COLOR;
    const fallbackActive = data?.active ?? true;

    return {
        ...data,
        type: 'microxeled',
        color: fallbackColor,
        microxelSize: nextSize,
        microxels: Array.isArray(sourceMicroxels)
            ? sourceMicroxels
            : createMicroxelDataGrid(nextSize, { color: fallbackColor, active: Boolean(fallbackActive) })
    };
}

function microxelPaletteToMicroxels(microxelPalette = null, fallbackColor = DEFAULT_MICROXEL_COLOR) {
    if (!microxelPalette || typeof microxelPalette !== 'object') {
        return null;
    }

    const size = normalizeVoxelEditorSize(microxelPalette.size ?? microxelPalette.microxelSize);
    const colors = normalizeMicroxelPaletteColors(microxelPalette.colors ?? microxelPalette.palette);
    const indices = normalizeMicroxelPaletteIndices(microxelPalette.indices, size);
    const fallback = normalizeMicroxelPaletteColor(fallbackColor);

    return Array.from({ length: size }, (_, x) =>
        Array.from({ length: size }, (_, y) =>
            Array.from({ length: size }, (_, z) => {
                const paletteIndex = indices[getCompactCellIndex(x, y, z, size)] ?? 0;
                const active = paletteIndex > 0;
                const color = active
                    ? normalizeMicroxelPaletteColor(colors[paletteIndex - 1] ?? fallback)
                    : fallback;

                return new Microxel({ x, y, z, color, active });
            })
        )
    );
}

function normalizeMicroxelPaletteColors(colors = []) {
    const normalizedColors = (Array.isArray(colors) ? colors : [])
        .map((color) => normalizeMicroxelPaletteColor(color));

    return normalizedColors.length > 0
        ? normalizedColors
        : MICROXEL_COLORS12.map((paletteColor) => paletteColor.color);
}

function normalizeMicroxelPaletteIndices(indices = [], size = voxelEditorSize) {
    const volume = size * size * size;
    const output = new Array(volume).fill(0);
    const source = Array.isArray(indices)
        ? indices
        : ArrayBuffer.isView(indices)
            ? Array.from(indices)
            : [];
    const limit = Math.min(source.length, volume);

    for (let index = 0; index < limit; index += 1) {
        const value = Math.floor(Number(source[index]) || 0);
        output[index] = Math.min(Math.max(value, 0), MICROXEL_COLORS12.length);
    }

    return output;
}


function normalizeVoxelEditorSize(size = DEFAULT_VOXEL_EDITOR_SIZE) {
    const numericSize = Math.floor(Number(size));

    if (!Number.isFinite(numericSize)) {
        throw new Error('Voxel size must be a number.');
    }

    if (numericSize < MIN_VOXEL_EDITOR_SIZE || numericSize > MAX_VOXEL_EDITOR_SIZE) {
        throw new Error(`Voxel size must be between ${MIN_VOXEL_EDITOR_SIZE} and ${MAX_VOXEL_EDITOR_SIZE}.`);
    }

    return numericSize;
}

function restoreVoxelFromLocalStorage() {
    try {
        const savedVoxel = localStorage.getItem(LOCAL_STORAGE_VOXEL_KEY);

        if (!savedVoxel) return;

        const normalizedVoxelData = normalizeEditorVoxelData(JSON.parse(savedVoxel));

        voxelEditorSize = normalizeVoxelEditorSize(normalizedVoxelData.microxelSize);
        editedVoxel.fromJSON(normalizedVoxelData);
    } catch (error) {
        console.warn('Saved voxel could not be restored.', error);
    }
}

function scheduleVoxelLocalSave() {
    clearTimeout(localStorageSaveTimeout);
    localStorageSaveTimeout = setTimeout(saveVoxelToLocalStorage, LOCAL_STORAGE_SAVE_DELAY);
}

function saveVoxelToLocalStorage() {
    clearTimeout(localStorageSaveTimeout);
    localStorageSaveTimeout = null;

    try {
        localStorage.setItem(LOCAL_STORAGE_VOXEL_KEY, JSON.stringify(editedVoxel.toJSON()));
    } catch (error) {
        console.warn('Voxel could not be saved locally.', error);
    }
}

function getCurrentVoxelSnapshot() {
    return JSON.stringify(editedVoxel.toJSON());
}

function pushHistorySnapshot(stack = undoStack, snapshot = getCurrentVoxelSnapshot()) {
    if (stack[stack.length - 1] === snapshot) {
        return false;
    }

    stack.push(snapshot);

    if (stack.length > HISTORY_LIMIT) {
        stack.shift();
    }

    return true;
}

function recordVoxelHistory() {
    if (historyBatchDepth > 0) {
        historyBatchChanged = true;
        return;
    }

    if (pushHistorySnapshot()) {
        redoStack.length = 0;
    }

    scheduleVoxelLocalSave();
}

function runHistoryBatch(callback) {
    historyBatchDepth += 1;

    try {
        callback();
    } finally {
        historyBatchDepth -= 1;

        if (historyBatchDepth === 0 && historyBatchChanged) {
            historyBatchChanged = false;
            recordVoxelHistory();
        }
    }
}

function restoreVoxelSnapshot(snapshot) {
    const normalizedVoxelData = normalizeEditorVoxelData(JSON.parse(snapshot));

    voxelEditorSize = normalizeVoxelEditorSize(normalizedVoxelData.microxelSize);
    editedVoxel.fromJSON(normalizedVoxelData);
    syncVoxelNameInput();
    rebuildEditorMesh();
    resetEditorSelectionState();
    syncMirrorGuides();
    syncVoxelRotationInputs();
    syncVoxelModelRotation();
    updateOrientationNorthLabel();
    saveVoxelToLocalStorage();
}

function undoVoxelChange() {
    if (undoStack.length <= 1) {
        return;
    }

    const currentSnapshot = undoStack.pop();
    redoStack.push(currentSnapshot);
    restoreVoxelSnapshot(undoStack[undoStack.length - 1]);
}

function redoVoxelChange() {
    const nextSnapshot = redoStack.pop();

    if (!nextSnapshot) {
        return;
    }

    pushHistorySnapshot(undoStack, nextSnapshot);
    restoreVoxelSnapshot(nextSnapshot);
}

function handleHistoryShortcut(event) {
    if (!event.ctrlKey || event.altKey || event.metaKey) {
        return;
    }

    const key = event.key.toLowerCase();

    if (key === 'z') {
        event.preventDefault();
        undoVoxelChange();
        return;
    }

    if (key === 'y') {
        event.preventDefault();
        redoVoxelChange();
    }
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

function normalizeRotationDegrees(value = 0) {
    const numericValue = Number(value);
    const finiteValue = Number.isFinite(numericValue) ? numericValue : 0;
    const snappedValue = Math.round(finiteValue / RIGHT_ANGLE_DEGREES) * RIGHT_ANGLE_DEGREES;

    // Keep rotation as a clean 0/90/180/270 cycle.
    return ((snappedValue % 360) + 360) % 360;
}

function setupRotationInput(input, axis = '') {
    if (!input) {
        return;
    }

    input.dataset.rotationAxis = axis;
    input.dataset.lastRotationValue = normalizeRotationDegrees(input.value);

    input.addEventListener('input', () => {
        syncVoxelRotationFromInputs();
    });

    input.addEventListener('change', () => {
        syncVoxelRotationFromInputs();
    });

    input.addEventListener('keydown', event => {
        if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') {
            return;
        }

        event.preventDefault();
        const direction = event.key === 'ArrowUp' ? 1 : -1;
        stepRotationInput(input, direction);
    });

    input.addEventListener('wheel', event => {
        if (document.activeElement !== input) {
            return;
        }

        event.preventDefault();
        const direction = event.deltaY < 0 ? 1 : -1;
        stepRotationInput(input, direction);
    }, { passive: false });
}

function stepRotationInput(input, direction = 1) {
    if (!input) {
        return;
    }

    const currentValue = normalizeRotationDegrees(input.dataset.lastRotationValue ?? input.value);
    input.value = normalizeRotationDegrees(currentValue + direction * RIGHT_ANGLE_DEGREES);
    syncVoxelRotationFromInputs();
}

function syncVoxelRotationFromInputs() {
    const nextRotation = {
        x: normalizeRotationDegrees(rotateXInput?.value),
        y: normalizeRotationDegrees(rotateYInput?.value),
        z: normalizeRotationDegrees(rotateZInput?.value)
    };

    editedVoxel.setRotation(nextRotation);
    syncVoxelRotationInputs();
    syncVoxelModelRotation();
    resetEditorSelectionState();
    recordVoxelHistory();
}

function syncVoxelRotationInputs() {
    const rotation = editedVoxel.rotation || { x: 0, y: 0, z: 0 };

    syncRotationInputValue(rotateXInput, rotation.x);
    syncRotationInputValue(rotateYInput, rotation.y);
    syncRotationInputValue(rotateZInput, rotation.z);
}

function syncRotationInputValue(input, value = 0) {
    if (!input) {
        return;
    }

    const normalizedValue = normalizeRotationDegrees(value);
    input.value = normalizedValue;
    input.dataset.lastRotationValue = normalizedValue;
}

function getSignedRotationDegrees(value = 0) {
    const normalizedValue = normalizeRotationDegrees(value);

    if (normalizedValue === 270) {
        return -RIGHT_ANGLE_DEGREES;
    }

    return normalizedValue;
}

function getBakedVoxelSaveData() {
    const saveData = editedVoxel.toJSON();
    const rotation = saveData.rotation || { x: 0, y: 0, z: 0 };
    let bakedMicroxels = Array.isArray(saveData.microxels) ? saveData.microxels : null;

    if (bakedMicroxels) {
        const rotationSteps = [
            ['x', getSignedRotationDegrees(rotation.x)],
            ['y', getSignedRotationDegrees(rotation.y)],
            ['z', getSignedRotationDegrees(rotation.z)]
        ];

        rotationSteps.forEach(([axis, degrees]) => {
            if (degrees !== 0) {
                bakedMicroxels = rotateSerializedMicroxelData(bakedMicroxels, axis, degrees);
            }
        });
    }

    const compactPalette = createCompactMicroxelPalette(bakedMicroxels, saveData.color);

    delete saveData.rotation;
    delete saveData.microxels;

    saveData.type = 'microxeled';
    saveData.color = DEFAULT_MICROXEL_COLOR;
    saveData.microxelSize = compactPalette.size;
    saveData.microxelPalette = compactPalette;

    return saveData;
}

function createCompactMicroxelPalette(microxels = null, fallbackColor = DEFAULT_MICROXEL_COLOR) {
    const size = normalizeVoxelEditorSize(
        Array.isArray(microxels) ? microxels.length : voxelEditorSize
    );
    const indices = new Array(size * size * size).fill(0);

    for (let x = 0; x < size; x += 1) {
        for (let y = 0; y < size; y += 1) {
            for (let z = 0; z < size; z += 1) {
                const cell = microxels?.[x]?.[y]?.[z] ?? null;
                const active = cell?.active ?? cell?.filled ?? false;
                if (!active) continue;

                indices[getCompactCellIndex(x, y, z, size)] = getMicroxelPaletteId(cell?.color ?? fallbackColor);
            }
        }
    }

    return {
        encoding: MICROXEL_PALETTE_ENCODING,
        size,
        colors: MICROXEL_COLORS12.map((paletteColor) => paletteColor.color),
        indexType: 'uint8',
        indices
    };
}

function getCompactCellIndex(x = 0, y = 0, z = 0, size = voxelEditorSize) {
    return x + y * size + z * size * size;
}


function rotateSerializedMicroxelData(sourceMicroxels, axis = '', degrees = 0) {
    const steps = ((Math.round(degrees / RIGHT_ANGLE_DEGREES) % 4) + 4) % 4;
    let rotatedMicroxels = cloneSerializedMicroxelGrid(sourceMicroxels);

    for (let step = 0; step < steps; step += 1) {
        rotatedMicroxels = rotateSerializedMicroxelDataOnce(rotatedMicroxels, axis);
    }

    return rotatedMicroxels;
}

function rotateSerializedMicroxelDataOnce(sourceMicroxels, axis = '') {
    const size = sourceMicroxels.length;
    const rotatedMicroxels = createEmptySerializedMicroxelGrid(size);

    for (let x = 0; x < size; x += 1) {
        for (let y = 0; y < size; y += 1) {
            for (let z = 0; z < size; z += 1) {
                const sourceCell = sourceMicroxels?.[x]?.[y]?.[z];
                if (!sourceCell) continue;

                const targetCoord = rotateMicroxelCoordOnce(axis, x, y, z, size);
                rotatedMicroxels[targetCoord.x][targetCoord.y][targetCoord.z] = {
                    ...sourceCell,
                    position: {
                        x: targetCoord.x,
                        y: targetCoord.y,
                        z: targetCoord.z
                    }
                };
            }
        }
    }

    return rotatedMicroxels;
}

function createEmptySerializedMicroxelGrid(size) {
    return Array.from({ length: size }, (_, x) =>
        Array.from({ length: size }, (_, y) =>
            Array.from({ length: size }, (_, z) => ({
                position: { x, y, z },
                color: DEFAULT_MICROXEL_COLOR,
                active: false
            }))
        )
    );
}

function cloneSerializedMicroxelGrid(sourceMicroxels) {
    const size = sourceMicroxels.length;

    return Array.from({ length: size }, (_, x) =>
        Array.from({ length: size }, (_, y) =>
            Array.from({ length: size }, (_, z) => {
                const sourceCell = sourceMicroxels?.[x]?.[y]?.[z];
                return sourceCell
                    ? {
                        ...sourceCell,
                        position: {
                            x,
                            y,
                            z
                        }
                    }
                    : {
                        position: { x, y, z },
                        color: DEFAULT_MICROXEL_COLOR,
                        active: false
                    };
            })
        )
    );
}

function rotateMicroxelData(axis = '', degrees = 0) {
    const steps = ((Math.round(degrees / RIGHT_ANGLE_DEGREES) % 4) + 4) % 4;

    for (let step = 0; step < steps; step += 1) {
        rotateMicroxelDataOnce(axis);
    }
}

function rotateMicroxelDataOnce(axis = '') {
    const size = voxelEditorSize;
    const rotatedMicroxels = createEmptyMicroxelGrid(size);

    for (let x = 0; x < size; x += 1) {
        for (let y = 0; y < size; y += 1) {
            for (let z = 0; z < size; z += 1) {
                const sourceMicroxel = readEditorMicroxel(x, y, z);
                if (!sourceMicroxel) continue;

                const targetCoord = rotateMicroxelCoordOnce(axis, x, y, z, size);
                rotatedMicroxels[targetCoord.x][targetCoord.y][targetCoord.z] = sourceMicroxel
                    .clone()
                    .setPosition(targetCoord.x, targetCoord.y, targetCoord.z);
            }
        }
    }

    editedVoxel.setMicroxels(rotatedMicroxels);
}

function rotateMicroxelCoordOnce(axis = '', x = 0, y = 0, z = 0, size = voxelEditorSize) {
    const maxIndex = size - 1;

    // These are pure 90º right-handed rotations around Three.js axes:
    // +X pitch: local North/front (-Z) points up (+Y).
    // +Y yaw: local North/front (-Z) turns left/west (-X).
    // +Z roll: local Up (+Y) turns left/west (-X).
    if (axis === 'x') {
        return {
            x,
            y: maxIndex - z,
            z: y
        };
    }

    if (axis === 'y') {
        return {
            x: maxIndex - z,
            y,
            z: x
        };
    }

    if (axis === 'z') {
        return {
            x: maxIndex - y,
            y: x,
            z
        };
    }

    return { x, y, z };
}

function getVoxelRotationEuler() {
    const rotation = editedVoxel.rotation || { x: 0, y: 0, z: 0 };

    // Pure Three.js Euler rotation, no VE2-specific axis remapping:
    // X = pitch, Y = yaw, Z = roll, using the fixed editor compass as reference.
    return tempVoxelRotationEuler.set(
        THREE.MathUtils.degToRad(normalizeRotationDegrees(rotation.x)),
        THREE.MathUtils.degToRad(normalizeRotationDegrees(rotation.y)),
        THREE.MathUtils.degToRad(normalizeRotationDegrees(rotation.z)),
        'XYZ'
    );
}

function syncVoxelModelRotation() {
    if (!voxelModelGroup) {
        return;
    }

    voxelModelGroup.position.set(0, getModelCenterY(), 0);
    voxelModelGroup.rotation.copy(getVoxelRotationEuler());
    voxelModelGroup.updateMatrixWorld(true);
}

function ensureOrientationNorthLabel() {
    if (orientationNorthLabel) {
        return orientationNorthLabel;
    }

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = 1024;
    canvas.height = 256;

    if (context) {
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.font = '900 132px monospace';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.lineWidth = 24;
        context.strokeStyle = 'rgba(0, 18, 80, 0.95)';
        context.fillStyle = '#0099ff';
        context.strokeText('North (-Z)', canvas.width * 0.5, canvas.height * 0.5);
        context.fillText('North (-Z)', canvas.width * 0.5, canvas.height * 0.5);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;

    const labelPlane = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 0.25),
        new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            side: THREE.DoubleSide,
            depthWrite: false
        })
    );
    labelPlane.rotation.x = -Math.PI * 0.5;

    orientationNorthLabel = new THREE.Group();
    orientationNorthLabel.add(labelPlane);
    scene.add(orientationNorthLabel);

    return orientationNorthLabel;
}

function updateOrientationNorthLabel() {
    const label = ensureOrientationNorthLabel();
    const labelDistance = voxelEditorSize * 0.5 + ORIENTATION_LABEL_DISTANCE_PADDING;
    const labelScale = Math.max(
        ORIENTATION_LABEL_MIN_SCALE,
        voxelEditorSize * ORIENTATION_LABEL_SCALE_PER_MICROXEL
    );

    // North is a fixed world/editor reference.
    // Runtime Rotate previews the model; export bakes it into microxel data.
    label.position.set(0, 0.035, -labelDistance);
    label.rotation.y = 0;
    label.scale.set(labelScale, labelScale, labelScale);
}

function syncMirrorGuides() {
    const mirrorCenter = (voxelEditorSize - 1) * 0.5 - modelCenterOffset;
    const mirrorCenterY = groundOffset + (voxelEditorSize - 1) * 0.5;
    const guideSpan = voxelEditorSize + 3;

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
        x >= 0 && x < voxelEditorSize
        && y >= 0 && y < voxelEditorSize
        && z >= 0 && z < voxelEditorSize
    );
}

function getInstanceIdFromCoord(x, y, z) {
    return x * voxelEditorSize * voxelEditorSize
        + y * voxelEditorSize
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
    return voxelEditorSize - 1 - value;
}

function applyToMicroxelCoordinates(coords, callback) {
    coords.forEach(coord => {
        const microxel = readEditorMicroxel(coord.x, coord.y, coord.z);
        if (!microxel) return;

        callback(microxel, coord);
        syncMicroxelVisual(getInstanceIdFromCoord(coord.x, coord.y, coord.z));
    });

    recordVoxelHistory();
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
    if (voxelModelGroup) {
        lineStartHighlight.rotation.copy(voxelModelGroup.rotation);
    }
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
    const previewPosition = new THREE.Vector3(
        coord.x - modelCenterOffset,
        coord.y - modelCenterOffset,
        coord.z - modelCenterOffset
    );

    if (!voxelModelGroup) {
        return previewPosition;
    }

    voxelModelGroup.updateMatrixWorld(true);
    return voxelModelGroup.localToWorld(previewPosition);
}

function renderLinePreviewHighlights(coords) {
    clearLinePreviewHighlights();

    if (!Array.isArray(coords) || coords.length < 2) {
        return;
    }

    coords.forEach(coord => {
        const previewVoxel = new THREE.Mesh(linePreviewGeometry, linePreviewMaterial);
        previewVoxel.position.copy(getPreviewWorldPosition(coord));
        if (voxelModelGroup) {
            previewVoxel.rotation.copy(voxelModelGroup.rotation);
        }
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



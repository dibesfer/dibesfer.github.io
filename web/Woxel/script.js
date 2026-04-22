import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

const sceneView = document.getElementById('sceneView');
const overlay = document.getElementById('overlay');
const playButton = document.getElementById('playButton');
const toggleLoadOptionsButton = document.getElementById('toggleLoadOptionsButton');
const loadModeTabs = Array.from(document.querySelectorAll('.load-mode-tab'));
const loadModePanels = Array.from(document.querySelectorAll('.load-mode-panel'));
const worldForm = document.getElementById('worldForm');
const worldUrlInput = document.getElementById('worldUrlInput');
const worldFileInput = document.getElementById('worldFileInput');
const worldTextInput = document.getElementById('worldTextInput');
const proceedLoadButton = document.getElementById('proceedLoadButton');
const statusLine = document.getElementById('statusLine');
const importPanel = document.getElementById('importPanel');

const worldRaycastTargets = [];
const worldVoxelEntriesByCell = new Map();
const worldDebugGroup = new THREE.Group();
const worldGroup = new THREE.Group();
const worldBounds = new THREE.Box3();
const worldOrigin = new THREE.Vector3();
const worldVoxelInstanceMatrix = new THREE.Matrix4();
const worldVoxelInstanceColor = new THREE.Color();
const tempCollisionBox = new THREE.Box3();
let worldVoxelGrid = null;

const PLAYER_RADIUS = 0.35;
const PLAYER_HEIGHT = 1.7;
const PLAYER_EYE_HEIGHT = 1.62;
const PLAYER_MOVE_SPEED = 5;
const PLAYER_JUMP_SPEED = 8.5;
const PLAYER_GRAVITY = 24;
const PLAYER_SUPPORT_EPSILON = 0.03;

const inputState = {
    keys: Object.create(null),
};
let currentLoadMode = 'file';

class Player {
    constructor(camera, controls) {
        this.camera = camera;
        this.controls = controls;
        this.position = new THREE.Vector3(0, PLAYER_EYE_HEIGHT, 4);
        this.velocity = new THREE.Vector3();
        this.onGround = false;
        this.jumpQueued = false;
        this.collider = new THREE.Box3();
    }

    queueJump() {
        this.jumpQueued = true;
    }

    setSpawn(position) {
        this.position.copy(position);
        this.velocity.set(0, 0, 0);
        this.onGround = false;
        this.jumpQueued = false;
        this.syncCamera();
        return this;
    }

    syncCamera() {
        this.camera.position.copy(this.position);
        this.updateCollider();
    }

    updateCollider() {
        this.collider.min.set(
            this.position.x - PLAYER_RADIUS,
            this.position.y - PLAYER_EYE_HEIGHT,
            this.position.z - PLAYER_RADIUS,
        );
        this.collider.max.set(
            this.position.x + PLAYER_RADIUS,
            this.position.y - PLAYER_EYE_HEIGHT + PLAYER_HEIGHT,
            this.position.z + PLAYER_RADIUS,
        );
        return this.collider;
    }
}

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xdbe7f3);
scene.fog = new THREE.FogExp2(0xdbe7f3, 0.02);

const camera = new THREE.PerspectiveCamera(
    80,
    window.innerWidth / window.innerHeight,
    0.05,
    1500,
);

const renderer = new THREE.WebGLRenderer({
    antialias: true,
    canvas: sceneView,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const controls = new PointerLockControls(camera, document.body);
scene.add(worldGroup);
scene.add(worldDebugGroup);

const player = new Player(camera, controls);
player.syncCamera();

const hemiLight = new THREE.HemisphereLight(0xf6fbff, 0x7a8a98, 1.4);
scene.add(hemiLight);

const sun = new THREE.DirectionalLight(0xffffff, 1.2);
sun.position.set(16, 28, 12);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 0.5;
sun.shadow.camera.far = 120;
sun.shadow.camera.left = -35;
sun.shadow.camera.right = 35;
sun.shadow.camera.top = 35;
sun.shadow.camera.bottom = -35;
scene.add(sun);
scene.add(sun.target);

const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(300, 300),
    new THREE.MeshStandardMaterial({
        color: 0xcbd9e6,
        roughness: 0.98,
        metalness: 0,
    }),
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

controls.addEventListener('lock', () => {
    overlay.classList.add('is-hidden');
    setStatus('Walking world...');
});

controls.addEventListener('unlock', () => {
    overlay.classList.remove('is-hidden');
    setStatus('Cursor unlocked.');
});

function setStatus(message) {
    statusLine.textContent = message;
}

function setImportPanelOpen(nextOpen) {
    importPanel.hidden = !nextOpen;
    toggleLoadOptionsButton.textContent = nextOpen ? 'Hide Load Options' : 'Load World';
}

function setLoadMode(nextMode) {
    const normalizedMode = ['file', 'text', 'url'].includes(nextMode) ? nextMode : 'file';
    currentLoadMode = normalizedMode;

    loadModeTabs.forEach(button => {
        button.classList.toggle('is-active', button.dataset.loadMode === normalizedMode);
    });

    loadModePanels.forEach(panel => {
        panel.hidden = panel.dataset.loadPanel !== normalizedMode;
    });

    if (normalizedMode === 'file') {
        proceedLoadButton.textContent = 'Proceed';
    } else if (normalizedMode === 'text') {
        proceedLoadButton.textContent = 'Proceed';
    } else {
        proceedLoadButton.textContent = 'Proceed';
    }
}

function buildDemoWorldData() {
    const voxels = [];

    for (let x = 0; x < 16; x += 1) {
        for (let z = 0; z < 16; z += 1) {
            voxels.push({
                position: { x, y: 0, z },
                voxel: {
                    name: 'floor',
                    color: '#7ea56b',
                    type: 'colored',
                    active: true,
                },
            });
        }
    }

    for (let y = 1; y < 4; y += 1) {
        voxels.push({
            position: { x: 4, y, z: 4 },
            voxel: {
                name: 'pillar',
                color: '#8d6947',
                type: 'colored',
                active: true,
            },
        });
    }

    return {
        name: 'Demo World',
        size: { x: 32, y: 16, z: 32 },
        spawnPosition: { x: 8, y: 2, z: 12 },
        voxels,
    };
}

function resolveWorldVoxelEntries(worldData) {
    return Array.isArray(worldData?.voxels) ? worldData.voxels : [];
}

function getWorldOrigin(worldData) {
    const size = worldData?.size ?? { x: 0, y: 0, z: 0 };
    return new THREE.Vector3(
        -(Number(size.x) || 0) * 0.5,
        0,
        -(Number(size.z) || 0) * 0.5,
    );
}

function gridToWorldPosition(x = 0, y = 0, z = 0) {
    return new THREE.Vector3(
        worldOrigin.x + x,
        y,
        worldOrigin.z + z,
    );
}

function gridToWorldCenterPosition(x = 0, y = 0, z = 0) {
    return new THREE.Vector3(
        worldOrigin.x + x + 0.5,
        y + 0.5,
        worldOrigin.z + z + 0.5,
    );
}

function setBoxFromCell(cellX, cellY, cellZ, targetBox = new THREE.Box3()) {
    const min = gridToWorldPosition(cellX, cellY, cellZ);
    targetBox.min.copy(min);
    targetBox.max.set(min.x + 1, min.y + 1, min.z + 1);
    return targetBox;
}

function clearWorldScene() {
    while (worldGroup.children.length > 0) {
        const child = worldGroup.children.pop();
        if (!child) continue;
        worldGroup.remove(child);
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
    }

    worldRaycastTargets.length = 0;
    worldVoxelEntriesByCell.clear();
    worldBounds.makeEmpty();
    worldVoxelGrid = null;
}

function buildWorldScene(worldData) {
    clearWorldScene();

    const voxelEntries = resolveWorldVoxelEntries(worldData);
    worldOrigin.copy(getWorldOrigin(worldData));
    const worldSize = worldData?.size ?? { x: 0, y: 0, z: 0 };

    worldBounds.min.set(
        worldOrigin.x,
        0,
        worldOrigin.z,
    );
    worldBounds.max.set(
        worldOrigin.x + Math.max(Number(worldSize.x) || 0, 1),
        Math.max(Number(worldSize.y) || 0, 1),
        worldOrigin.z + Math.max(Number(worldSize.z) || 0, 1),
    );

    for (let i = 0; i < voxelEntries.length; i += 1) {
        const entry = voxelEntries[i];
        const position = entry?.position ?? {};
        const voxel = entry?.voxel ?? {};
        const active = voxel?.active !== false;
        if (!active) continue;

        const cellX = Number(position.x) || 0;
        const cellY = Number(position.y) || 0;
        const cellZ = Number(position.z) || 0;
        const cellKey = createWorldCellKey(cellX, cellY, cellZ);
        const normalizedColor = typeof voxel?.color === 'string' && voxel.color.trim()
            ? voxel.color.trim()
            : '#8fb3cc';

        worldVoxelEntriesByCell.set(cellKey, {
            cellX,
            cellY,
            cellZ,
            voxel: {
                ...voxel,
                color: normalizedColor,
            },
        });
    }

    const renderVoxelEntries = [];
    for (const entry of worldVoxelEntriesByCell.values()) {
        if (!isVoxelExposed(entry.cellX, entry.cellY, entry.cellZ)) {
            continue;
        }

        renderVoxelEntries.push({
            cellX: entry.cellX,
            cellY: entry.cellY,
            cellZ: entry.cellZ,
            color: entry.voxel.color,
        });
    }

    if (renderVoxelEntries.length > 0) {
        const voxelGeometry = new THREE.BoxGeometry(1, 1, 1);
        const voxelMaterial = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            roughness: 0.94,
            metalness: 0,
        });
        const voxelGrid = new THREE.InstancedMesh(voxelGeometry, voxelMaterial, renderVoxelEntries.length);
        voxelGrid.receiveShadow = true;
        voxelGrid.castShadow = false;
        voxelGrid.count = renderVoxelEntries.length;

        for (let i = 0; i < renderVoxelEntries.length; i += 1) {
            const entry = renderVoxelEntries[i];
            const center = gridToWorldCenterPosition(entry.cellX, entry.cellY, entry.cellZ);
            worldVoxelInstanceMatrix.makeTranslation(center.x, center.y, center.z);
            voxelGrid.setMatrixAt(i, worldVoxelInstanceMatrix);
            voxelGrid.setColorAt(i, worldVoxelInstanceColor.set(entry.color));
        }

        voxelGrid.instanceMatrix.needsUpdate = true;
        if (voxelGrid.instanceColor) {
            voxelGrid.instanceColor.needsUpdate = true;
        }

        worldGroup.add(voxelGrid);
        worldRaycastTargets.push(voxelGrid);
        worldVoxelGrid = voxelGrid;
    }

    const spawn = worldData?.spawnPosition ?? { x: 0, y: 2, z: 0 };
    const spawnBase = new THREE.Vector3(
        Number(spawn.x) || 0,
        Number(spawn.y) || 0,
        Number(spawn.z) || 0,
    );
    const spawnPosition = new THREE.Vector3(spawnBase.x, spawnBase.y + PLAYER_EYE_HEIGHT, spawnBase.z);
    player.setSpawn(spawnPosition);
    setStatus(`Loaded ${worldData?.name || 'World'} with ${worldVoxelEntriesByCell.size} voxels.`);
}

async function loadWorldFromUrl(worldUrl) {
    const response = await fetch(worldUrl);
    if (!response.ok) {
        throw new Error(`Could not load world from ${worldUrl}`);
    }

    return response.json();
}

async function loadWorldFromFile(file) {
    if (!file) {
        throw new Error('Choose a .world file first.');
    }

    return JSON.parse(await file.text());
}

function loadWorldFromText(worldText) {
    const trimmedWorldText = typeof worldText === 'string' ? worldText.trim() : '';
    if (!trimmedWorldText) {
        throw new Error('Paste world JSON first.');
    }

    return JSON.parse(trimmedWorldText);
}

async function startWorld({ worldUrl = '', worldData = null } = {}) {
    try {
        setStatus(worldData ? 'Loading world data...' : (worldUrl ? 'Loading world...' : 'Loading demo world...'));
        const resolvedWorldData = worldData ?? (
            worldUrl
            ? await loadWorldFromUrl(worldUrl)
            : buildDemoWorldData()
        );
        buildWorldScene(resolvedWorldData);

        if (worldUrl) {
            const pageUrl = new URL(window.location.href);
            pageUrl.searchParams.set('world', worldUrl);
            window.history.replaceState({}, '', pageUrl);
        } else if (worldData) {
            const pageUrl = new URL(window.location.href);
            pageUrl.searchParams.delete('world');
            window.history.replaceState({}, '', pageUrl);
        }

        controls.lock();
    } catch (error) {
        console.error(error);
        setStatus(String(error?.message || 'Failed to load world.'));
        overlay.classList.remove('is-hidden');
    }
}

function resolveWishDirection() {
    const direction = new THREE.Vector3();

    if (inputState.keys.KeyW) direction.z += 1;
    if (inputState.keys.KeyS) direction.z -= 1;
    if (inputState.keys.KeyA) direction.x -= 1;
    if (inputState.keys.KeyD) direction.x += 1;

    if (direction.lengthSq() > 0) {
        direction.normalize();
    }

    return direction;
}

function getCameraPlanarVectors() {
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0;
    if (forward.lengthSq() > 0) {
        forward.normalize();
    }

    const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0));
    return { forward, right };
}

function createWorldCellKey(cellX, cellY, cellZ) {
    return `${cellX}|${cellY}|${cellZ}`;
}

function hasVoxelAtCell(cellX, cellY, cellZ) {
    return worldVoxelEntriesByCell.has(createWorldCellKey(cellX, cellY, cellZ));
}

function isVoxelExposed(cellX, cellY, cellZ) {
    return (
        !hasVoxelAtCell(cellX + 1, cellY, cellZ)
        || !hasVoxelAtCell(cellX - 1, cellY, cellZ)
        || !hasVoxelAtCell(cellX, cellY + 1, cellZ)
        || !hasVoxelAtCell(cellX, cellY - 1, cellZ)
        || !hasVoxelAtCell(cellX, cellY, cellZ + 1)
        || !hasVoxelAtCell(cellX, cellY, cellZ - 1)
    );
}

function worldPositionToGridPosition(position) {
    return {
        x: position.x - worldOrigin.x,
        y: position.y,
        z: position.z - worldOrigin.z,
    };
}

function getColliderCellRange(box, cellPadding = 0) {
    const minGridPosition = worldPositionToGridPosition(box.min);
    const maxGridPosition = worldPositionToGridPosition(box.max);

    return {
        minCellX: Math.floor(minGridPosition.x) - cellPadding,
        maxCellX: Math.ceil(maxGridPosition.x) - 1 + cellPadding,
        minCellY: Math.floor(minGridPosition.y) - cellPadding,
        maxCellY: Math.ceil(maxGridPosition.y) - 1 + cellPadding,
        minCellZ: Math.floor(minGridPosition.z) - cellPadding,
        maxCellZ: Math.ceil(maxGridPosition.z) - 1 + cellPadding,
    };
}

function forEachNearbyCollisionBox(box, callback, cellPadding = 0) {
    const {
        minCellX,
        maxCellX,
        minCellY,
        maxCellY,
        minCellZ,
        maxCellZ,
    } = getColliderCellRange(box, cellPadding);

    for (let cellY = minCellY; cellY <= maxCellY; cellY += 1) {
        for (let cellX = minCellX; cellX <= maxCellX; cellX += 1) {
            for (let cellZ = minCellZ; cellZ <= maxCellZ; cellZ += 1) {
                if (!hasVoxelAtCell(cellX, cellY, cellZ)) {
                    continue;
                }

                if (callback(setBoxFromCell(cellX, cellY, cellZ, tempCollisionBox)) === true) {
                    return true;
                }
            }
        }
    }

    return false;
}

function boxesOverlapOnAxes(a, b, axes) {
    for (let i = 0; i < axes.length; i += 1) {
        const axis = axes[i];
        if (a.max[axis] <= b.min[axis] || a.min[axis] >= b.max[axis]) {
            return false;
        }
    }

    return true;
}

function getRemainingAxes(axis) {
    if (axis === 'x') return ['y', 'z'];
    if (axis === 'y') return ['x', 'z'];
    return ['x', 'y'];
}

function resolveWorldBoundsDelta(axis, delta, collider) {
    if (worldBounds.isEmpty()) {
        return delta;
    }

    if (axis === 'y') {
        return delta;
    }

    let resolvedDelta = delta;

    if (resolvedDelta > 0) {
        resolvedDelta = Math.min(resolvedDelta, worldBounds.max[axis] - collider.max[axis]);
    } else if (resolvedDelta < 0) {
        resolvedDelta = Math.max(resolvedDelta, worldBounds.min[axis] - collider.min[axis]);
    }

    return resolvedDelta;
}

function movePlayerAxis(axis, delta) {
    if (delta === 0) return 0;

    const collider = player.updateCollider().clone();
    const remainingAxes = getRemainingAxes(axis);
    let resolvedDelta = resolveWorldBoundsDelta(axis, delta, collider);
    const nextCollider = collider.clone();
    nextCollider.min[axis] += resolvedDelta;
    nextCollider.max[axis] += resolvedDelta;
    const sweepCollider = collider.clone().union(nextCollider);

    forEachNearbyCollisionBox(sweepCollider, blockingBox => {
        if (!boxesOverlapOnAxes(nextCollider, blockingBox, remainingAxes)) {
            return false;
        }

        if (resolvedDelta > 0 && collider.max[axis] <= blockingBox.min[axis]) {
            resolvedDelta = Math.min(resolvedDelta, blockingBox.min[axis] - collider.max[axis]);
            nextCollider.min[axis] = collider.min[axis] + resolvedDelta;
            nextCollider.max[axis] = collider.max[axis] + resolvedDelta;
        } else if (resolvedDelta < 0 && collider.min[axis] >= blockingBox.max[axis]) {
            resolvedDelta = Math.max(resolvedDelta, blockingBox.max[axis] - collider.min[axis]);
            nextCollider.min[axis] = collider.min[axis] + resolvedDelta;
            nextCollider.max[axis] = collider.max[axis] + resolvedDelta;
        }
        return false;
    }, 1);

    if (resolvedDelta === 0) {
        return 0;
    }

    player.position[axis] += resolvedDelta;
    player.updateCollider();
    return resolvedDelta;
}

function hasGroundSupport() {
    const supportCollider = player.collider.clone();
    supportCollider.min.y -= PLAYER_SUPPORT_EPSILON;
    supportCollider.max.y -= PLAYER_SUPPORT_EPSILON;

    return forEachNearbyCollisionBox(
        supportCollider,
        collisionBox => supportCollider.intersectsBox(collisionBox),
        1,
    );
}

function resolveVerticalMotion(deltaTime) {
    if (player.onGround && player.jumpQueued) {
        player.velocity.y = PLAYER_JUMP_SPEED;
        player.onGround = false;
    } else {
        player.velocity.y -= PLAYER_GRAVITY * deltaTime;
    }

    player.jumpQueued = false;

    const intendedDelta = player.velocity.y * deltaTime;
    const resolvedDelta = movePlayerAxis('y', intendedDelta);
    const hitSurface = Math.abs(intendedDelta - resolvedDelta) > 1e-6;

    if (hitSurface) {
        player.onGround = intendedDelta < 0;
        player.velocity.y = 0;
        return;
    }

    player.onGround = hasGroundSupport();
    if (player.onGround && player.velocity.y < 0) {
        player.velocity.y = 0;
    }
}

function updatePlayer(deltaTime) {
    if (!controls.isLocked) return;

    const direction = resolveWishDirection();
    const { forward, right } = getCameraPlanarVectors();
    const horizontalVelocity = new THREE.Vector3();
    horizontalVelocity.addScaledVector(forward, direction.z * PLAYER_MOVE_SPEED * deltaTime);
    horizontalVelocity.addScaledVector(right, direction.x * PLAYER_MOVE_SPEED * deltaTime);

    movePlayerAxis('x', horizontalVelocity.x);
    movePlayerAxis('z', horizontalVelocity.z);
    resolveVerticalMotion(deltaTime);
    player.syncCamera();
}

function onResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
}

document.addEventListener('keydown', event => {
    inputState.keys[event.code] = true;
    if (event.code === 'Space') {
        if (!event.repeat) {
            player.queueJump();
        }
        event.preventDefault();
    }
});

document.addEventListener('keyup', event => {
    inputState.keys[event.code] = false;
});

playButton.addEventListener('click', () => {
    startWorld({
        worldUrl: worldUrlInput.value.trim(),
    });
});

toggleLoadOptionsButton.addEventListener('click', () => {
    setImportPanelOpen(importPanel.hidden);
});

worldForm.addEventListener('submit', event => {
    event.preventDefault();
    (async () => {
        try {
            if (currentLoadMode === 'file') {
                const worldData = await loadWorldFromFile(worldFileInput.files?.[0] ?? null);
                await startWorld({ worldData });
                worldFileInput.value = '';
                return;
            }

            if (currentLoadMode === 'text') {
                const worldData = loadWorldFromText(worldTextInput.value);
                await startWorld({ worldData });
                return;
            }

            await startWorld({
                worldUrl: worldUrlInput.value.trim(),
            });
        } catch (error) {
            console.error(error);
            setStatus(String(error?.message || 'Failed to load world.'));
            overlay.classList.remove('is-hidden');
        }
    })();
});

loadModeTabs.forEach(button => {
    button.addEventListener('click', () => {
        setLoadMode(button.dataset.loadMode);
    });
});

window.addEventListener('resize', onResize);

const initialWorldUrl = new URL(window.location.href).searchParams.get('world') || '';
if (initialWorldUrl) {
    worldUrlInput.value = initialWorldUrl;
    setImportPanelOpen(true);
    setLoadMode('url');
} else {
    setImportPanelOpen(false);
    setLoadMode('file');
}

const clock = new THREE.Clock();

renderer.setAnimationLoop(() => {
    const deltaTime = Math.min(clock.getDelta(), 0.05);
    updatePlayer(deltaTime);
    renderer.render(scene, camera);
});

if (initialWorldUrl) {
    startWorld({ worldUrl: initialWorldUrl });
} else {
    setStatus('Ready for a world URL or demo play.');
}

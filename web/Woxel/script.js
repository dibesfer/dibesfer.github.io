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
const worldCollisionBoxes = [];
const worldDebugGroup = new THREE.Group();
const worldGroup = new THREE.Group();
const worldVoxelMaterialCache = new Map();

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

function getVoxelMaterial(color) {
    const normalizedColor = typeof color === 'string' && color.trim() ? color.trim() : '#8fb3cc';
    if (worldVoxelMaterialCache.has(normalizedColor)) {
        return worldVoxelMaterialCache.get(normalizedColor);
    }

    const material = new THREE.MeshStandardMaterial({
        color: normalizedColor,
        roughness: 0.94,
        metalness: 0,
    });
    worldVoxelMaterialCache.set(normalizedColor, material);
    return material;
}

function clearWorldScene() {
    while (worldGroup.children.length > 0) {
        const child = worldGroup.children.pop();
        if (!child) continue;
        worldGroup.remove(child);
        if (child.geometry) child.geometry.dispose();
    }

    worldRaycastTargets.length = 0;
    worldCollisionBoxes.length = 0;
}

function buildWorldScene(worldData) {
    clearWorldScene();

    const voxelEntries = resolveWorldVoxelEntries(worldData);
    const worldOrigin = getWorldOrigin(worldData);
    const voxelGeometry = new THREE.BoxGeometry(1, 1, 1);

    for (let i = 0; i < voxelEntries.length; i += 1) {
        const entry = voxelEntries[i];
        const position = entry?.position ?? {};
        const voxel = entry?.voxel ?? {};
        const active = voxel?.active !== false;
        if (!active) continue;

        const mapX = worldOrigin.x + (Number(position.x) || 0) + 0.5;
        const mapY = (Number(position.y) || 0) + 0.5;
        const mapZ = worldOrigin.z + (Number(position.z) || 0) + 0.5;

        const mesh = new THREE.Mesh(voxelGeometry.clone(), getVoxelMaterial(voxel?.color));
        mesh.position.set(mapX, mapY, mapZ);
        mesh.castShadow = false;
        mesh.receiveShadow = true;
        worldGroup.add(mesh);
        worldRaycastTargets.push(mesh);

        const box = new THREE.Box3(
            new THREE.Vector3(mapX - 0.5, mapY - 0.5, mapZ - 0.5),
            new THREE.Vector3(mapX + 0.5, mapY + 0.5, mapZ + 0.5),
        );
        worldCollisionBoxes.push(box);
    }

    const spawn = worldData?.spawnPosition ?? { x: 0, y: 2, z: 0 };
    const spawnPosition = new THREE.Vector3(
        worldOrigin.x + (Number(spawn.x) || 0) + 0.5,
        (Number(spawn.y) || 0) + 0.1 + PLAYER_EYE_HEIGHT,
        worldOrigin.z + (Number(spawn.z) || 0) + 0.5,
    );
    player.setSpawn(spawnPosition);
    setStatus(`Loaded ${worldData?.name || 'World'} with ${worldCollisionBoxes.length} voxels.`);
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

    if (inputState.keys.KeyW) direction.z -= 1;
    if (inputState.keys.KeyS) direction.z += 1;
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

    const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).negate();
    return { forward, right };
}

function movePlayerAxis(axis, delta) {
    if (delta === 0) return;

    const nextPosition = player.position.clone();
    nextPosition[axis] += delta;
    const nextCollider = player.updateCollider().clone();
    nextCollider.min[axis] += delta;
    nextCollider.max[axis] += delta;

    for (let i = 0; i < worldCollisionBoxes.length; i += 1) {
        if (nextCollider.intersectsBox(worldCollisionBoxes[i])) {
            return;
        }
    }

    player.position.copy(nextPosition);
    player.updateCollider();
}

function resolveVerticalMotion(deltaTime) {
    player.velocity.y -= PLAYER_GRAVITY * deltaTime;

    if (player.onGround && player.jumpQueued) {
        player.velocity.y = PLAYER_JUMP_SPEED;
        player.onGround = false;
    }

    player.jumpQueued = false;
    movePlayerAxis('y', player.velocity.y * deltaTime);
    player.onGround = false;

    const supportCollider = player.collider.clone();
    supportCollider.min.y -= PLAYER_SUPPORT_EPSILON;
    supportCollider.max.y -= PLAYER_SUPPORT_EPSILON;

    for (let i = 0; i < worldCollisionBoxes.length; i += 1) {
        const blockingBox = worldCollisionBoxes[i];
        if (!player.collider.intersectsBox(blockingBox) && !supportCollider.intersectsBox(blockingBox)) {
            continue;
        }

        if (player.velocity.y <= 0 && player.collider.min.y >= blockingBox.max.y - 0.3) {
            const groundedEyeY = blockingBox.max.y + PLAYER_EYE_HEIGHT;
            player.position.y = groundedEyeY;
            player.velocity.y = 0;
            player.onGround = true;
            player.updateCollider();
            return;
        }

        if (player.velocity.y > 0 && player.collider.max.y <= blockingBox.min.y + 0.3) {
            player.position.y = blockingBox.min.y - (PLAYER_HEIGHT - PLAYER_EYE_HEIGHT);
            player.velocity.y = 0;
            player.updateCollider();
            return;
        }
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

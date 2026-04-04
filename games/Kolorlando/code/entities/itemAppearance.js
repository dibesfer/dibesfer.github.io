import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const gltfLoader = new GLTFLoader();

function setShadow(mesh, castShadow, receiveShadow) {
  mesh.castShadow = castShadow;
  mesh.receiveShadow = receiveShadow;
}

function applyShadows(root, castShadow, receiveShadow) {
  root.traverse(part => {
    if (!part.isMesh) return;
    setShadow(part, castShadow, receiveShadow);
  });
}

function measureModelHeight(root) {
  root.updateWorldMatrix(true, true);
  const bounds = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  bounds.getSize(size);
  return size.y;
}

function centerModelOnBounds(root, { x = false, y = false, z = false } = {}) {
  root.updateWorldMatrix(true, true);
  const bounds = new THREE.Box3().setFromObject(root);
  const center = new THREE.Vector3();
  bounds.getCenter(center);
  if (x) root.position.x -= center.x;
  if (y) root.position.y -= center.y;
  if (z) root.position.z -= center.z;
  root.updateWorldMatrix(true, true);
}

const DEFAULT_RAYCAST_SPHERE_RADIUS = 0.9;
const DEFAULT_ITEM_PLACEMENT_HEIGHT = 1;
const GOXEL_MODEL_SCALE = 0.1;
const boxelSelectionToolTextureLoader = new THREE.TextureLoader();
const coinIconTextureLoader = new THREE.TextureLoader();

function createDefaultItemModel({
  color = 0xffcf4a,
  accentColor = 0x7ae0ff,
  castShadow = true,
  receiveShadow = false,
} = {}) {
  const root = new THREE.Group();

  const bodyMaterial = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.28,
    metalness: 0.2,
    emissive: new THREE.Color(color).multiplyScalar(0.08),
  });
  const accentMaterial = new THREE.MeshStandardMaterial({
    color: accentColor,
    roughness: 0.18,
    metalness: 0.3,
    emissive: new THREE.Color(accentColor).multiplyScalar(0.18),
  });

  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.34, 0), bodyMaterial);
  setShadow(core, castShadow, receiveShadow);
  root.add(core);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.36, 0.055, 12, 32),
    accentMaterial
  );
  ring.rotation.x = Math.PI * 0.5;
  setShadow(ring, castShadow, receiveShadow);
  root.add(ring);

  const topShard = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.28, 5), accentMaterial);
  topShard.position.y = 0.4;
  setShadow(topShard, castShadow, receiveShadow);
  root.add(topShard);

  const bottomShard = topShard.clone();
  bottomShard.position.y = -0.4;
  bottomShard.rotation.z = Math.PI;
  root.add(bottomShard);

  return {
    root,
    height: measureModelHeight(root),
  };
}

function createLoadingPlaceholder({ castShadow = true, receiveShadow = false } = {}) {
  return createDefaultItemModel({
    color: 0x8bff75,
    accentColor: 0xffffff,
    castShadow,
    receiveShadow,
  });
}

function createCoinItemModel({ castShadow = true, receiveShadow = false } = {}) {
  const root = new THREE.Group();

  // The coin uses a flattened cylinder as the main silhouette so it reads clearly
  // as a classic collectible coin even from a distance and while rotating in place.
  const coinMaterial = new THREE.MeshStandardMaterial({
    color: 0xd6a523,
    roughness: 0.22,
    metalness: 0.92,
    emissive: new THREE.Color(0xd6a523).multiplyScalar(0.08),
  });
  const rimMaterial = new THREE.MeshStandardMaterial({
    color: 0xffd766,
    roughness: 0.16,
    metalness: 1,
    emissive: new THREE.Color(0xffd766).multiplyScalar(0.12),
  });

  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.34, 0.34, 0.08, 36),
    coinMaterial
  );
  body.rotation.z = Math.PI * 0.5;
  setShadow(body, castShadow, receiveShadow);
  root.add(body);

  // Front and back faces add a subtle embossed look so the item feels metallic
  // and less like a plain primitive once lighting hits it in the world.
  const faceGeometry = new THREE.CylinderGeometry(0.26, 0.26, 0.02, 24);
  const frontFace = new THREE.Mesh(faceGeometry, rimMaterial);
  frontFace.rotation.z = Math.PI * 0.5;
  frontFace.position.x = 0.025;
  setShadow(frontFace, castShadow, receiveShadow);
  root.add(frontFace);

  const backFace = frontFace.clone();
  backFace.position.x = -0.025;
  root.add(backFace);

  const groove = new THREE.Mesh(
    new THREE.TorusGeometry(0.24, 0.02, 10, 30),
    rimMaterial
  );
  groove.rotation.y = Math.PI * 0.5;
  setShadow(groove, castShadow, receiveShadow);
  root.add(groove);

  /* The collectible now uses the authored KoloraMonero mark as a printed coin
  face detail so the pickup reads as in-world currency instead of a generic
  gold token. A dedicated texture loader keeps the icon reusable if more coin
  variants or UI previews are added later. */
  const coinIconTexture = coinIconTextureLoader.load('assets/icons/KoloraMonero.png');
  coinIconTexture.colorSpace = THREE.SRGBColorSpace;

  /* A transparent standard material lets the symbol respond to scene lights
  like the rest of the coin while still respecting the PNG alpha cutout and
  the requested semi-transparent printed look. */
  const coinIconMaterial = new THREE.MeshStandardMaterial({
    map: coinIconTexture,
    transparent: true,
    opacity: 0.75,
    alphaTest: 0.05,
    roughness: 0.38,
    metalness: 0.2,
    depthWrite: false,
  });

  /* The front print floats a hair above the embossed metal face to avoid
  z-fighting shimmer while still reading as ink or stamped paint on the coin. */
  const frontIcon = new THREE.Mesh(
    new THREE.PlaneGeometry(0.5, 0.5),
    coinIconMaterial
  );
  frontIcon.position.x = 0.051;
  frontIcon.rotation.y = Math.PI * 0.5;
  setShadow(frontIcon, castShadow, receiveShadow);
  root.add(frontIcon);

  /* The back print uses a second plane facing the opposite direction so the
  symbol stays readable from behind instead of appearing mirrored through a
  single double-sided plane. */
  const backIcon = new THREE.Mesh(
    new THREE.PlaneGeometry(0.5, 0.5),
    coinIconMaterial.clone()
  );
  backIcon.position.x = -0.051;
  backIcon.rotation.y = -Math.PI * 0.5;
  setShadow(backIcon, castShadow, receiveShadow);
  root.add(backIcon);

  return {
    root,
    height: measureModelHeight(root),
  };
}

function createBoxelSelectionToolItemModel({
  castShadow = true,
  receiveShadow = false,
  iconUrl = 'assets/icons/Asymmetrical_symbol_of_Chaos.png',
} = {}) {
  const root = new THREE.Group();

  /* The tool should read like a flat magical sigil pickup rather than a
  generic crystal, so it uses a thin double-sided plane with the authored
  chaos-symbol icon and a subtle backing plate for depth and readability. */
  const plate = new THREE.Mesh(
    new THREE.CylinderGeometry(0.42, 0.42, 0.04, 24),
    new THREE.MeshStandardMaterial({
      color: 0x101010,
      roughness: 0.34,
      metalness: 0.58,
      emissive: new THREE.Color(0x1b1b1b),
    })
  );
  plate.rotation.z = Math.PI * 0.5;
  setShadow(plate, castShadow, receiveShadow);
  root.add(plate);

  const iconTexture = boxelSelectionToolTextureLoader.load(iconUrl);
  iconTexture.colorSpace = THREE.SRGBColorSpace;

  const sigilMaterial = new THREE.MeshBasicMaterial({
    map: iconTexture,
    transparent: true,
    alphaTest: 0.08,
  });
  const sigilPlaneFront = new THREE.Mesh(
    new THREE.PlaneGeometry(0.9, 0.9),
    sigilMaterial
  );
  sigilPlaneFront.position.x = 0.03;
  sigilPlaneFront.rotation.y = Math.PI * 0.5;
  setShadow(sigilPlaneFront, castShadow, receiveShadow);
  root.add(sigilPlaneFront);

  /* A second plane facing the opposite direction keeps the icon readable from
  both sides instead of relying on a double-sided material that would mirror
  the symbol when viewed from behind. */
  const sigilPlaneBack = new THREE.Mesh(
    new THREE.PlaneGeometry(0.9, 0.9),
    sigilMaterial.clone()
  );
  sigilPlaneBack.position.x = -0.03;
  sigilPlaneBack.rotation.y = -Math.PI * 0.5;
  setShadow(sigilPlaneBack, castShadow, receiveShadow);
  root.add(sigilPlaneBack);

  const halo = new THREE.Mesh(
    new THREE.TorusGeometry(0.38, 0.03, 10, 28),
    new THREE.MeshStandardMaterial({
      color: 0xd4b4ff,
      roughness: 0.18,
      metalness: 0.2,
      emissive: new THREE.Color(0x6e39a8).multiplyScalar(0.45),
    })
  );
  halo.rotation.y = Math.PI * 0.5;
  setShadow(halo, castShadow, receiveShadow);
  root.add(halo);

  return {
    root,
    height: measureModelHeight(root),
  };
}

export class ItemAppearance {
  constructor({
    scene,
    position,
    label = 'Item',
    inventoryType = null,
    pickable = false,
    model = null,
    modelUrl = null,
    modelRotation = null,
    groundY = 0,
    floatHeight = 0.5,
    rotationSpeed = 0.55,
    castShadow = true,
    receiveShadow = false,
    raycastSphereRadius = DEFAULT_RAYCAST_SPHERE_RADIUS,
    modelScale = 1,
    placementHeight = DEFAULT_ITEM_PLACEMENT_HEIGHT,
    centerModel = false,
  }) {
    this.scene = scene;
    this.position = position.clone();
    this.label = label;
    this.inventoryType = inventoryType ?? label;
    this.pickable = pickable;
    this.collected = false;
    this.groundY = groundY;
    this.floatHeight = floatHeight;
    this.rotationSpeed = rotationSpeed;
    this.modelHeight = 0;
    this.modelRotation = modelRotation;
    this.castShadow = castShadow;
    this.receiveShadow = receiveShadow;
    this.raycastSphereRadius = raycastSphereRadius;
    this.modelScale = modelScale;
    this.placementHeight = placementHeight;
    this.centerModel = centerModel;

    const resolvedModel = model ?? (modelUrl
      ? createLoadingPlaceholder({ castShadow, receiveShadow })
      : createDefaultItemModel({ castShadow, receiveShadow }));

    this.model = resolvedModel;
    this.group = new THREE.Group();
    this.group.position.copy(this.position);
    this.raycastSphere = new THREE.Sphere(this.position.clone(), 0);
    this.scene.add(this.group);

    this.setModel(resolvedModel);

    if (modelUrl) {
      this.loadModelFromUrl(modelUrl);
    }
  }

  setModel(modelDefinition) {
    if (!modelDefinition?.root) return;

    this.group.clear();
    this.model = modelDefinition;
    this.group.add(modelDefinition.root);
    this.modelHeight = modelDefinition.height ?? 0;

    if (this.modelRotation) {
      modelDefinition.root.rotation.copy(this.modelRotation);
      modelDefinition.root.updateWorldMatrix(true, true);
      this.modelHeight = measureModelHeight(modelDefinition.root);
    }

    this.syncPosition();
  }

  syncPosition() {
    this.group.position.copy(this.position);
    const placementHeight = this.placementHeight > 0 ? this.placementHeight : this.modelHeight;
    this.group.position.y = this.groundY + this.floatHeight + placementHeight * 0.5;
    this.raycastSphere.center.copy(this.group.position);
    this.raycastSphere.radius = this.collected ? 0 : this.raycastSphereRadius;
  }

  loadModelFromUrl(modelUrl) {
    //console.info('Loading item appearance model', modelUrl);
    gltfLoader.load(
      modelUrl,
      gltf => {
        const root = gltf.scene ?? gltf.scenes?.[0];
        if (!root) {
          console.error('Failed to load item appearance model', modelUrl, new Error('Loaded GLTF did not contain a scene root.'));
          return;
        }

        if (this.modelScale !== 1) {
          root.scale.multiplyScalar(this.modelScale);
          root.updateWorldMatrix(true, true);
        }

        if (this.centerModel) {
          centerModelOnBounds(root, { x: true, y: true, z: true });
        }

        const height = measureModelHeight(root);

        applyShadows(root, this.castShadow, this.receiveShadow);
        this.setModel({ root, height });
        //console.info('Loaded item appearance model', modelUrl);
      },
      undefined,
      error => {
        console.error('Failed to load item appearance model', modelUrl, error);
      }
    );
  }

  update(deltaTime) {
    if (this.collected) return;
    this.group.rotation.y += this.rotationSpeed * deltaTime;
  }

  collect() {
    if (this.collected) return;

    // Removing the rendered model and shrinking the interaction sphere makes the pickup
    // immediately disappear from the world while keeping the object instance reusable.
    this.collected = true;
    this.group.visible = false;
    this.raycastSphere.radius = 0;
  }
}


export class GoxelItemAppearance extends ItemAppearance {
  constructor(options) {
    super({
      ...options,
      modelScale: GOXEL_MODEL_SCALE,
      centerModel: true,
    });
  }
}

export class CoinItemAppearance extends ItemAppearance {
  constructor(options) {
    super({
      ...options,
      model: createCoinItemModel({
        castShadow: options?.castShadow,
        receiveShadow: options?.receiveShadow,
      }),
      raycastSphereRadius: options?.raycastSphereRadius ?? 0.7,
      placementHeight: options?.placementHeight ?? 0.7,
      floatHeight: options?.floatHeight ?? 0.45,
      rotationSpeed: options?.rotationSpeed ?? 1.8,
    });
  }
}

export class BoxelSelectionToolItemAppearance extends ItemAppearance {
  constructor(options) {
    super({
      ...options,
      model: createBoxelSelectionToolItemModel({
        castShadow: options?.castShadow,
        receiveShadow: options?.receiveShadow,
        iconUrl: options?.iconUrl,
      }),
      raycastSphereRadius: options?.raycastSphereRadius ?? 0.72,
      placementHeight: options?.placementHeight ?? 0.9,
      floatHeight: options?.floatHeight ?? 0.5,
      rotationSpeed: options?.rotationSpeed ?? 1.15,
    });
  }
}

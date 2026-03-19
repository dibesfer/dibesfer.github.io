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

function normalizeModelHeight(root, targetHeight) {
  if (!(targetHeight > 0)) {
    return measureModelHeight(root);
  }

  const currentHeight = measureModelHeight(root);
  if (!(currentHeight > 0)) return 0;

  const scale = targetHeight / currentHeight;
  root.scale.multiplyScalar(scale);
  root.updateWorldMatrix(true, true);
  return measureModelHeight(root);
}

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

export class ItemAppearance {
  constructor({
    scene,
    position,
    model = null,
    modelUrl = null,
    modelTargetHeight = null,
    modelRotation = null,
    groundY = 0,
    floatHeight = 0.5,
    rotationSpeed = 0.55,
    castShadow = true,
    receiveShadow = false,
  }) {
    this.scene = scene;
    this.position = position.clone();
    this.groundY = groundY;
    this.floatHeight = floatHeight;
    this.rotationSpeed = rotationSpeed;
    this.modelHeight = 0;
    this.modelRotation = modelRotation;
    this.castShadow = castShadow;
    this.receiveShadow = receiveShadow;
    this.modelTargetHeight = modelTargetHeight ?? (modelUrl ? 1.2 : null);

    const resolvedModel = model ?? (modelUrl
      ? createLoadingPlaceholder({ castShadow, receiveShadow })
      : createDefaultItemModel({ castShadow, receiveShadow }));

    this.model = resolvedModel;
    this.group = new THREE.Group();
    this.group.position.copy(this.position);
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
    this.group.position.y = this.groundY + this.floatHeight + this.modelHeight * 0.5;
  }

  loadModelFromUrl(modelUrl) {
    console.info('Loading item appearance model', modelUrl);
    gltfLoader.load(
      modelUrl,
      gltf => {
        const root = gltf.scene ?? gltf.scenes?.[0];
        if (!root) {
          console.error('Failed to load item appearance model', modelUrl, new Error('Loaded GLTF did not contain a scene root.'));
          return;
        }

        root.updateWorldMatrix(true, true);
        const bounds = new THREE.Box3().setFromObject(root);
        const size = new THREE.Vector3();
        bounds.getSize(size);

        const sourceHeight = size.y > 0 ? size.y : 1;
        const targetHeight = this.modelTargetHeight > 0 ? this.modelTargetHeight : sourceHeight;
        const scale = targetHeight / sourceHeight;
        root.scale.setScalar(scale);

        applyShadows(root, this.castShadow, this.receiveShadow);
        this.setModel({ root, height: targetHeight });
        console.info('Loaded item appearance model', modelUrl);
      },
      undefined,
      error => {
        console.error('Failed to load item appearance model', modelUrl, error);
      }
    );
  }

  update(deltaTime) {
    this.group.rotation.y += this.rotationSpeed * deltaTime;
  }
}

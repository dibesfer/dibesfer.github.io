import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const gltfLoader = new GLTFLoader();

function applyShadows(root, castShadow, receiveShadow) {
  /* Vehicles may arrive as nested GLTF scenes with many child meshes, so one
  traversal keeps the shadow settings consistent without requiring the caller
  to know the model's internal structure in advance. */
  root.traverse(part => {
    if (!part.isMesh) return;
    part.castShadow = castShadow;
    part.receiveShadow = receiveShadow;
  });
}

export class Vehicle {
  constructor({
    scene,
    position,
    name = 'Vehicle',
    typeLabel = 'Vehicle',
    modelUrl = null,
    modelScale = 1,
    rotationY = 0,
    castShadow = true,
    receiveShadow = false,
    miniMapType = 'vehicle',
  }) {
    /* This base class deliberately mirrors the lightweight world-object shape
    used elsewhere in Kolorlando: a world position, a Three.js group, a label,
    and an update() method the main loop can call safely even if the object is
    static for now. */
    this.scene = scene;
    this.position = position.clone();
    this.name = name;
    this.typeLabel = typeLabel;
    this.modelUrl = modelUrl;
    this.modelScale = modelScale;
    this.castShadow = castShadow;
    this.receiveShadow = receiveShadow;
    this.miniMapType = miniMapType;

    /* A neutral forward direction gives the minimap and any future systems a
    stable orientation value even before vehicles gain movement behavior. */
    this.direction = new THREE.Vector3(0, 0, 1);

    /* The collider starts empty and is refreshed from the loaded model bounds
    once the GLTF is available, which lets simple raycast/UI systems treat the
    vehicle like a normal world entity without hand-authored box values yet. */
    this.collider = new THREE.Box3();

    this.group = new THREE.Group();
    this.group.position.copy(this.position);
    this.group.rotation.y = rotationY;
    this.scene.add(this.group);

    if (this.modelUrl) {
      this.loadModel();
    }
  }

  loadModel() {
    gltfLoader.load(
      this.modelUrl,
      gltf => {
        const root = gltf.scene ?? gltf.scenes?.[0];
        if (!root) {
          console.error('Vehicle GLTF did not contain a scene root.', this.modelUrl);
          return;
        }

        /* A single scalar is enough for the first vehicle pass, keeping the
        authored spaceship asset reusable while we defer per-vehicle tuning. */
        if (this.modelScale !== 1) {
          root.scale.multiplyScalar(this.modelScale);
        }

        applyShadows(root, this.castShadow, this.receiveShadow);

        this.group.clear();
        this.group.add(root);
        this.refreshCollider();
      },
      undefined,
      error => {
        console.error('Failed to load vehicle model.', this.modelUrl, error);
      }
    );
  }

  refreshCollider() {
    /* Rebuilding the bounds from the rendered group gives us a coarse but
    useful collider immediately, which is good enough for readouts and future
    interaction hooks before dedicated vehicle collision rules exist. */
    this.group.updateWorldMatrix(true, true);
    this.collider.setFromObject(this.group);
  }

  update() {
    /* Vehicles are static for this first scope, but the main loop still calls
    update() every frame so later movement, hovering, or interaction logic can
    land here without changing the caller contract again. */
    this.group.position.copy(this.position);
    this.refreshCollider();
  }
}

export class SpaceShipVehicle extends Vehicle {
  constructor(options = {}) {
    super({
      ...options,
      name: options.name ?? 'SpaceShip1',
      typeLabel: options.typeLabel ?? 'Spaceship',
      modelUrl: options.modelUrl ?? 'assets/3D/vehicles/spaceship.gltf',
      /* The spaceship asset can be re-tuned later, but starting with a modest
      scale makes it easier to place near the player without dwarfing the map. */
      modelScale: options.modelScale ?? 0.7,
      miniMapType: options.miniMapType ?? 'vehicle',
    });
  }
}

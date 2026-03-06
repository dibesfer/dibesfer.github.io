import * as THREE from 'three';
import { createHumanoidModel, applyHumanoidWalkAnimation } from './entityModel.js';

const ENTITY_NAME_PARTS_A = ['Neo', 'Rex', 'Kira', 'Nova', 'Axel', 'Iris', 'Vex', 'Luna', 'Zed', 'Milo'];
const ENTITY_NAME_PARTS_B = ['Stone', 'Blade', 'Runner', 'Flux', 'Byte', 'Echo', 'Volt', 'Shade', 'Forge', 'Drift'];

function randomEntityName() {
  const a = ENTITY_NAME_PARTS_A[Math.floor(Math.random() * ENTITY_NAME_PARTS_A.length)];
  const b = ENTITY_NAME_PARTS_B[Math.floor(Math.random() * ENTITY_NAME_PARTS_B.length)];
  return `${a} ${b}`;
}

function createEntityLabelSprite(name, type) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 192;
  const ctx = canvas.getContext('2d');

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.fillRect(56, 42, 400, 108);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 48px Arial';
  ctx.fillText(name, canvas.width * 0.5, 82);

  ctx.fillStyle = '#d0d0d0';
  ctx.font = '26px Arial';
  ctx.fillText(type, canvas.width * 0.5, 126);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    depthTest: false,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(3.2, 1.2, 1);
  return sprite;
}

export class Entity {
  constructor({
    scene,
    position,
    groundY = 0,
    color = 0xff9a9a,
    outfit = null,
    name = randomEntityName(),
    typeLabel = 'Walker',
    speed = 2.2,
    clearance = 1.0,
  }) {
    this.scene = scene;
    this.position = position.clone();
    this.groundY = groundY;
    this.speed = speed;
    this.clearance = clearance;
    this.name = name;
    this.typeLabel = typeLabel;

    this.bodyWidth = 0.8;
    this.bodyDepth = 0.55;
    this.bodyHeight = 1.8;
    this.modelBaseHeight = 1.9;
    this.visualLift = 0.03;

    this.collider = new THREE.Box3();
    this.group = new THREE.Group();
    this.group.scale.set(1, this.bodyHeight / this.modelBaseHeight, 1);
    this.group.position.set(this.position.x, this.groundY + this.visualLift, this.position.z);

    const resolvedOutfit = outfit ?? {
      skin: 0xf0c9a5,
      shirt: color,
      sleeves: color,
      pants: 0x4b4f64,
      shoes: 0x1d1d1d,
      hair: 0x2a1d16,
    };

    const humanoid = createHumanoidModel({
      outfit: resolvedOutfit,
      castShadow: true,
      receiveShadow: false,
    });
    this.group.add(humanoid.root);
    this.joints = humanoid.joints;
    this.modelBaseHeight = humanoid.baseHeight;
    this.group.scale.set(1, this.bodyHeight / this.modelBaseHeight, 1);
    this.labelSprite = createEntityLabelSprite(this.name, this.typeLabel);
    this.labelSprite.position.set(0, this.bodyHeight + 0.55, 0);
    this.group.add(this.labelSprite);
    this.scene.add(this.group);

    this.direction = new THREE.Vector3(1, 0, 0);
    this.turnTimer = 0;
    this.walkCycle = Math.random() * Math.PI * 2;
    this._testBox = new THREE.Box3();
    this._nextPos = new THREE.Vector3();
    this._toPlayer = new THREE.Vector3();

    this.pickRandomDirection();
    this.updateCollider();
  }

  pickRandomDirection() {
    const angle = Math.random() * Math.PI * 2;
    this.direction.set(Math.cos(angle), 0, Math.sin(angle));
    this.turnTimer = 1.2 + Math.random() * 2.8;
  }

  updateCollider() {
    const halfW = this.bodyWidth * 0.5;
    const halfD = this.bodyDepth * 0.5;
    this.collider.min.set(
      this.position.x - halfW,
      this.groundY,
      this.position.z - halfD
    );
    this.collider.max.set(
      this.position.x + halfW,
      this.groundY + this.bodyHeight,
      this.position.z + halfD
    );
  }

  willHitObstacleAt(nextPos, colliders) {
    const halfW = this.bodyWidth * 0.5;
    const halfD = this.bodyDepth * 0.5;
    this._testBox.min.set(
      nextPos.x - halfW,
      this.groundY,
      nextPos.z - halfD
    );
    this._testBox.max.set(
      nextPos.x + halfW,
      this.groundY + this.bodyHeight,
      nextPos.z + halfD
    );

    for (let i = 0; i < colliders.length; i++) {
      const c = colliders[i];
      if (
        this._testBox.max.x < c.min.x - this.clearance ||
        this._testBox.min.x > c.max.x + this.clearance ||
        this._testBox.max.y < c.min.y ||
        this._testBox.min.y > c.max.y ||
        this._testBox.max.z < c.min.z - this.clearance ||
        this._testBox.min.z > c.max.z + this.clearance
      ) {
        continue;
      }
      return true;
    }

    return false;
  }

  tryFindOpenDirection(colliders, deltaTime) {
    const stepDistance = this.speed * deltaTime;
    for (let i = 0; i < 10; i++) {
      this.pickRandomDirection();
      this._nextPos.copy(this.position).addScaledVector(this.direction, stepDistance);
      if (!this.willHitObstacleAt(this._nextPos, colliders)) {
        return true;
      }
    }
    return false;
  }

  updateWalkAnimation(deltaTime) {
    this.walkCycle += deltaTime * 8;
    applyHumanoidWalkAnimation(this.joints, this.walkCycle, 1);
  }

  update(deltaTime, colliders) {
    this.turnTimer -= deltaTime;
    if (this.turnTimer <= 0) {
      this.pickRandomDirection();
    }

    const stepDistance = this.speed * deltaTime;
    this._nextPos.copy(this.position).addScaledVector(this.direction, stepDistance);

    if (this.willHitObstacleAt(this._nextPos, colliders)) {
      if (!this.tryFindOpenDirection(colliders, deltaTime)) {
        return;
      }
      this._nextPos.copy(this.position).addScaledVector(this.direction, stepDistance);
    }

    this.position.copy(this._nextPos);
    this.group.position.set(this.position.x, this.groundY + this.visualLift, this.position.z);
    this.group.rotation.y = Math.atan2(this.direction.x, this.direction.z);
    this.updateCollider();

    this.updateWalkAnimation(deltaTime);
  }
}

export class HunterEntity extends Entity {
  constructor(options = {}) {
    super({
      ...options,
      color: options.color ?? 0x7e1313,
      typeLabel: options.typeLabel ?? 'Chaser',
      outfit: options.outfit ?? {
        skin: 0xd5a788,
        shirt: 0x6c1111,
        sleeves: 0x4f0f0f,
        pants: 0x2d0c0c,
        shoes: 0x120707,
        hair: 0x120707,
      },
      speed: options.speed ?? 2.5,
    });
    this.detectionRadius = options.detectionRadius ?? 3.0;
  }

  update(deltaTime, colliders, playerPosition) {
    this.turnTimer -= deltaTime;

    let chasing = false;
    if (playerPosition) {
      this._toPlayer.set(
        playerPosition.x - this.position.x,
        0,
        playerPosition.z - this.position.z
      );
      const inRange = this._toPlayer.lengthSq() <= this.detectionRadius * this.detectionRadius;
      if (inRange && this._toPlayer.lengthSq() > 0.0001) {
        this._toPlayer.normalize();
        this.direction.copy(this._toPlayer);
        chasing = true;
      }
    }

    if (!chasing && this.turnTimer <= 0) {
      this.pickRandomDirection();
    } else if (chasing) {
      this.turnTimer = 0.2;
    }

    const stepDistance = this.speed * deltaTime;
    this._nextPos.copy(this.position).addScaledVector(this.direction, stepDistance);

    if (this.willHitObstacleAt(this._nextPos, colliders)) {
      if (!this.tryFindOpenDirection(colliders, deltaTime)) {
        return;
      }
      this._nextPos.copy(this.position).addScaledVector(this.direction, stepDistance);
    }

    this.position.copy(this._nextPos);
    this.group.position.set(this.position.x, this.groundY + this.visualLift, this.position.z);
    this.group.rotation.y = Math.atan2(this.direction.x, this.direction.z);
    this.updateCollider();

    this.updateWalkAnimation(deltaTime);
  }
}
